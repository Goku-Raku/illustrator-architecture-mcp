import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { executeToolJsx, formatToolResult } from '../tool-executor.js';
import { colorSchema, COLOR_HELPERS_JSX, WRITE_IDEMPOTENT_ANNOTATIONS } from '../modify/shared.js';
import { cubicEndpointNeighbor, cubicRoute, markerPath, sectorPath, type BezierNode, type Point } from './geometry.js';

// Geometry is expanded and bounded in Node before Illustrator receives any write.
// Raster pixels must first be mapped to these explicit, artboard-relative points.
const coordinate = z.number().finite().min(-1_000_000).max(1_000_000);
const point = z.tuple([coordinate, coordinate]);
const color = z.union([z.string().regex(/^#[0-9a-fA-F]{6}$/), colorSchema.unwrap()]);
const opacity = z.number().finite().min(0).max(100).default(100);
const stroke = z.object({
  color,
  width_pt: z.number().finite().positive().max(100).default(1),
  dash_pt: z.array(z.number().finite().min(0).max(1000)).max(8).default([])
    .refine((v) => v.length === 0 || v.some((n) => n > 0), 'Dash pattern must have a positive length'),
}).strict();
export { color as overlayColorSchema, stroke as overlayStrokeSchema };
const semantic = {
  id: z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/),
  role: z.string().trim().min(1).max(256),
  evidence: z.string().max(4000).optional().describe('Observed source or design assumption; do not invent site facts.'),
  evidence_kind: z.enum(['observed', 'inferred', 'proposed', 'supplied']).optional()
    .describe('Provenance category, not automatic verification. observed: direct observation; inferred: interpretation; proposed: design intent; supplied: provided source data.'),
  source_ref: z.string().trim().min(1).max(2000).optional().describe('Source URL, file, sheet or drawing reference. Stored as text; never fetched or executed.'),
  data_ref: z.string().trim().min(1).max(2000).optional().describe('Dataset/table/record identifier, including units and time if relevant. Stored as text; never fetched or executed.'),
  confidence: z.number().finite().min(0).max(1).optional(),
  opacity,
};
const polygon = z.array(point).min(3).max(1000).describe('Simple polygon without holes; omit the repeated closing point. Concave polygons are supported.');
const polyline = z.array(point).min(2).max(1000);
const zone = z.object({
  ...semantic,
  kind: z.literal('zone'),
  points: polygon,
  fill: color,
  stroke: stroke.optional(),
}).strict();
const compoundZone = z.object({
  ...semantic,
  kind: z.literal('compound_zone'),
  outer: polygon,
  holes: z.array(polygon).min(1).max(100).describe('Simple, mutually disjoint holes strictly inside outer. Rings omit repeated closing points; touching, crossing and nested holes are rejected.'),
  fill: color,
  stroke: stroke.optional(),
}).strict();
const route = z.object({
  ...semantic,
  kind: z.literal('route'),
  points: polyline,
  stroke,
  arrow: z.enum(['none', 'start', 'end', 'both']).default('end'),
  arrow_length_pt: z.number().finite().positive().max(1000).default(8),
  arrow_width_pt: z.number().finite().positive().max(1000).default(5),
}).strict();
const smoothRoute = z.object({
  ...semantic,
  kind: z.literal('smooth_route'),
  start: point,
  segments: z.array(z.object({ control1: point, control2: point, end: point }).strict()).min(1).max(333)
    .describe('Explicit cubic Bezier spans; each begins at start or the preceding end. Handles are absolute artboard-web points. Adjacent spans may form corners; no auto-smoothing or route finding.'),
  stroke,
  arrow: z.enum(['none', 'start', 'end', 'both']).default('end'),
  arrow_length_pt: z.number().finite().positive().max(1000).default(8),
  arrow_width_pt: z.number().finite().positive().max(1000).default(5),
}).strict();
const marker = z.object({
  ...semantic,
  kind: z.literal('marker'),
  center: point,
  shape: z.enum(['circle', 'square', 'diamond', 'triangle', 'cross']).default('circle'),
  size_pt: z.number().finite().min(0.001).max(10000).default(8)
    .describe('Unrotated overall width/height (circle diameter). Cross is a closed plus sign with arm width size_pt / 3; triangle points upward before rotation.'),
  rotation_degrees: z.number().finite().min(-360).max(360).default(0).describe('Clockwise in artboard-web coordinates.'),
  fill: color,
  stroke: stroke.optional(),
}).strict();
const sector = z.object({
  ...semantic,
  kind: z.literal('sector'),
  center: point,
  radius_pt: z.number().finite().min(0.001).max(100000),
  start_degrees: z.number().finite().min(-720).max(720),
  end_degrees: z.number().finite().min(-720).max(720)
    .describe('Signed sweep = end - start; magnitude must be 0.000001..360 degrees. Zero is right, positive clockwise. For a clockwise sweep across zero use e.g. 350 to 370. Full 360 creates a disk.'),
  fill: color,
  stroke: stroke.optional(),
}).strict();
const boundary = z.object({
  ...semantic,
  kind: z.literal('boundary'),
  points: polyline,
  closed: z.boolean().default(true),
  stroke,
}).strict();
const label = z.object({
  ...semantic,
  kind: z.literal('label'),
  anchor: point.describe('Point text anchor in pt: Y is the first line BASELINE, not its upper edge.'),
  text: z.string().min(1).max(10000),
  font_name: z.string().min(1).max(256).describe('Exact installed PostScript font name from list_fonts. Missing fonts fail before writes.'),
  font_size_pt: z.number().finite().positive().max(1000).default(10),
  fill: color,
  alignment: z.enum(['left', 'center', 'right']).default('left'),
  leader_points: polyline.optional(),
  leader_stroke: stroke.optional(),
}).strict();
const hatch = z.object({
  ...semantic,
  kind: z.literal('hatch'),
  points: polygon,
  stroke,
  spacing_pt: z.number().finite().min(0.1).max(10000).default(5),
  angle_degrees: z.number().finite().min(-360).max(360).default(45)
    .describe('Clockwise from screen horizontal because artboard-web Y points down.'),
  phase_pt: z.number().finite().min(-10000).max(10000).default(0),
}).strict();

export const overlayInputSchema = z.object({
  expected_document: z.object({ name: z.string().min(1).max(1000), path: z.string().min(1).max(4000).optional() }).strict(),
  artboard_index: z.number().int().min(0).max(10000),
  coordinate_system: z.literal('artboard-web').default('artboard-web'),
  batch_id: z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/),
  layer_name: z.string().trim().min(1).max(256).default('Architecture Analysis'),
  layer_collision: z.enum(['error', 'suffix']).default('error'),
  elements: z.array(z.discriminatedUnion('kind', [zone, compoundZone, route, smoothRoute, marker, sector, boundary, label, hatch])).min(1).max(200),
}).strict();

type Color = Exclude<z.infer<typeof colorSchema>, undefined>;
type Stroke = { color: Color; width_pt: number; dash_pt: number[] };
type Element = z.infer<typeof overlayInputSchema>['elements'][number];
type Primitive = {
  component: string;
  type: 'path' | 'compound_path' | 'text';
  points?: Point[];
  rings?: Point[][];
  handles?: { left: Point; right: Point }[];
  closed?: boolean;
  fill: Color;
  stroke?: Stroke;
  opacity: number;
  anchor?: Point;
  text?: string;
  font_name?: string;
  font_size_pt?: number;
  alignment?: string;
};
const MAX_PRIMITIVES = 5000;
const MAX_HATCH_SCANLINES = 4000;
const MAX_HATCH_SEGMENTS = 2000;
const EPS = 1e-8;

function normalizeColor(value: z.infer<typeof color>): Color {
  if (typeof value !== 'string') return value;
  return { type: 'rgb', r: parseInt(value.slice(1, 3), 16), g: parseInt(value.slice(3, 5), 16), b: parseInt(value.slice(5, 7), 16) };
}
function normalizeStroke(value: z.infer<typeof stroke>): Stroke {
  const normalized = { ...value, color: normalizeColor(value.color) };
  if (normalized.color.type === 'none') throw new Error('A visible stroke color is required for lines.');
  return normalized;
}
function equal(a: Point, b: Point): boolean { return Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS; }
function cross(a: Point, b: Point, c: Point): number { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
function onSegment(a: Point, b: Point, p: Point): boolean {
  return Math.abs(cross(a, b, p)) < EPS && p[0] >= Math.min(a[0], b[0]) - EPS && p[0] <= Math.max(a[0], b[0]) + EPS && p[1] >= Math.min(a[1], b[1]) - EPS && p[1] <= Math.max(a[1], b[1]) + EPS;
}
function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
  if (((abC > EPS && abD < -EPS) || (abC < -EPS && abD > EPS)) && ((cdA > EPS && cdB < -EPS) || (cdA < -EPS && cdB > EPS))) return true;
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}
function validatePolyline(points: Point[]): void {
  for (let i = 1; i < points.length; i++) if (equal(points[i - 1], points[i])) throw new Error('Consecutive duplicate points create zero-length segments.');
}
function validatePolygon(points: Point[]): void {
  validatePolyline(points);
  if (equal(points[0], points[points.length - 1])) throw new Error('Omit the repeated closing point.');
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], c = points[(i + 2) % points.length];
    area += a[0] * b[1] - a[1] * b[0];
    // Collinear forward points are harmless, but reversing over an edge is not.
    if (Math.abs(cross(a, b, c)) < EPS && (onSegment(a, b, c) || onSegment(b, c, a))) throw new Error('Polygon edges overlap or reverse direction.');
    for (let j = i + 2; j < points.length; j++) {
      if (i === 0 && j === points.length - 1) continue;
      if (segmentsIntersect(a, b, points[j], points[(j + 1) % points.length])) throw new Error('Polygon must be simple: edges must not cross or touch.');
    }
  }
  if (Math.abs(area) < EPS) throw new Error('Polygon has zero area.');
}

function ringsIntersect(a: Point[], b: Point[]): boolean {
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    if (segmentsIntersect(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
  }
  return false;
}
function insideRing(p: Point, ring: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (onSegment(a, b, p)) return false;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
/** Ring winding is deliberately irrelevant: the native writer uses even/odd. */
export function validateCompoundPolygon(outer: Point[], holes: Point[][]): void {
  validatePolygon(outer);
  holes.forEach(validatePolygon);
  for (let i = 0; i < holes.length; i++) {
    const hole = holes[i];
    if (ringsIntersect(outer, hole) || !insideRing(hole[0], outer)) throw new Error('Each hole must be strictly inside outer without touching or crossing its boundary.');
    for (let j = 0; j < i; j++) {
      if (ringsIntersect(hole, holes[j]) || insideRing(hole[0], holes[j]) || insideRing(holes[j][0], hole)) throw new Error('Holes must not touch, intersect or nest.');
    }
  }
}

/** Even/odd scanline clipping. Every emitted segment lies inside a simple polygon,
 * including concave boundaries. Holes and self-intersections are deliberately rejected. */
export function hatchSegments(points: Point[], spacing: number, angle: number, phase = 0): Point[][] {
  const radians = angle * Math.PI / 180;
  const u: Point = [Math.cos(radians), Math.sin(radians)];
  const n: Point = [-u[1], u[0]];
  const transformed = points.map((p) => [p[0] * u[0] + p[1] * u[1], p[0] * n[0] + p[1] * n[1]] as Point);
  const min = Math.min(...transformed.map((p) => p[1])), max = Math.max(...transformed.map((p) => p[1]));
  const first = Math.ceil((min - phase) / spacing), last = Math.floor((max - phase) / spacing);
  if (last - first + 1 > MAX_HATCH_SCANLINES) throw new Error('Hatch exceeds 4000 scanlines; increase spacing_pt or reduce polygon size.');
  const output: Point[][] = [];
  for (let k = first; k <= last; k++) {
    const t = k * spacing + phase;
    const cuts: number[] = [];
    for (let i = 0; i < transformed.length; i++) {
      const a = transformed[i], b = transformed[(i + 1) % transformed.length];
      // Half-open intersections count a vertex once, including horizontal edges.
      if ((a[1] <= t && b[1] > t) || (b[1] <= t && a[1] > t)) cuts.push(a[0] + (t - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
    }
    cuts.sort((a, b) => a - b);
    if (cuts.length % 2) throw new Error('Numerically unstable hatch intersection; adjust polygon or angle.');
    for (let i = 0; i < cuts.length; i += 2) {
      if (cuts[i + 1] - cuts[i] <= EPS) continue;
      output.push([
        [u[0] * cuts[i] + n[0] * t, u[1] * cuts[i] + n[1] * t],
        [u[0] * cuts[i + 1] + n[0] * t, u[1] * cuts[i + 1] + n[1] * t],
      ]);
      if (output.length > MAX_HATCH_SEGMENTS) throw new Error('Hatch exceeds 2000 segments; increase spacing_pt.');
    }
  }
  return output;
}
function arrowTriangle(tip: Point, previous: Point, length: number, width: number): Point[] {
  const dx = tip[0] - previous[0], dy = tip[1] - previous[1], d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
  return [tip, [tip[0] - ux * length - uy * width / 2, tip[1] - uy * length + ux * width / 2], [tip[0] - ux * length + uy * width / 2, tip[1] - uy * length - ux * width / 2]];
}

export function prepareOverlay(input: unknown) {
  const params = overlayInputSchema.parse(input);
  const ids = new Set<string>();
  const warnings: string[] = [];
  let count = 0;
  let vertexCount = 0;
  const prepared = params.elements.map((element) => {
    if (ids.has(element.id)) throw new Error(`Duplicate semantic id: ${element.id}`);
    ids.add(element.id);
    const parts: Primitive[] = [];
    const pathPart = (component: string, points: Point[], closed: boolean, fill: Color, pathStroke?: Stroke): Primitive => ({ component, type: 'path', points, closed, fill, stroke: pathStroke, opacity: element.opacity });
    const curvePart = (component: string, nodes: BezierNode[], closed: boolean, fill: Color, pathStroke?: Stroke): Primitive => ({ ...pathPart(component, nodes.map((n) => n.anchor), closed, fill, pathStroke), handles: nodes.map((n) => ({ left: n.left, right: n.right })) });
    const none: Color = { type: 'none' };
    const addVertices = (n: number) => {
      vertexCount += n;
      if (vertexCount > 20000) throw new Error('Batch exceeds 20000 input vertices (including Bezier controls and label leaders).');
    };
    if ('points' in element) {
      addVertices(element.points.length);
      validatePolyline(element.points);
    }
    if (element.kind === 'zone') {
      validatePolygon(element.points);
      const fill = normalizeColor(element.fill);
      if (fill.type === 'none') throw new Error('Zone requires a fill color. Use boundary for an unfilled outline.');
      parts.push(pathPart('zone', element.points, true, fill, element.stroke && normalizeStroke(element.stroke)));
    } else if (element.kind === 'compound_zone') {
      const rings = [element.outer, ...element.holes];
      addVertices(rings.reduce((sum, ring) => sum + ring.length, 0));
      validateCompoundPolygon(element.outer, element.holes);
      const fill = normalizeColor(element.fill);
      if (fill.type === 'none') throw new Error('Compound zone requires a fill color.');
      parts.push({ component: 'compound-zone', type: 'compound_path', rings, closed: true, fill, stroke: element.stroke && normalizeStroke(element.stroke), opacity: element.opacity });
    } else if (element.kind === 'route') {
      const s = normalizeStroke(element.stroke);
      parts.push(pathPart('route', element.points, false, none, s));
      if (element.arrow === 'start' || element.arrow === 'both') {
        parts.push(pathPart('arrow-start', arrowTriangle(element.points[0], element.points[1], element.arrow_length_pt, element.arrow_width_pt), true, s.color));
      }
      if (element.arrow === 'end' || element.arrow === 'both') {
        const end = element.points.length - 1;
        parts.push(pathPart('arrow-end', arrowTriangle(element.points[end], element.points[end - 1], element.arrow_length_pt, element.arrow_width_pt), true, s.color));
      }
      if (element.arrow !== 'none' && element.stroke.dash_pt.length) warnings.push(`${element.id}: arrowheads are solid vector triangles; the route retains its dash pattern.`);
    } else if (element.kind === 'smooth_route') {
      addVertices(1 + element.segments.length * 3);
      const nodes = cubicRoute(element.start, element.segments);
      const s = normalizeStroke(element.stroke);
      parts.push(curvePart('smooth-route', nodes, false, none, s));
      if (element.arrow === 'start' || element.arrow === 'both') {
        const neighbor = cubicEndpointNeighbor(element.start, element.segments[0], 'start');
        parts.push(pathPart('arrow-start', arrowTriangle(element.start, neighbor, element.arrow_length_pt, element.arrow_width_pt), true, s.color));
      }
      if (element.arrow === 'end' || element.arrow === 'both') {
        const last = element.segments.length - 1;
        const start = last === 0 ? element.start : element.segments[last - 1].end;
        const neighbor = cubicEndpointNeighbor(start, element.segments[last], 'end');
        parts.push(pathPart('arrow-end', arrowTriangle(element.segments[last].end, neighbor, element.arrow_length_pt, element.arrow_width_pt), true, s.color));
      }
      if (element.arrow !== 'none' && element.stroke.dash_pt.length) warnings.push(`${element.id}: arrowheads are solid vector triangles; the route retains its dash pattern.`);
    } else if (element.kind === 'marker' || element.kind === 'sector') {
      addVertices(1);
      const fill = normalizeColor(element.fill);
      const s = element.stroke && normalizeStroke(element.stroke);
      if (fill.type === 'none' && !s) throw new Error(`${element.kind} requires a visible fill or stroke.`);
      const nodes = element.kind === 'marker'
        ? markerPath(element.center, element.size_pt, element.shape, element.rotation_degrees)
        : sectorPath(element.center, element.radius_pt, element.start_degrees, element.end_degrees);
      parts.push(curvePart(element.kind, nodes, true, fill, s));
      if (element.kind === 'sector') warnings.push(`${element.id}: sector is a geometric diagram symbol with cubic arc approximation; no obstacle clipping, isovist, visibility, distance-network or environmental simulation is performed.`);
    } else if (element.kind === 'boundary') {
      if (element.closed) validatePolygon(element.points);
      parts.push(pathPart('boundary', element.points, element.closed, none, normalizeStroke(element.stroke)));
    } else if (element.kind === 'hatch') {
      validatePolygon(element.points);
      const s = normalizeStroke(element.stroke);
      const segments = hatchSegments(element.points, element.spacing_pt, element.angle_degrees, element.phase_pt);
      if (!segments.length) throw new Error(`${element.id}: hatch produces no lines; reduce spacing_pt or adjust phase_pt.`);
      segments.forEach((segment, i) => parts.push(pathPart(`hatch-${i + 1}`, segment, false, none, s)));
      warnings.push(`${element.id}: hatch centerlines are clipped to the polygon; strokes may extend by half their width beyond the boundary. No holes are supported.`);
    } else {
      const fill = normalizeColor(element.fill);
      if (fill.type === 'none') throw new Error('Label requires a fill color.');
      if (element.leader_points) {
        addVertices(element.leader_points.length);
        validatePolyline(element.leader_points);
        if (!element.leader_stroke) throw new Error('leader_stroke is required when leader_points is provided.');
        parts.push(pathPart('leader', element.leader_points, false, none, normalizeStroke(element.leader_stroke)));
      } else if (element.leader_stroke) throw new Error('leader_points is required when leader_stroke is provided.');
      parts.push({ component: 'label', type: 'text', anchor: element.anchor, text: element.text, font_name: element.font_name, font_size_pt: element.font_size_pt, alignment: element.alignment, fill, opacity: element.opacity });
    }
    count += parts.reduce((sum, part) => sum + (part.rings ? 1 + part.rings.length : 1), 0);
    if (count > MAX_PRIMITIVES) throw new Error('Batch exceeds 5000 native objects. Split the batch or increase hatch spacing.');
    const metadata = { version: 1, batch_id: params.batch_id, semantic_id: element.id, role: element.role, evidence: element.evidence, evidence_kind: element.evidence_kind, source_ref: element.source_ref, data_ref: element.data_ref, confidence: element.confidence, kind: element.kind };
    // The ES3 writer spells backspace/form-feed as six-character Unicode
    // escapes while JSON.stringify uses two-character escapes; budget for it.
    const controlEscapeExtra = Object.values(metadata).reduce<number>((total, value) => total + (typeof value === 'string' ? (value.match(/[\b\f]/g) || []).length * 4 : 0), 0);
    if (JSON.stringify({ architectureMcp: metadata }).length + controlEscapeExtra > 15000) throw new Error(`${element.id}: combined semantic metadata exceeds the 15000-character safe note budget; shorten evidence and references.`);
    for (const part of parts) {
      const coordinates = [...(part.points || []), ...(part.rings || []).flat(), ...(part.handles || []).flatMap((h) => [h.left, h.right])];
      if (coordinates.some((p) => p.some((v) => !Number.isFinite(v)))) throw new Error(`${element.id}: generated geometry is not finite.`);
    }
    return { semantic: metadata, parts };
  });
  // Do not send redundant source geometry to the JSX transport.
  const { elements: _elements, ...rest } = params;
  return { ...rest, prepared, warnings, primitive_count: count };
}

// Restrict untrusted Illustrator notes to JSON tokens before using the upstream
// ES3 JSON reader (which is implemented with eval). Never evaluate freeform notes.
const SAFE_NOTE_JSON_JSX = String.raw`
function archSafeNoteJson(text) {
  if (!text || text.length > 16000) return null;
  var checked = text.replace(/\\["\\\/bfnrtu]/g, '@')
    .replace(/"[^"\\\n\r]*"|true|false|null|-{0,1}\d+(\.\d*){0,1}([eE][+\-]{0,1}\d+){0,1}/g, ']')
    .replace(/(^|:|,)(\s*\[)+/g, '');
  if (!/^[\],:{}\s]*$/.test(checked)) return null;
  try { return jsonParse(text); } catch (e) { return null; }
}
`;

export const OVERLAY_JSX = `
var preflight = preflightChecks();
if (preflight) {
  writeResultFile(RESULT_PATH, preflight);
} else {
  var archLayer = null;
  var archPreviousLayer = null;
  var archCommitted = false;
  var archResult;
  var archStep = 'preflight';
  var archElementId = null;
  try {
    var params = readParamsFile(PARAMS_PATH);
    var doc = app.activeDocument;
    ${COLOR_HELPERS_JSX}
    ${SAFE_NOTE_JSON_JSX}
    function archFail(message) { throw new Error(message); }
    function archPath(p) {
      var normalized = String(p).replace(/\\\\/g, '/');
      return /^[A-Za-z]:/.test(normalized) ? normalized.toLowerCase() : normalized;
    }
    function archNear(a, b) { return typeof a === 'number' && Math.abs(a - b) <= 0.001; }
    function archApplyPathStyle(item, part, pathOpacity) {
      item.filled = part.fill.type !== 'none';
      if (item.filled) item.fillColor = createColor(part.fill);
      item.stroked = !!part.stroke;
      if (part.stroke) {
        item.strokeColor = createColor(part.stroke.color);
        item.strokeWidth = part.stroke.width_pt;
        item.strokeDashes = part.stroke.dash_pt;
        item.strokeDashOffset = 0;
        if (typeof StrokeCap !== 'undefined') item.strokeCap = StrokeCap.BUTTENDCAP;
        if (typeof StrokeJoin !== 'undefined') item.strokeJoin = StrokeJoin.MITERENDJOIN;
        item.strokeOverprint = false;
      }
      if (item.filled) item.fillOverprint = false;
      item.opacity = pathOpacity;
      if (item.closed !== part.closed || item.filled !== (part.fill.type !== 'none') || item.stroked !== !!part.stroke || !archNear(item.opacity, pathOpacity) || (part.stroke && !archNear(item.strokeWidth, part.stroke.width_pt))) archFail('Illustrator did not retain a requested path style.');
      var style = { fill: item.filled ? colorToObject(item.fillColor) : { type: 'none' }, opacity: item.opacity, closed: item.closed };
      if (item.stroked) {
        var actualDash = [];
        for (var di = 0; di < item.strokeDashes.length; di++) actualDash.push(item.strokeDashes[di]);
        style.stroke = { color: colorToObject(item.strokeColor), width_pt: item.strokeWidth, dash_pt: actualDash };
      }
      return style;
    }
    function archMetadata(item, metadata, component) {
      var uuid = ensureUUID(item);
      var record = {};
      for (var key in metadata) if (metadata.hasOwnProperty(key)) record[key] = metadata[key];
      if (component) record.component = component;
      var note = uuid + ' ' + jsonStringify({ architectureMcp: record });
      item.note = note;
      if (String(item.note) !== note) archFail('Illustrator did not persist semantic metadata.');
      return uuid;
    }
    function archSemantic(note) {
      var n = String(note || '');
      if (extractUUIDFromNote(n)) n = n.substring(36).replace(/^\\s+/, '');
      var at = n.indexOf('::ai-mcp:');
      if (at >= 0) n = n.substring(0, at);
      var decoded = archSafeNoteJson(n);
      return decoded && decoded.architectureMcp ? decoded.architectureMcp : null;
    }
    function archLayerExists(name) {
      for (var li = 0; li < doc.layers.length; li++) if (doc.layers[li].name === name) return true;
      return false;
    }
    if (String(doc.name) !== params.expected_document.name) archFail('Active document does not match expected_document.name. Nothing was created.');
    if (params.expected_document.path) {
      var actualPath = '';
      try { actualPath = doc.fullName.fsName; } catch (ePath) {}
      if (!actualPath || archPath(actualPath) !== archPath(params.expected_document.path)) archFail('Active document path does not match expected_document.path. Nothing was created.');
    }
    if (params.artboard_index < 0 || params.artboard_index >= doc.artboards.length) archFail('artboard_index is out of range.');
    var rect = doc.artboards[params.artboard_index].artboardRect;
    function archPoint(p) { return [rect[0] + p[0], rect[1] - p[1]]; }
    var batchName = 'architectureMcp:batch:' + params.batch_id;
    var groups = doc.groupItems;
    if (groups) {
      for (var gi = 0; gi < groups.length; gi++) {
        var oldGroup = groups[gi];
        var oldSemantic = archSemantic(oldGroup.note);
        if (oldGroup.name === batchName || (oldSemantic && oldSemantic.batch_id === params.batch_id)) archFail('batch_id already exists. Nothing was created; inspect the existing batch before retrying.');
      }
    }
    var layerName = params.layer_name;
    if (archLayerExists(layerName)) {
      if (params.layer_collision !== 'suffix') archFail('Layer name already exists. Supply a new name or layer_collision:suffix.');
      var suffix = 2;
      while (archLayerExists(layerName + ' (' + suffix + ')')) suffix++;
      layerName += ' (' + suffix + ')';
    }
    // Resolve every font and color before opening the transaction.
    var fonts = {};
    for (var ei = 0; ei < params.prepared.length; ei++) {
      var source = params.prepared[ei];
      archElementId = source.semantic.semantic_id;
      for (var pi = 0; pi < source.parts.length; pi++) {
        var part = source.parts[pi];
        createColor(part.fill);
        if (part.stroke) createColor(part.stroke.color);
        if (part.type === 'text') {
          try { fonts[part.font_name] = app.textFonts.getByName(part.font_name); }
          catch (eFont) { archFail('Font not found: ' + part.font_name + '. Nothing was created. Use list_fonts.'); }
        }
      }
    }
    archPreviousLayer = doc.activeLayer;
    archLayer = doc.layers.add();
    archLayer.name = layerName;
    archLayer.visible = true;
    archLayer.locked = false;
    doc.activeLayer = archLayer;
    var batch = archLayer.groupItems.add();
    batch.name = batchName;
    batch.opacity = 100;
    var batchUuid = archMetadata(batch, { version: 1, batch_id: params.batch_id, kind: 'batch', artboard_index: params.artboard_index, coordinate_system: 'artboard-web' });
    var resultElements = [];
    var warnings = params.warnings || [];
    for (var ei = 0; ei < params.prepared.length; ei++) {
      var source = params.prepared[ei];
      archElementId = source.semantic.semantic_id;
      archStep = 'create_element_group';
      var elementGroup = batch.groupItems.add();
      elementGroup.name = source.semantic.semantic_id;
      elementGroup.opacity = 100;
      var elementUuid = archMetadata(elementGroup, source.semantic);
      var components = [];
      for (var pi = 0; pi < source.parts.length; pi++) {
        var part = source.parts[pi];
        var item;
        var actual;
        if (part.type === 'path') {
          archStep = 'create_path';
          item = elementGroup.pathItems.add();
          var aiPoints = [];
          for (var qi = 0; qi < part.points.length; qi++) aiPoints.push(archPoint(part.points[qi]));
          item.setEntirePath(aiPoints);
          item.closed = part.closed;
          if (part.handles) {
            archStep = 'set_path_handles';
            if (item.pathPoints.length !== part.handles.length) archFail('Illustrator did not retain the requested path anchor count.');
            for (var hi = 0; hi < part.handles.length; hi++) {
              var pathPoint = item.pathPoints[hi];
              // CORNER permits independent handles and preserves explicit cubic
              // geometry even at intentional corners between successive spans.
              if (typeof PointType !== 'undefined') pathPoint.pointType = PointType.CORNER;
              pathPoint.leftDirection = archPoint(part.handles[hi].left);
              pathPoint.rightDirection = archPoint(part.handles[hi].right);
            }
            archStep = 'verify_path_handles';
            for (var hi = 0; hi < part.handles.length; hi++) {
              var pathPoint = item.pathPoints[hi];
              var expectedLeft = archPoint(part.handles[hi].left);
              var expectedRight = archPoint(part.handles[hi].right);
              if (!archNear(pathPoint.anchor[0], aiPoints[hi][0]) || !archNear(pathPoint.anchor[1], aiPoints[hi][1]) || !archNear(pathPoint.leftDirection[0], expectedLeft[0]) || !archNear(pathPoint.leftDirection[1], expectedLeft[1]) || !archNear(pathPoint.rightDirection[0], expectedRight[0]) || !archNear(pathPoint.rightDirection[1], expectedRight[1])) archFail('Illustrator did not retain the requested Bezier geometry.');
            }
          }
          actual = archApplyPathStyle(item, part, part.opacity);
        } else if (part.type === 'compound_path') {
          archStep = 'create_compound_path';
          item = elementGroup.compoundPathItems.add();
          var createdRings = [];
          for (var ri = 0; ri < part.rings.length; ri++) {
            var ringItem = item.pathItems.add();
            createdRings.push(ringItem);
            var ringPoints = [];
            for (var qi = 0; qi < part.rings[ri].length; qi++) ringPoints.push(archPoint(part.rings[ri][qi]));
            ringItem.setEntirePath(ringPoints);
            ringItem.closed = true;
            ringItem.evenodd = true;
            // Members share native path styles. Apply opacity once on the
            // compound container so translucent rings cannot darken each other.
            actual = archApplyPathStyle(ringItem, part, 100);
          }
          item.opacity = part.opacity;
          archStep = 'verify_compound_path';
          if (item.pathItems.length !== part.rings.length || !archNear(item.opacity, part.opacity)) archFail('Illustrator did not retain the requested compound path.');
          for (var ri = 0; ri < part.rings.length; ri++) {
            var ringItem = createdRings[ri];
            if (!ringItem.evenodd || !ringItem.closed || ringItem.pathPoints.length !== part.rings[ri].length) archFail('Illustrator did not retain the requested even-odd rings.');
            for (var qi = 0; qi < part.rings[ri].length; qi++) {
              var ringPoint = archPoint(part.rings[ri][qi]);
              if (!archNear(ringItem.pathPoints[qi].anchor[0], ringPoint[0]) || !archNear(ringItem.pathPoints[qi].anchor[1], ringPoint[1])) archFail('Illustrator did not retain the requested compound geometry.');
            }
          }
          actual.opacity = item.opacity;
          actual.fill_rule = 'evenodd';
          actual.ring_count = item.pathItems.length;
        } else {
          // Illustrator 26 can fault natively in pointText(), and its anchor
          // setter can throw Not implemented. Use add(), style the text, then
          // read the baseline anchor and translate the frame into position.
          doc.activeLayer = archLayer;
          archStep = 'create_text';
          item = doc.textFrames.add();
          archStep = 'add_contents';
          item.contents = part.text.replace(/\\r\\n|\\n/g, '\\r');
          archStep = 'style_text:attributes';
          var attrs = item.textRange.characterAttributes;
          archStep = 'style_text:font';
          attrs.textFont = fonts[part.font_name];
          archStep = 'style_text:size';
          attrs.size = part.font_size_pt;
          archStep = 'style_text:fill';
          attrs.fillColor = createColor(part.fill);
          archStep = 'style_text:stroke';
          attrs.strokeWeight = 0;
          archStep = 'style_text:alignment';
          item.textRange.paragraphAttributes.justification = part.alignment === 'center' ? Justification.CENTER : (part.alignment === 'right' ? Justification.RIGHT : Justification.LEFT);
          archStep = 'style_text:opacity';
          item.opacity = part.opacity;
          archStep = 'position_text:read_anchor';
          var currentAnchor = item.anchor;
          var targetAnchor = archPoint(part.anchor);
          if (!currentAnchor || currentAnchor.length !== 2 || !isFinite(currentAnchor[0]) || !isFinite(currentAnchor[1])) archFail('Illustrator did not expose a valid point-text baseline anchor.');
          archStep = 'position_text:translate';
          item.translate(targetAnchor[0] - currentAnchor[0], targetAnchor[1] - currentAnchor[1]);
          // Illustrator text range/character-attribute handles may become stale
          // after a transform. Never read the pre-translation attrs handle.
          archStep = 'verify_text:reacquire_attributes';
          attrs = item.textRange.characterAttributes;
          archStep = 'verify_text';
          if (attrs.textFont.name !== part.font_name || !archNear(attrs.size, part.font_size_pt) || !archNear(item.opacity, part.opacity)) archFail('Illustrator did not retain a requested text style.');
          actual = { font_name: attrs.textFont.name, font_size_pt: attrs.size, fill: colorToObject(attrs.fillColor), opacity: item.opacity, alignment: part.alignment };
        }
        archStep = part.type === 'text' ? 'metadata_text' : 'metadata_path';
        item.name = source.semantic.semantic_id + ':' + part.component;
        var uuid = archMetadata(item, source.semantic, part.component);
        if (part.type === 'text') {
          archStep = 'move_text';
          item.move(elementGroup, ElementPlacement.PLACEATEND);
        }
        archStep = 'verify_component';
        var component = { uuid: uuid, component: part.component, type: part.type, actual_style: actual };
        try { component.bounds = getBounds(item, 'artboard-web', rect); } catch (eBounds) {}
        var boundsWarning = checkArtboardBounds(item, rect);
        if (boundsWarning && warnings.length < 100) warnings.push(source.semantic.semantic_id + ':' + part.component + ': ' + boundsWarning);
        components.push(component);
      }
      resultElements.push({ id: source.semantic.semantic_id, role: source.semantic.role, kind: source.semantic.kind, uuid: elementUuid, components: components });
    }
    archResult = appendColorSpaceWarnings({ success: true, batch_id: params.batch_id, batch_uuid: batchUuid, layer_name: layerName, artboard_index: params.artboard_index, coordinate_system: 'artboard-web', primitive_count: params.primitive_count, elements: resultElements, warnings: warnings });
    archCommitted = true;
  } catch (e) {
    var rollbackError = null;
    if (archLayer && !archCommitted) {
      try { archLayer.remove(); } catch (eRollback) { rollbackError = String(eRollback.message || eRollback); }
    }
    archResult = { error: true, success: false, message: String(e.message || e), stage: archStep, element_id: archElementId, jsx_line: e.line || null, rolled_back: !!archLayer && !rollbackError, rollback_error: rollbackError };
    if (rollbackError) archResult.warnings = ['Partial new overlay may remain in its newly created layer. Existing document objects were not edited.'];
  } finally {
    if (archPreviousLayer) { try { doc.activeLayer = archPreviousLayer; } catch (eRestore) {} }
  }
  writeResultFile(RESULT_PATH, archResult);
}
`;

export function register(server: McpServer): void {
  server.registerTool('arch_add_overlay', {
    title: 'Add Architectural Analysis Overlay',
    description: 'Add native editable zones, courtyard compound zones with true even-odd holes, straight/cubic routes with tangent-oriented vector arrowheads, node/entry markers, sectors, boundaries, labels/leaders and concave-polygon hatching above a fixed base drawing. Circle and sector arcs use cubic approximations; sectors are diagram geometry without obstacle clipping or visibility/environmental simulation. All positions use POINTS relative to the specified artboard top-left, Y downward; map screenshot pixels before calling. Does not infer geometry from pixels or alter the base drawing. Semantic groups retain id/role/evidence/confidence and optional evidence_kind/source_ref/data_ref in note JSON; provenance is caller supplied, not verified. Prevalidates the batch, exact document and fonts; creates only a NEW layer, rejects duplicate batch_id, and removes only its new layer on caught script failures. Native Illustrator/transport failures can bypass rollback: outcome_unknown requires inspecting the batch before retrying. Elements stack in input order, later above earlier. Opacity is per component (overlaps may darken). Returns persistent UUIDs and read-back styles. Limits: 200 elements, 20000 input points including cubic controls/leaders, 5000 native objects including compound containers and member paths, 2000 hatch segments per element. compound_zone supports strictly contained, disjoint simple holes; zone/hatch remain single simple polygons.',
    inputSchema: overlayInputSchema.shape,
    annotations: WRITE_IDEMPOTENT_ANNOTATIONS,
  }, async (params) => {
    let prepared: ReturnType<typeof prepareOverlay>;
    try {
      prepared = prepareOverlay(params);
    } catch (error) {
      return formatToolResult({ error: true, success: false, message: error instanceof Error ? error.message : String(error), stage: 'validation', outcome_unknown: false, nothing_created: true });
    }
    try {
      return await executeToolJsx(OVERLAY_JSX, prepared, { activate: true });
    } catch (error) {
      // The runner throws JsxToolError only after reading Illustrator's result
      // file. Preserve its concrete rollback evidence instead of flattening it.
      if (error instanceof Error && error.name === 'JsxToolError' && 'result' in error && error.result && typeof error.result === 'object') {
        return formatToolResult({ stage: 'illustrator', ...error.result, outcome_unknown: false });
      }
      return formatToolResult({
        error: true, success: false,
        message: error instanceof Error ? error.message : String(error),
        stage: 'transport', outcome_unknown: true,
        batch_id: prepared.batch_id, requested_layer_name: prepared.layer_name,
        expected_document: prepared.expected_document,
        retry_advice: 'Do not retry automatically. A native Illustrator or transport failure can bypass script rollback and leave a partial overlay. Restore the connection if needed, then inspect the expected document for this batch_id and its newly created layer. Resolve any partial batch before retrying.',
      });
    }
  });
}
