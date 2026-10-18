import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { READ_ANNOTATIONS } from '../modify/shared.js';
import { overlayColorSchema, overlayInputSchema, overlayStrokeSchema, prepareOverlay } from './overlay.js';
import type { Point } from './geometry.js';

// This is a bounded coordinate adapter. It deliberately has no Illustrator,
// filesystem, projection, geocoding, network-routing or fetch side effects.
const sourceNumber = z.number().finite().min(-1e12).max(1e12);
const position = z.tuple([sourceNumber, sourceNumber]);
const line = z.array(position).min(2).max(1000);
const ring = z.array(position).min(4).max(1001);
const polygon = z.array(ring).min(1).max(101);
const geometry = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Point'), coordinates: position }).strict(),
  z.object({ type: z.literal('MultiPoint'), coordinates: z.array(position).min(1).max(200) }).strict(),
  z.object({ type: z.literal('LineString'), coordinates: line }).strict(),
  z.object({ type: z.literal('MultiLineString'), coordinates: z.array(line).min(1).max(200) }).strict(),
  z.object({ type: z.literal('Polygon'), coordinates: polygon }).strict(),
  z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(polygon).min(1).max(200) }).strict(),
]);
const featureId = z.union([z.string().min(1).max(256), z.number().finite()]);
const feature = z.object({
  type: z.literal('Feature'),
  id: featureId.describe('Required stable source feature ID. String and numeric IDs are distinct.'),
  geometry,
  properties: z.record(z.string(), z.unknown()).nullable().optional().describe('Ignored data. Never interpreted as style, instructions, executable code, or analysis results.'),
}).strict();
const style = z.object({
  role: z.string().trim().min(1).max(256),
  fill: overlayColorSchema.optional(),
  stroke: overlayStrokeSchema.optional(),
  point_shape: z.enum(['circle', 'square', 'diamond', 'triangle', 'cross']).default('circle'),
  point_size_pt: z.number().finite().min(0.001).max(10000).default(8),
  opacity: z.number().finite().min(0).max(100).default(100),
  evidence_kind: z.enum(['observed', 'inferred', 'proposed', 'supplied']).default('supplied'),
  evidence: z.string().max(4000).optional(),
}).strict();

export const siteMapInputSchema = z.object({
  expected_document: overlayInputSchema.shape.expected_document,
  artboard_index: overlayInputSchema.shape.artboard_index,
  batch_id: overlayInputSchema.shape.batch_id,
  layer_name: overlayInputSchema.shape.layer_name,
  layer_collision: overlayInputSchema.shape.layer_collision,
  geojson: z.object({ type: z.literal('FeatureCollection'), features: z.array(feature).min(1).max(200) }).strict(),
  source_coordinates: z.object({
    kind: z.enum(['projected', 'local_planar']).describe('Explicit caller declaration. Geographic longitude/latitude is not accepted; project it externally first.'),
    crs: z.string().trim().min(1).max(1000).describe('Explicit projected CRS identifier or named local drawing coordinate system. This tool neither verifies nor reprojects the CRS.'),
    units: z.enum(['m', 'ft', 'mm']),
    y_axis: z.enum(['up', 'down']).describe('Increasing source Y direction; never used to infer true north.'),
  }).strict(),
  source_ref: z.string().trim().min(1).max(2000).describe('Caller-supplied dataset/file/drawing reference. Stored as provenance, never fetched.'),
  source_extent: z.tuple([sourceNumber, sourceNumber, sourceNumber, sourceNumber]).optional()
    .describe('[xmin,ymin,xmax,ymax] shared by every feature; out-of-extent data is rejected. Otherwise use the collection bbox. Supply a positive extent for single-point or collinear data.'),
  frame: z.object({
    left: z.number().finite().min(-1e6).max(1e6), top: z.number().finite().min(-1e6).max(1e6),
    width: z.number().finite().positive().max(1e6), height: z.number().finite().positive().max(1e6),
  }).strict().describe('Target rectangle in artboard-web pt, Y downward. Uniform scale fits and centers the source extent without cropping.'),
  default_style: style.optional().describe('Explicit style for features without an override. Polygon needs visible fill; line needs stroke; point needs fill or stroke.'),
  feature_styles: z.array(z.object({ feature_id: featureId, style }).strict()).max(200).default([])
    .describe('Complete per-feature style overrides; no implicit merging or property-based classification.'),
}).strict();

type Geometry = z.infer<typeof geometry>;
const idKey = (id: string | number) => `${typeof id}:${id}`;
function geometryPositions(g: Geometry): Point[] {
  switch (g.type) {
    case 'Point': return [g.coordinates];
    case 'MultiPoint': case 'LineString': return g.coordinates;
    case 'MultiLineString': case 'Polygon': return g.coordinates.flat();
    case 'MultiPolygon': return g.coordinates.flat(2);
  }
}
function rejectGeographicCrs(crs: string): void {
  // Catch explicit geographic identifiers even when mislabeled as projected.
  // Small numeric coordinates alone are valid local drawings and prove nothing.
  if (/\b(?:4326|4269|4258|4490|4610|4979)\b|CRS\s*:?\s*84\b|^WGS\s*[-_]?\s*84$|GEOG(?:CS|CRS)|GEOGRAPHIC|LONGITUDE|LATITUDE|\+proj\s*=\s*(?:longlat|latlong)/i.test(crs)) {
    throw new Error('Geographic longitude/latitude CRS is unsupported. Project the data externally and declare its projected CRS and linear units.');
  }
}

function precheckCoordinateBudget(input: unknown): void {
  if (!input || typeof input !== 'object' || !('geojson' in input)) return;
  const collection = input.geojson;
  if (!collection || typeof collection !== 'object' || !('features' in collection) || !Array.isArray(collection.features)) return;
  if (collection.features.length > 200) throw new Error('Site map exceeds 200 source features.');
  let positions = 0, arrays = 0;
  const visit = (value: unknown, depth: number): void => {
    if (!Array.isArray(value)) return;
    // Limit malformed nested arrays as well as valid positions, before Zod
    // clones a potentially large MultiPolygon tree. Valid maximum depth is 3.
    if (++arrays > 40000 || depth > 3 || value.length > 1001) throw new Error('Site-map coordinate nesting or array budget exceeded.');
    if (value.length && !Array.isArray(value[0])) {
      if (++positions > 20000) throw new Error('Site map exceeds 20000 source positions, including closing ring vertices.');
      return;
    }
    for (const child of value) visit(child, depth + 1);
  };
  for (const source of collection.features) {
    if (source && typeof source === 'object' && 'geometry' in source && source.geometry && typeof source.geometry === 'object' && 'coordinates' in source.geometry) {
      visit(source.geometry.coordinates, 0);
    }
  }
}

export function prepareSiteMap(input: unknown) {
  precheckCoordinateBudget(input);
  const params = siteMapInputSchema.parse(input);
  rejectGeographicCrs(params.source_coordinates.crs);
  const ids = new Set<string>();
  let vertexCount = 0;
  const positions: Point[] = [];
  for (const source of params.geojson.features) {
    const key = idKey(source.id);
    if (ids.has(key)) throw new Error(`Duplicate feature ID: ${key}`);
    ids.add(key);
    const points = geometryPositions(source.geometry);
    vertexCount += points.length;
    if (vertexCount > 20000) throw new Error('Site map exceeds 20000 source positions, including closing ring vertices. Split or simplify externally without inventing geometry.');
    positions.push(...points);
  }
  const overrides = new Map<string, z.infer<typeof style>>();
  for (const entry of params.feature_styles) {
    const key = idKey(entry.feature_id);
    if (!ids.has(key)) throw new Error(`Style references an unknown feature ID: ${key}`);
    if (overrides.has(key)) throw new Error(`Duplicate feature style: ${key}`);
    overrides.set(key, entry.style);
  }
  const bbox: [number, number, number, number] = [
    Math.min(...positions.map((p) => p[0])), Math.min(...positions.map((p) => p[1])),
    Math.max(...positions.map((p) => p[0])), Math.max(...positions.map((p) => p[1])),
  ];
  const extent = params.source_extent || bbox;
  const sourceWidth = extent[2] - extent[0], sourceHeight = extent[3] - extent[1];
  if (sourceWidth <= 0 || sourceHeight <= 0) throw new Error('source_extent must have positive width and height. Supply an explicit extent for single-point or collinear data.');
  if (positions.some(([x, y]) => x < extent[0] || x > extent[2] || y < extent[1] || y > extent[3])) throw new Error('A source coordinate lies outside source_extent. No clipping or silent omission is performed.');
  const scale = Math.min(params.frame.width / sourceWidth, params.frame.height / sourceHeight);
  const actualFrame = {
    left: params.frame.left + (params.frame.width - sourceWidth * scale) / 2,
    top: params.frame.top + (params.frame.height - sourceHeight * scale) / 2,
    width: sourceWidth * scale, height: sourceHeight * scale,
  };
  const sourceUp = params.source_coordinates.y_axis === 'up';
  const mapPoint = ([x, y]: Point): Point => [actualFrame.left + (x - extent[0]) * scale, actualFrame.top + (sourceUp ? extent[3] - y : y - extent[1]) * scale];
  const warnings = [
    'Preparation only: no Illustrator document was read or changed. Inspect overlay_params before arch_add_overlay.',
    'Caller-declared CRS, linear units and evidence are retained, not independently verified. Recognized geographic identifiers are rejected, but mislabeled coordinates or arbitrary CRS names cannot be detected. No geocoding, reprojection, clipping, simplification, routing, accessibility, density or performance analysis is performed.',
    'The transform preserves source orientation and aspect ratio. Increasing Y is not a verified north direction; projection distortion is not corrected.',
    'The target frame fits geometry coordinates. Symbol sizes and strokes are in paper points and can extend beyond its edges.',
  ];
  const elements: unknown[] = [];
  const featureMapping: { feature_id: string | number; feature_index: number; geometry_type: Geometry['type']; semantic_ids: string[] }[] = [];
  for (const [index, source] of params.geojson.features.entries()) {
    const chosen = overrides.get(idKey(source.id)) || params.default_style;
    if (!chosen) throw new Error(`Feature ${idKey(source.id)} has no explicit style.`);
    const mapping = { feature_id: source.id, feature_index: index, geometry_type: source.geometry.type, semantic_ids: [] as string[] };
    featureMapping.push(mapping);
    const append = (geometryFields: Record<string, unknown>) => {
      if (elements.length >= 200) throw new Error('Expanded site map exceeds 200 overlay elements. Multi geometries count once per part; split the dataset into coordinated batches.');
      const id = `map-f${index + 1}-p${mapping.semantic_ids.length + 1}`;
      mapping.semantic_ids.push(id);
      elements.push({ id, role: chosen.role, evidence_kind: chosen.evidence_kind, evidence: chosen.evidence,
        source_ref: params.source_ref, data_ref: `feature[${index}] id=${JSON.stringify(source.id)}`,
        opacity: chosen.opacity, ...geometryFields });
    };
    const addPoint = (p: Point) => append({ kind: 'marker', center: mapPoint(p), shape: chosen.point_shape, size_pt: chosen.point_size_pt, fill: chosen.fill || { type: 'none' }, stroke: chosen.stroke });
    const addLine = (points: Point[]) => {
      if (!chosen.stroke) throw new Error(`Line feature ${idKey(source.id)} requires an explicit stroke.`);
      append({ kind: 'route', points: points.map(mapPoint), stroke: chosen.stroke, arrow: 'none' });
    };
    const addPolygon = (rings: Point[][]) => {
      if (!chosen.fill) throw new Error(`Polygon feature ${idKey(source.id)} requires an explicit fill.`);
      const mapped = rings.map((points) => {
        const first = points[0], last = points[points.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) throw new Error(`Polygon feature ${idKey(source.id)} requires explicitly closed GeoJSON rings.`);
        return points.slice(0, -1).map(mapPoint);
      });
      if (mapped.length === 1) append({ kind: 'zone', points: mapped[0], fill: chosen.fill, stroke: chosen.stroke });
      else append({ kind: 'compound_zone', outer: mapped[0], holes: mapped.slice(1), fill: chosen.fill, stroke: chosen.stroke });
    };
    const g = source.geometry;
    switch (g.type) {
      case 'Point': addPoint(g.coordinates); break;
      case 'MultiPoint': g.coordinates.forEach(addPoint); break;
      case 'LineString': addLine(g.coordinates); break;
      case 'MultiLineString': g.coordinates.forEach(addLine); break;
      case 'Polygon': addPolygon(g.coordinates); break;
      case 'MultiPolygon': g.coordinates.forEach(addPolygon); break;
    }
  }
  const overlayParams = overlayInputSchema.parse({ expected_document: params.expected_document, artboard_index: params.artboard_index, batch_id: params.batch_id,
    layer_name: params.layer_name, layer_collision: params.layer_collision, elements });
  // Reuse all geometry, visibility, budget, provenance and metadata validations.
  const prepared = prepareOverlay(overlayParams);
  const metersPerUnit = params.source_coordinates.units === 'm' ? 1 : params.source_coordinates.units === 'ft' ? 0.3048 : 0.001;
  return {
    success: true, nothing_created: true, overlay_params: overlayParams, feature_mapping: featureMapping,
    calibration: {
      source_coordinates: params.source_coordinates, source_extent: extent, extent_basis: params.source_extent ? 'explicit' : 'collection_bbox', data_bbox: bbox,
      requested_frame: params.frame, actual_frame: actualFrame, target_coordinate_system: 'artboard-web', target_units: 'pt',
      scale_pt_per_source_unit: scale, x_source_origin: extent[0], y_source_origin: sourceUp ? extent[3] : extent[1], y_sign: sourceUp ? -1 : 1,
      transform: { x: 'left + (source_x - xmin) * scale', y: sourceUp ? 'top + (ymax - source_y) * scale' : 'top + (source_y - ymin) * scale' },
      nominal_scale_denominator: metersPerUnit * 72 / 0.0254 / scale,
      scale_note: 'Nominal ratio for declared planar coordinate units at 100% output size; not ground-survey accuracy. ft means international foot.',
    },
    counts: { source_features: params.geojson.features.length, source_positions: vertexCount, overlay_elements: elements.length, native_primitives: prepared.primitive_count },
    warnings: [...warnings, ...prepared.warnings],
  };
}

export function register(server: McpServer): void {
  server.registerTool('arch_prepare_site_map', {
    title: 'Prepare Calibrated Site Map Overlay',
    description: 'Read-only conversion of caller-supplied planar/projected GeoJSON-shaped FeatureCollection into validated arch_add_overlay parameters. Requires explicit CRS, linear units, Y direction and styles. Supports Point/MultiPoint, LineString/MultiLineString, Polygon/MultiPolygon including true courtyard holes. Uses one shared extent, uniform scale and centered artboard-web pt frame; rejects out-of-extent coordinates and recognized geographic CRS identifiers, but cannot detect mislabeled coordinates or verify arbitrary CRS names. Longitude/latitude must be projected externally. Returns source-feature-to-semantic-ID mapping and calibration; never reads or changes Illustrator, fetches data, reprojects, classifies properties, computes density, buffers, routes, isochrones or visibility. Point/stroke sizes are paper pt. Maximum 200 source features, 20000 source positions and 200 expanded elements. Inspect the returned overlay_params before explicitly calling arch_add_overlay.',
    inputSchema: siteMapInputSchema.shape,
    annotations: READ_ANNOTATIONS,
  }, async (input) => {
    try {
      return { content: [{ type: 'text' as const, text: JSON.stringify(prepareSiteMap(input)) }] };
    } catch (error) {
      return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({ success: false, nothing_created: true, stage: 'validation', message: error instanceof Error ? error.message : String(error) }) }] };
    }
  });
}
