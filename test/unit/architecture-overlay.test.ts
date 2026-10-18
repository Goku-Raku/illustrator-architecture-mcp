import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/executor/jsx-runner.js', () => ({
  executeJsx: vi.fn().mockResolvedValue({ success: true }),
  executeJsxHeavy: vi.fn().mockResolvedValue({ success: true }),
}));

import { executeJsx } from '../../src/executor/jsx-runner.js';
import { hatchSegments, OVERLAY_JSX, overlayInputSchema, prepareOverlay, register } from '../../src/tools/architecture/overlay.js';
import { makeApp, makeDoc, makeGroup, makeItem, makeLayer, makeTextFrame, runToolJsx, type Fake } from './helpers/fake-illustrator.js';

type P = [number, number];
const square: P[] = [[10, 20], [110, 20], [110, 120], [10, 120]];
const base = () => ({
  expected_document: { name: 'Site.ai' }, artboard_index: 0, batch_id: 'site-001',
  elements: [{ kind: 'zone', id: 'public', role: 'public-area', points: square, fill: '#CC8844', opacity: 30 }],
});
const lineStroke = { color: '#123456', width_pt: 1.25 };

function environment(options: { failAtPath?: number; ignoreWidth?: boolean; ignoreHandle?: boolean; ignoreEvenodd?: boolean; failRollback?: boolean; failTextMove?: boolean; invalidateTextAttributesOnTranslate?: boolean } = {}) {
  const originalLayer = makeLayer('Base');
  const raster = makeItem('RasterItem', { name: 'Fixed map', note: 'User note', locked: true, opacity: 85, geometricBounds: [100, 900, 400, 600] });
  originalLayer.addItem(raster);
  // Inherit the existing fake's live collection getters, while allowing this
  // test to provide Document.textFrames.add on its own collection.
  const doc = Object.create(makeDoc({ layers: [originalLayer], artboardRect: [100, 900, 400, 600] }));
  originalLayer.parent = doc;
  doc.name = 'Site.ai';
  doc.fullName = { fsName: 'C:\\Drawings\\Site.ai' };
  let pathCount = 0;
  const decorate = (container: Fake) => {
    const add = (item: Fake) => {
      item.parent = container;
      container.pageItems.push(item);
      return item;
    };
    container.groupItems = { add: () => {
      const group = add(makeGroup());
      decorate(group);
      return group;
    } };
    container.pathItems = { add: () => {
      pathCount++;
      if (pathCount === options.failAtPath) throw new Error('Injected Illustrator path failure');
      const item = add(makeItem('PathItem', {
        setEntirePath(points: number[][]) {
          this.points = points;
          this.pathPoints = points.map((p) => {
            const result = { anchor: [...p], leftDirection: [...p], rightDirection: [...p] };
            if (options.ignoreHandle) Object.defineProperty(result, 'rightDirection', { get: () => [...p], set: () => {} });
            return result;
          });
          this.geometricBounds = [Math.min(...points.map((p) => p[0])), Math.max(...points.map((p) => p[1])), Math.max(...points.map((p) => p[0])), Math.min(...points.map((p) => p[1]))];
        },
      }));
      if (options.ignoreWidth) Object.defineProperty(item, 'strokeWidth', { get: () => 99, set: () => {} });
      if (options.ignoreEvenodd) Object.defineProperty(item, 'evenodd', { get: () => false, set: () => {} });
      return item;
    } };
    container.compoundPathItems = { add: () => {
      const compound = add(makeGroup([], { typename: 'CompoundPathItem' }));
      decorate(compound);
      const addPath = compound.pathItems.add;
      compound.pathItems = Object.assign(compound.pageItems, { add: addPath });
      return compound;
    } };
    container.textFrames = { pointText: () => { throw new Error('Do not call pointText on GroupItem or Layer collections.'); } };
  };
  doc.layers.add = () => {
    const layer = makeLayer('');
    layer.parent = doc;
    layer.remove = () => {
      if (options.failRollback) throw new Error('Injected rollback failure');
      doc.layers.splice(doc.layers.indexOf(layer), 1);
    };
    decorate(layer);
    doc.layers.push(layer);
    doc.activeLayer = layer;
    return layer;
  };
  Object.defineProperty(doc, 'groupItems', { get: () => doc.pageItems.filter((item: Fake) => item.typename === 'GroupItem') });
  Object.defineProperty(doc, 'textFrames', { get: () => {
    const frames = doc.pageItems.filter((item: Fake) => item.typename === 'TextFrame');
    frames.pointText = () => { throw new Error('Do not use the pointText constructor.'); };
    frames.add = () => {
      if (doc.activeLayer === originalLayer) throw new Error('Text creation must target the new overlay layer.');
      const item = makeTextFrame({ creationLayer: doc.activeLayer, geometricBounds: [0, 10, 60, -2] });
      let staleAttributes = false;
      const originalAttributes = item.textRange.characterAttributes;
      if (options.invalidateTextAttributesOnTranslate) {
        item.textRange.characterAttributes = new Proxy(originalAttributes, {
          get(target, key) {
            if (staleAttributes) throw new Error('Stale native character-attributes reference after transform');
            return target[key];
          },
          set(target, key, value) {
            if (staleAttributes) throw new Error('Stale native character-attributes reference after transform');
            target[key] = value;
            return true;
          },
        });
      }
      let textAnchor: P = [0, 0];
      Object.defineProperty(item, 'anchor', {
        get: () => textAnchor,
        set: () => { throw new Error('Not implemented: anchor setter'); },
      });
      const originalTranslate = item.translate;
      item.translate = function (dx: number, dy: number) {
        this.styledBeforePosition = !!this.textRange.characterAttributes.textFont && this.textRange.characterAttributes.size > 0;
        originalTranslate.call(this, dx, dy);
        textAnchor = [textAnchor[0] + dx, textAnchor[1] + dy];
        if (options.invalidateTextAttributesOnTranslate) {
          staleAttributes = true;
          this.textRange.characterAttributes = { ...originalAttributes };
          this.attributeInvalidations = (this.attributeInvalidations || 0) + 1;
        }
      };
      const originalMove = item.move;
      item.move = function (target: Fake) {
        if (options.failTextMove) throw new Error('Injected text reparenting failure');
        this.styledBeforeMove = !!this.contents && !!this.textRange.characterAttributes.textFont && this.note.length > 36;
        originalMove.call(this, target);
      };
      item.parent = doc.activeLayer;
      doc.activeLayer.pageItems.push(item);
      return item;
    };
    return frames;
  } });
  const app = makeApp(doc, [{ name: 'ArialMT', family: 'Arial' }]);
  const run = (input: unknown) => runToolJsx(OVERLAY_JSX, prepareOverlay(input), app);
  return { doc, app, originalLayer, raster, run };
}

describe('architecture overlay validation and geometry', () => {
  it('preserves courtyard rings independent of winding and counts native compound members', () => {
    const outer: P[] = [[0, 0], [80, 0], [80, 60], [0, 60]];
    const hole: P[] = [[20, 20], [40, 20], [40, 40], [20, 40]];
    for (const holes of [[hole], [[...hole].reverse()]]) {
      const result = prepareOverlay({ ...base(), elements: [{ kind: 'compound_zone', id: 'c', role: 'built-footprint', outer, holes, fill: '#444444' }] });
      expect(result.prepared[0].parts[0]).toMatchObject({ type: 'compound_path', rings: [outer, ...holes] });
      expect(result.primitive_count).toBe(3);
    }
  });
  it('rejects touching, crossing, outside, self-crossing and nested holes before dispatch', () => {
    const outer: P[] = [[0, 0], [80, 0], [80, 60], [0, 60]];
    const hole: P[] = [[20, 20], [40, 20], [40, 40], [20, 40]];
    const cases = [
      [[[0, 20], [10, 20], [10, 30], [0, 30]]],
      [[[70, 20], [90, 20], [90, 30], [70, 30]]],
      [[[90, 20], [100, 20], [100, 30], [90, 30]]],
      [[[10, 10], [30, 30], [10, 30], [30, 10]]],
      [hole, [[25, 25], [35, 25], [35, 35], [25, 35]]],
      [hole, [[30, 30], [50, 30], [50, 50], [30, 50]]],
      [hole, [[40, 20], [50, 20], [50, 30], [40, 30]]],
    ];
    for (const holes of cases) expect(() => prepareOverlay({ ...base(), elements: [{ kind: 'compound_zone', id: 'c', role: 'built-footprint', outer, holes, fill: '#444444' }] })).toThrow();
  });
  it('detects a hole bridge crossing a concave exterior even when its vertices lie inside', () => {
    const outer = [[0, 0], [80, 0], [80, 80], [60, 80], [60, 20], [20, 20], [20, 80], [0, 80]];
    const holes = [[[10, 40], [70, 40], [70, 50], [10, 50]]];
    expect(() => prepareOverlay({ ...base(), elements: [{ kind: 'compound_zone', id: 'c', role: 'built-footprint', outer, holes, fill: '#444444' }] })).toThrow('strictly inside');
  });
  it('requires a document guard, explicit artboard, artboard-relative finite pt coordinates', () => {
    expect(overlayInputSchema.safeParse({ ...base(), expected_document: undefined }).success).toBe(false);
    expect(overlayInputSchema.safeParse({ ...base(), artboard_index: undefined }).success).toBe(false);
    expect(overlayInputSchema.safeParse({ ...base(), coordinate_system: 'document' }).success).toBe(false);
    expect(overlayInputSchema.safeParse({ ...base(), elements: [{ ...base().elements[0], points: [[Infinity, 1], [2, 3], [4, 5]] }] }).success).toBe(false);
    expect(overlayInputSchema.safeParse({ ...base(), frame: { pixel_width: 100 } }).success).toBe(false);
  });
  it('rejects duplicate semantic IDs, invalid opacity, line widths, colors and dash patterns', () => {
    expect(() => prepareOverlay({ ...base(), elements: [base().elements[0], base().elements[0]] })).toThrow('Duplicate semantic id');
    for (const value of [-1, 101, NaN]) expect(() => prepareOverlay({ ...base(), elements: [{ ...base().elements[0], opacity: value }] })).toThrow();
    for (const value of [-1, 0, 101, Infinity]) expect(() => prepareOverlay({ ...base(), elements: [{ kind: 'route', id: 'r', role: 'flow', points: [[0, 0], [20, 20]], stroke: { ...lineStroke, width_pt: value } }] })).toThrow();
    expect(() => prepareOverlay({ ...base(), elements: [{ ...base().elements[0], fill: '#fff' }] })).toThrow();
    expect(() => prepareOverlay({ ...base(), elements: [{ ...base().elements[0], stroke: { ...lineStroke, dash_pt: [0, 0] } }] })).toThrow();
  });
  it('rejects self-intersection, repeated closing vertices and adjacent edge backtracking', () => {
    for (const points of [
      [[0, 0], [20, 20], [0, 20], [20, 0]],
      [[0, 0], [20, 0], [20, 20], [0, 0]],
      [[0, 0], [20, 0], [10, 0], [10, 10], [0, 10]],
    ]) expect(() => prepareOverlay({ ...base(), elements: [{ ...base().elements[0], points }] })).toThrow();
  });
  it('rejects incomplete leader data and zero-length route segments before writing', () => {
    const label = { kind: 'label', id: 'l', role: 'annotation', anchor: [0, 0], text: 'A', font_name: 'ArialMT', fill: '#000000' };
    expect(() => prepareOverlay({ ...base(), elements: [{ ...label, leader_points: [[0, 0], [10, 10]] }] })).toThrow('leader_stroke');
    expect(() => prepareOverlay({ ...base(), elements: [{ ...label, leader_stroke: lineStroke }] })).toThrow('leader_points');
    expect(() => prepareOverlay({ ...base(), elements: [{ kind: 'route', id: 'r', role: 'flow', points: [[0, 0], [0, 0]], stroke: lineStroke }] })).toThrow('zero-length');
  });
  it('clips concave hatch scanlines into separate inside intervals, in either winding order', () => {
    const u: P[] = [[0, 0], [20, 0], [20, 20], [15, 20], [15, 5], [5, 5], [5, 20], [0, 20]];
    for (const points of [u, [...u].reverse()]) {
      const atTen = hatchSegments(points, 5, 0).filter((line) => line[0][1] === 10);
      expect(atTen).toEqual([[[0, 10], [5, 10]], [[15, 10], [20, 10]]]);
    }
  });
  it('diagonal hatch segment midpoints remain inside a concave polygon', () => {
    const u: P[] = [[0, 0], [20, 0], [20, 20], [15, 20], [15, 5], [5, 5], [5, 20], [0, 20]];
    const inside = (x: number, y: number) => x >= -1e-7 && x <= 20 + 1e-7 && y >= -1e-7 && y <= 20 + 1e-7 && (y <= 5 + 1e-7 || x <= 5 + 1e-7 || x >= 15 - 1e-7);
    for (const angle of [-45, 45, 90, 135]) for (const [a, b] of hatchSegments(u, 2, angle, 0.3)) {
      for (const t of [0.01, 0.25, 0.5, 0.75, 0.99]) expect(inside(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)).toBe(true);
    }
  });
  it('caps excessive hatch expansion before dispatch', () => {
    expect(() => prepareOverlay({ ...base(), elements: [{ kind: 'hatch', id: 'h', role: 'hatch', points: [[0, 0], [10000, 0], [10000, 10000], [0, 10000]], stroke: lineStroke, spacing_pt: 0.1 }] })).toThrow('scanlines');
  });
  it('creates editable solid vector arrowheads with correct start/end directions', () => {
    const prepared = prepareOverlay({ ...base(), elements: [{ kind: 'route', id: 'r', role: 'flow', points: [[0, 0], [20, 0]], stroke: lineStroke, arrow: 'both', arrow_length_pt: 6, arrow_width_pt: 4 }] });
    const parts = prepared.prepared[0].parts;
    expect(parts).toHaveLength(3);
    expect(parts[1].points).toEqual([[0, 0], [6, -2], [6, 2]]);
    expect(parts[2].points).toEqual([[20, 0], [14, 2], [14, -2]]);
    expect(parts[2].fill).toEqual({ type: 'rgb', r: 18, g: 52, b: 86 });
    expect(parts[2].stroke).toBeUndefined();
  });
  it('keeps legacy elements valid and adds caller-supplied provenance without claiming verification', () => {
    expect(prepareOverlay(base()).prepared[0].semantic.evidence_kind).toBeUndefined();
    const input = { ...base(), elements: [{ ...base().elements[0], evidence_kind: 'inferred', source_ref: ' map/site.pdf#page=2 ', data_ref: 'entry-survey:2026-10-09' }] };
    expect(prepareOverlay(input).prepared[0].semantic).toMatchObject({ evidence_kind: 'inferred', source_ref: 'map/site.pdf#page=2', data_ref: 'entry-survey:2026-10-09' });
    expect(overlayInputSchema.safeParse({ ...base(), elements: [{ ...input.elements[0], evidence_kind: 'verified' }] }).success).toBe(false);
    expect(overlayInputSchema.safeParse({ ...base(), elements: [{ ...input.elements[0], source_ref: ' ' }] }).success).toBe(false);
  });
  it('prepares cubic route handles and orients both arrows to curved endpoint tangents', () => {
    const result = prepareOverlay({ ...base(), elements: [{ kind: 'smooth_route', id: 'r', role: 'flow', start: [0, 0], segments: [{ control1: [0, 10], control2: [20, 10], end: [20, 0] }], stroke: lineStroke, arrow: 'both', arrow_length_pt: 6, arrow_width_pt: 4 }] });
    const parts = result.prepared[0].parts;
    expect(parts).toHaveLength(3);
    expect(parts[0].handles).toEqual([{ left: [0, 0], right: [0, 10] }, { left: [20, 10], right: [20, 0] }]);
    expect(parts[1].points).toEqual([[0, 0], [2, 6], [-2, 6]]);
    expect(parts[2].points).toEqual([[20, 0], [22, 6], [18, 6]]);
    expect(parts[0].fill).toEqual({ type: 'none' });
  });
  it('validates new shapes, finite controls, visible styles, degenerate cubics and sector sweeps before dispatch', () => {
    const smooth = { kind: 'smooth_route', id: 'r', role: 'flow', start: [0, 0], segments: [{ control1: [0, 10], control2: [20, 10], end: [20, 0] }], stroke: lineStroke };
    const marker = { kind: 'marker', id: 'm', role: 'entry', center: [0, 0], fill: '#000000' };
    const sector = { kind: 'sector', id: 's', role: 'view-direction', center: [0, 0], radius_pt: 20, start_degrees: 0, end_degrees: 90, fill: '#000000' };
    const invalid = [
      { ...smooth, segments: [] },
      { ...smooth, segments: [{ control1: [Infinity, 0], control2: [20, 10], end: [20, 0] }] },
      { ...smooth, segments: [{ control1: [0, 0], control2: [0, 0], end: [0, 0] }] },
      { ...marker, shape: 'unknown' }, { ...marker, size_pt: 0 }, { ...marker, size_pt: NaN },
      { ...marker, fill: { type: 'none' } },
      { ...sector, radius_pt: 0 }, { ...sector, end_degrees: 0 }, { ...sector, end_degrees: 361 },
    ];
    for (const element of invalid) expect(() => prepareOverlay({ ...base(), elements: [element] })).toThrow();
    const result = prepareOverlay({ ...base(), elements: [{ ...marker, fill: { type: 'none' }, stroke: lineStroke }, sector] });
    expect(result.primitive_count).toBe(2);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('no obstacle clipping');
  });
  it('counts cubic control points and label leaders against the input budget', () => {
    const smooth = (id: string) => ({ kind: 'smooth_route', id, role: 'flow', start: [0, 0], segments: Array.from({ length: 333 }, (_, i) => ({ control1: [i + 0.2, 10], control2: [i + 0.8, 10], end: [i + 1, 0] })), stroke: lineStroke, arrow: 'none' });
    expect(prepareOverlay({ ...base(), elements: Array.from({ length: 20 }, (_, i) => smooth(`r${i}`)) }).primitive_count).toBe(20);
    expect(() => prepareOverlay({ ...base(), elements: Array.from({ length: 21 }, (_, i) => smooth(`r${i}`)) })).toThrow('20000 input vertices');
    const labels = Array.from({ length: 21 }, (_, i) => ({ kind: 'label', id: `l${i}`, role: 'label', anchor: [0, 0], font_name: 'ArialMT', text: 'A', fill: '#000000', leader_points: Array.from({ length: 1000 }, (_, j) => [j, j]), leader_stroke: lineStroke }));
    expect(() => prepareOverlay({ ...base(), elements: labels })).toThrow('20000 input vertices');
  });
  it('bounds expanded primitive count and semantic-note size with the new fields', () => {
    const hatch = (id: string) => ({ kind: 'hatch', id, role: 'hatch', points: [[0, 0], [2000, 0], [2000, 2000], [0, 2000]], stroke: lineStroke, spacing_pt: 1, angle_degrees: 0 });
    expect(() => prepareOverlay({ ...base(), elements: [hatch('a'), hatch('b'), hatch('c')] })).toThrow('5000 native objects');
    expect(() => prepareOverlay({ ...base(), elements: [{ ...base().elements[0], evidence: '\\'.repeat(4000), source_ref: '\\'.repeat(2000), data_ref: '\\'.repeat(2000) }] })).toThrow('safe note budget');
    expect(() => prepareOverlay({ ...base(), elements: [{ ...base().elements[0], evidence: '\b'.repeat(3000) }] })).toThrow('safe note budget');
  });
});

describe('architecture overlay Illustrator transaction', () => {
  it('creates a true even-odd compound path with shared style and container opacity', () => {
    const env = environment();
    const result = env.run({ ...base(), elements: [{ kind: 'compound_zone', id: 'courtyard', role: 'built-footprint', outer: square,
      holes: [[[30, 40], [70, 40], [70, 80], [30, 80]]], fill: '#444444', stroke: lineStroke, opacity: 45 }] });
    expect(result.success).toBe(true);
    const compound = env.doc.pageItems.find((item: Fake) => item.typename === 'CompoundPathItem');
    expect(compound.pathItems).toHaveLength(2);
    expect(compound.opacity).toBe(45);
    for (const member of compound.pathItems) {
      expect(member.evenodd).toBe(true);
      expect(member.closed).toBe(true);
      expect(member.opacity).toBe(100);
      expect(member.strokeWidth).toBe(1.25);
    }
    expect(compound.pathItems[1].points).toEqual([[130, 860], [170, 860], [170, 820], [130, 820]]);
    expect(result.elements[0].components[0]).toMatchObject({ type: 'compound_path', actual_style: { fill_rule: 'evenodd', ring_count: 2, opacity: 45 } });
    expect(env.originalLayer.pageItems).toEqual([env.raster]);
  });
  it('rolls back a native compound path when even-odd assignment is ignored', () => {
    const env = environment({ ignoreEvenodd: true });
    const result = env.run({ ...base(), elements: [{ kind: 'compound_zone', id: 'courtyard', role: 'built-footprint', outer: square,
      holes: [[[30, 40], [70, 40], [70, 80], [30, 80]]], fill: '#444444' }] });
    expect(result).toMatchObject({ success: false, stage: 'verify_compound_path', rolled_back: true });
    expect(result.message).toContain('even-odd');
    expect(env.doc.pageItems).toEqual([env.raster]);
  });
  it('rejects the wrong active document or path with no created objects', () => {
    const env = environment();
    expect(env.run({ ...base(), expected_document: { name: 'Wrong.ai' } }).success).toBe(false);
    expect(env.run({ ...base(), expected_document: { name: 'Site.ai', path: 'C:\\Other\\Site.ai' } }).success).toBe(false);
    expect(env.doc.layers).toHaveLength(1);
    expect(env.doc.pageItems).toEqual([env.raster]);
  });
  it('accepts equivalent Windows path separators and casing, and rejects invalid artboards', () => {
    const env = environment();
    expect(env.run({ ...base(), artboard_index: 2 }).success).toBe(false);
    expect(env.doc.layers).toHaveLength(1);
    expect(env.run({ ...base(), expected_document: { name: 'Site.ai', path: 'c:/drawings/site.ai' } }).success).toBe(true);
  });
  it('preflights all fonts before writing even if the bad label is last', () => {
    const env = environment();
    const result = env.run({ ...base(), elements: [...base().elements, { kind: 'label', id: 'l', role: 'annotation', anchor: [20, 20], text: 'Test', fill: '#000000', font_name: 'MissingFont' }] });
    expect(result.message).toContain('Font not found');
    expect(env.doc.layers).toHaveLength(1);
  });
  it('adds a separate layer and semantic groups, maps coordinates and reports actual styles', () => {
    const env = environment();
    const originalNote = env.raster.note;
    const result = env.run(base());
    expect(result.success).toBe(true);
    expect(result.primitive_count).toBe(1);
    const nativePath = env.doc.pathItems[0];
    expect(nativePath.points).toEqual([[110, 880], [210, 880], [210, 780], [110, 780]]);
    expect(result.elements[0].components[0].actual_style).toMatchObject({ fill: { type: 'rgb', r: 204, g: 136, b: 68 }, opacity: 30, closed: true });
    expect(nativePath.note.substring(0, 36)).toBe(result.elements[0].components[0].uuid);
    expect(JSON.parse(nativePath.note.substring(37)).architectureMcp).toMatchObject({ batch_id: 'site-001', semantic_id: 'public', role: 'public-area', component: 'zone' });
    expect(env.raster.note).toBe(originalNote);
    expect(env.raster.locked).toBe(true);
    expect(env.raster.opacity).toBe(85);
    expect(env.doc.activeLayer).toBe(env.originalLayer);
  });
  it('writes editable native control handles, maps Y correctly and persists provenance on groups and paths', () => {
    const env = environment();
    const result = env.run({ ...base(), elements: [
      { kind: 'smooth_route', id: 'r', role: 'flow', evidence_kind: 'proposed', source_ref: 'site.pdf#page=1', data_ref: 'option-A', start: [10, 20], segments: [{ control1: [10, 40], control2: [90, 40], end: [90, 20] }], stroke: lineStroke, arrow: 'none' },
      { kind: 'marker', id: 'm', role: 'entry', center: [50, 50], size_pt: 12, shape: 'circle', fill: '#334455' },
      { kind: 'sector', id: 's', role: 'view-direction', center: [50, 50], radius_pt: 20, start_degrees: 0, end_degrees: 90, fill: '#334455' },
    ] });
    expect(result.success).toBe(true);
    expect(result.primitive_count).toBe(3);
    const path = env.doc.pathItems[0];
    expect(path.pathPoints).toEqual([
      { anchor: [110, 880], leftDirection: [110, 880], rightDirection: [110, 860] },
      { anchor: [190, 880], leftDirection: [190, 860], rightDirection: [190, 880] },
    ]);
    for (const item of [path, path.parent]) expect(JSON.parse(item.note.substring(37)).architectureMcp).toMatchObject({ evidence_kind: 'proposed', source_ref: 'site.pdf#page=1', data_ref: 'option-A' });
    expect(env.doc.pathItems[1].pathPoints).toHaveLength(4);
    expect(env.doc.pathItems[1].closed).toBe(true);
    expect(env.doc.pathItems[2].pathPoints).toHaveLength(3);
    expect(env.doc.pathItems[2].closed).toBe(true);
    expect(env.originalLayer.pageItems).toEqual([env.raster]);
  });
  it('rolls back a curve when native control-handle assignments are ignored', () => {
    const env = environment({ ignoreHandle: true });
    const result = env.run({ ...base(), elements: [{ kind: 'marker', id: 'm', role: 'entry', center: [50, 50], shape: 'circle', fill: '#334455' }] });
    expect(result.success).toBe(false);
    expect(result.message).toContain('did not retain the requested Bezier geometry');
    expect(result.stage).toBe('verify_path_handles');
    expect(result.rolled_back).toBe(true);
    expect(env.doc.layers).toHaveLength(1);
    expect(env.doc.pageItems).toEqual([env.raster]);
  });
  it('creates labels with an exact installed font, baseline positioning and a separate leader', () => {
    const env = environment();
    const result = env.run({ ...base(), elements: [{ kind: 'label', id: 'l', role: 'annotation', anchor: [20, 40], text: 'Access\n入口', fill: '#333333', font_name: 'ArialMT', font_size_pt: 12, alignment: 'right', leader_points: [[0, 0], [20, 40]], leader_stroke: lineStroke }] });
    expect(result.success).toBe(true);
    expect(result.elements[0].components).toHaveLength(2);
    expect(env.doc.textFrames[0].anchor).toEqual([120, 860]);
    expect(env.doc.textFrames[0].contents).toBe('Access\r入口');
    expect(env.doc.textFrames[0].creationLayer.name).toBe('Architecture Analysis');
    expect(env.doc.textFrames[0].parent.name).toBe('l');
    expect(env.doc.textFrames[0].styledBeforeMove).toBe(true);
    expect(env.doc.textFrames[0].styledBeforePosition).toBe(true);
    expect(env.originalLayer.pageItems).toEqual([env.raster]);
    expect(result.elements[0].components[1].actual_style).toMatchObject({ font_name: 'ArialMT', font_size_pt: 12, alignment: 'right' });
  });
  it('rejects duplicate batch IDs without modifying the existing batch', () => {
    const env = environment();
    expect(env.run(base()).success).toBe(true);
    const before = env.doc.pageItems.map((i: Fake) => [i.name, i.note]);
    const result = env.run({ ...base(), layer_name: 'Different layer' });
    expect(result.message).toContain('batch_id already exists');
    expect(env.doc.pageItems.map((i: Fake) => [i.name, i.note])).toEqual(before);
    expect(env.doc.layers).toHaveLength(2);
  });
  it('reacquires native character attributes after translating a text frame', () => {
    const env = environment({ invalidateTextAttributesOnTranslate: true });
    const result = env.run({ ...base(), elements: [{ kind: 'label', id: 'l', role: 'annotation', anchor: [20, 40], text: 'Access', fill: '#333333', font_name: 'ArialMT', font_size_pt: 10 }] });
    expect(result.success).toBe(true);
    expect(env.doc.textFrames[0].attributeInvalidations).toBe(1);
    expect(result.elements[0].components[0].actual_style).toMatchObject({ font_name: 'ArialMT', font_size_pt: 10, opacity: 100 });
  });
  it('recognizes a renamed batch through semantic metadata including appended patch tags', () => {
    const env = environment();
    env.run(base());
    for (const item of env.doc.groupItems) item.name = 'Renamed';
    env.doc.groupItems[0].note += '::ai-mcp:arch_semantic=%7B%7D';
    expect(env.run({ ...base(), layer_name: 'Other' }).message).toContain('batch_id already exists');
  });
  it('never executes arbitrary script embedded in existing Illustrator notes', () => {
    const env = environment();
    const malicious = makeGroup([], { name: 'Existing user group', note: '{"architectureMcp": (function(){ app.activeDocument.name="Injected.ai"; return {}; })()}' });
    env.originalLayer.addItem(malicious);
    const result = env.run(base());
    expect(result.success).toBe(true);
    expect(env.doc.name).toBe('Site.ai');
    expect(malicious.note).toContain('function()');
  });
  it('reads escaped quotes, backslashes and Unicode in legitimate semantic notes', () => {
    const env = environment();
    env.run({ ...base(), elements: [{ ...base().elements[0], role: '流线 "traffic"', evidence: 'C:\\Maps\\区域图.png\n观察' }] });
    for (const item of env.doc.groupItems) item.name = 'Renamed';
    // Remove the batch marker so this check specifically reads element metadata.
    env.doc.groupItems[0].note = 'ordinary note';
    expect(env.run({ ...base(), layer_name: 'Other' }).message).toContain('batch_id already exists');
  });
  it('fails on layer name collisions by default and suffixes only when requested', () => {
    const env = environment();
    expect(env.run({ ...base(), layer_name: 'Base' }).success).toBe(false);
    expect(env.doc.layers).toHaveLength(1);
    const result = env.run({ ...base(), layer_name: 'Base', layer_collision: 'suffix' });
    expect(result.layer_name).toBe('Base (2)');
    expect(env.originalLayer.pageItems).toEqual([env.raster]);
  });
  it('rolls back only the newly created layer after a mid-batch Illustrator failure', () => {
    const env = environment({ failAtPath: 2 });
    const result = env.run({ ...base(), elements: [base().elements[0], { ...base().elements[0], id: 'second' }] });
    expect(result.success).toBe(false);
    expect(result.rolled_back).toBe(true);
    expect(result.message).toContain('Injected Illustrator');
    expect(env.doc.layers).toHaveLength(1);
    expect(env.doc.pageItems).toEqual([env.raster]);
    expect(env.doc.activeLayer).toBe(env.originalLayer);
  });
  it('removes a document-created text frame along with the new layer if reparenting fails', () => {
    const env = environment({ failTextMove: true });
    const result = env.run({ ...base(), elements: [{ kind: 'label', id: 'l', role: 'annotation', anchor: [20, 40], text: 'Access', fill: '#333333', font_name: 'ArialMT' }] });
    expect(result.message).toContain('text reparenting failure');
    expect(result.rolled_back).toBe(true);
    expect(env.doc.textFrames).toHaveLength(0);
    expect(env.doc.layers).toHaveLength(1);
    expect(env.originalLayer.pageItems).toEqual([env.raster]);
    expect(env.doc.activeLayer).toBe(env.originalLayer);
  });
  it('detects ignored style assignments and rolls back rather than reporting false success', () => {
    const env = environment({ ignoreWidth: true });
    const result = env.run({ ...base(), elements: [{ kind: 'boundary', id: 'b', role: 'site-boundary', points: square, stroke: lineStroke }] });
    expect(result.message).toContain('did not retain');
    expect(result.rolled_back).toBe(true);
    expect(env.doc.layers).toHaveLength(1);
  });
  it('reports incomplete rollback and does not hide a remaining new layer', () => {
    const env = environment({ failAtPath: 2, failRollback: true });
    const result = env.run({ ...base(), elements: [base().elements[0], { ...base().elements[0], id: 'second' }] });
    expect(result.success).toBe(false);
    expect(result.rolled_back).toBe(false);
    expect(result.rollback_error).toContain('rollback failure');
    expect(result.warnings[0]).toContain('Partial new overlay');
    expect(env.originalLayer.pageItems).toEqual([env.raster]);
  });
});

describe('architecture overlay MCP registration', () => {
  beforeEach(() => vi.mocked(executeJsx).mockClear());
  it('returns MCP errors for invalid batches without dispatching JSX', async () => {
    let handler: (params: unknown) => Promise<Fake> = async () => undefined;
    register({ registerTool: (_name: string, _config: unknown, fn: typeof handler) => { handler = fn; } } as unknown as McpServer);
    const result = await handler({ ...base(), elements: [base().elements[0], base().elements[0]] });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text)).toMatchObject({ stage: 'validation', outcome_unknown: false, nothing_created: true });
    expect(executeJsx).not.toHaveBeenCalled();
  });
  it('dispatches precomputed native geometry with explicit coordinates', async () => {
    let handler: (params: unknown) => Promise<Fake> = async () => undefined;
    register({ registerTool: (_name: string, _config: unknown, fn: typeof handler) => { handler = fn; } } as unknown as McpServer);
    await handler(base());
    expect(executeJsx).toHaveBeenCalledOnce();
    expect(vi.mocked(executeJsx).mock.calls[0][1]).toMatchObject({ coordinate_system: 'artboard-web', primitive_count: 1 });
  });
  it('reports transport failure as an unknown outcome and warns against blind retry', async () => {
    let handler: (params: unknown) => Promise<Fake> = async () => undefined;
    register({ registerTool: (_name: string, _config: unknown, fn: typeof handler) => { handler = fn; } } as unknown as McpServer);
    vi.mocked(executeJsx).mockRejectedValueOnce(new Error('RPC_E_SERVERFAULT'));
    const result = await handler(base());
    expect(result.isError).toBe(true);
    const detail = JSON.parse(result.content[0].text);
    expect(detail).toMatchObject({ stage: 'transport', outcome_unknown: true, batch_id: 'site-001' });
    expect(detail.retry_advice).toContain('Do not retry automatically');
    expect(detail.nothing_created).toBeUndefined();
    expect(detail.rolled_back).toBeUndefined();
  });
  it('preserves rollback evidence when Illustrator returned a concrete script error', async () => {
    let handler: (params: unknown) => Promise<Fake> = async () => undefined;
    register({ registerTool: (_name: string, _config: unknown, fn: typeof handler) => { handler = fn; } } as unknown as McpServer);
    const failure = Object.assign(new Error('Native assignment rejected'), { name: 'JsxToolError', result: { error: true, success: false, rolled_back: true, rollback_error: null, message: 'Native assignment rejected' } });
    vi.mocked(executeJsx).mockRejectedValueOnce(failure);
    const result = await handler(base());
    expect(JSON.parse(result.content[0].text)).toMatchObject({ stage: 'illustrator', outcome_unknown: false, rolled_back: true, rollback_error: null });
  });
});
