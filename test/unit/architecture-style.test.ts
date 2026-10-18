import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runJsxCode } from './helpers/run-tool-jsx.js';

vi.mock('../../src/executor/jsx-runner.js', () => ({ executeJsx: vi.fn().mockResolvedValue({}), executeJsxHeavy: vi.fn().mockResolvedValue({}) }));
import { executeJsx } from '../../src/executor/jsx-runner.js';
import { register } from '../../src/tools/architecture/style.js';

type Item = Record<string, any>;
type Handler = (params: any) => Promise<any>;
const captured: Record<string, { schema: z.ZodObject<any>; handler: Handler; annotations: Item; description: string }> = {};
register({ registerTool(name: string, config: { inputSchema: any; annotations: Item; description: string }, handler: Handler) {
  captured[name] = { schema: z.object(config.inputSchema), handler, annotations: config.annotations, description: config.description };
} } as unknown as McpServer);

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const rgb = (r: number, g: number, b: number) => ({ typename: 'RGBColor', red: r, green: g, blue: b });
const paint = { type: 'rgb', r: 24, g: 88, b: 124 };

function path(uuid = A, extra: Item = {}): Item {
  return {
    typename: 'PathItem', name: 'Route', note: uuid, opacity: 100, blendingMode: 'NORMAL',
    filled: false, fillColor: rgb(255, 255, 255), stroked: true, strokeColor: rgb(0, 0, 0),
    strokeWidth: 1, strokeDashes: [], strokeDashOffset: 0, strokeCap: 'BUTT', strokeJoin: 'MITER',
    closed: false, clipping: false, guides: false, locked: false, hidden: false,
    geometricBounds: [0, 100, 100, 0], pathPoints: [{ anchor: [0, 100], leftDirection: [0, 100], rightDirection: [0, 100] }],
    ...extra,
  };
}
function doc(items: Item[], layerExtra: Item = {}): Item {
  const document: Item = { typename: 'Document', name: 'Site.ai', fullName: { fsName: 'C:\\Drawings\\Site.ai' }, documentColorSpace: 'RGB', layers: [] };
  const layer: Item = { typename: 'Layer', name: 'Analysis', visible: true, locked: false, pageItems: items, parent: document, ...layerExtra };
  document.layers = [layer];
  for (const item of items) item.parent = layer;
  return document;
}
function text(uuid = B): Item {
  const characters = [0, 1].map((i) => ({ characterAttributes: { fillColor: rgb(i * 255, 0, 0), strokeColor: rgb(0, 0, 0), strokeWeight: 1 } }));
  const aggregate: Item = {};
  for (const key of ['fillColor', 'strokeColor', 'strokeWeight']) {
    Object.defineProperty(aggregate, key, { enumerable: true, get: () => characters[0].characterAttributes[key as keyof typeof characters[0]['characterAttributes']], set: (value) => {
      for (const char of characters) (char.characterAttributes as Item)[key] = value;
    } });
  }
  return { typename: 'TextFrame', name: 'Entry', note: uuid, opacity: 100, blendingMode: 'NORMAL', contents: '入口', geometricBounds: [10, 20, 30, 0], textRange: { characterAttributes: aggregate }, characters };
}
function group(children: Item[], uuid = C): Item {
  const out = { typename: 'GroupItem', name: 'Route group', note: uuid, opacity: 100, blendingMode: 'NORMAL', geometricBounds: [0, 100, 100, 0], pageItems: children };
  for (const child of children) child.parent = out;
  return out;
}
async function run(name: string, params: Item, document: Item): Promise<Item> {
  const parsed = captured[name].schema.parse(params);
  await captured[name].handler(parsed);
  const mock = vi.mocked(executeJsx);
  const call = mock.mock.calls[mock.mock.calls.length - 1];
  return runJsxCode(call[0], {
    app: { activeDocument: document, documents: [document], version: '30.0' },
    StrokeCap: { BUTTENDCAP: 'BUTT', ROUNDENDCAP: 'ROUND', PROJECTINGENDCAP: 'PROJECTING' },
    StrokeJoin: { MITERENDJOIN: 'MITER', ROUNDENDJOIN: 'ROUND', BEVELENDJOIN: 'BEVEL' },
    BlendModes: { NORMAL: 'NORMAL', MULTIPLY: 'MULTIPLY', SCREEN: 'SCREEN' },
    DocumentColorSpace: { RGB: 'RGB', CMYK: 'CMYK' },
    RGBColor: function (this: Item) { this.typename = 'RGBColor'; },
    CMYKColor: function (this: Item) { this.typename = 'CMYKColor'; },
    GrayColor: function (this: Item) { this.typename = 'GrayColor'; },
    NoColor: function (this: Item) { this.typename = 'NoColor'; },
  }, call[1] as Item);
}
const apply = (edits: Item[], extra: Item = {}) => ({ expected_document: { name: 'Site.ai' }, edits, dry_run: false, ...extra });
const edit = (uuid = A, style: Item = { stroke_width: 2 }) => ({ uuid, style });

beforeEach(() => vi.mocked(executeJsx).mockReset().mockResolvedValue({}));

describe('architecture style failure response contract', () => {
  async function failure(params: Item, reason: unknown) {
    vi.mocked(executeJsx).mockRejectedValueOnce(reason);
    const response = await captured.arch_style_elements.handler(captured.arch_style_elements.schema.parse(params));
    expect(response.isError).toBe(true);
    expect(executeJsx).toHaveBeenCalledTimes(1);
    return JSON.parse(response.content[0].text);
  }

  it.each([true, false])('preserves concrete rollback evidence when rollback_complete is %s', async (complete) => {
    const concrete = {
      error: true, success: false, phase: 'apply', message: 'Readback mismatch for stroke_width',
      document: { name: 'Site.ai', path: 'C:/Drawings/Site.ai' },
      partial: !complete, attempted: [B, A], changed: complete ? [] : [A], changed_count: complete ? 0 : 1,
      rollback_complete: complete,
      rollback_errors: complete ? [] : [{ uuid: A, message: 'Rollback readback differs from snapshot.' }],
      retry_advice: complete ? 'No residual changes detected. Inspect the error before retrying.' : 'Do not blindly retry. Inspect changed UUIDs and recover the document state first.',
    };
    const result = await failure(apply([edit(), edit(B)]), Object.assign(new Error(concrete.message), { name: 'JsxToolError', result: concrete }));
    expect(result).toMatchObject(concrete);
    expect(result).toMatchObject({ stage: 'illustrator', outcome_unknown: false, expected_document: { name: 'Site.ai' }, target_uuids: [A, B], dry_run: false });
    expect(result).not.toHaveProperty('changes_possible');
  });

  it('preserves explicit preflight rejection details without inventing rollback results', async () => {
    const concrete = { error: true, success: false, phase: 'preflight', partial: false, changed: [], changed_count: 0, issues: [{ uuid: A, reason: 'Object or ancestor is locked.' }] };
    const result = await failure(apply([edit()]), Object.assign(new Error('Batch rejected'), { name: 'JsxToolError', result: concrete }));
    expect(result).toMatchObject({ ...concrete, outcome_unknown: false });
    expect(result).not.toHaveProperty('rollback_complete');
  });

  it.each([new Error('Illustrator request timed out'), 'Connection closed'])('reports uncertain apply outcomes and every requested UUID after %s', async (reason) => {
    const params = apply([edit(), edit(B)], { expected_document: { name: 'Site.ai', path: 'C:/Drawings/Site.ai' } });
    const result = await failure(params, reason);
    expect(result).toMatchObject({
      error: true, success: false, stage: 'transport', outcome_unknown: true, dry_run: false, changes_possible: true,
      expected_document: params.expected_document, target_uuids: [A, B],
    });
    expect(result.retry_advice).toContain('Do not retry automatically');
    expect(result.retry_advice).toContain('operation has finished');
    for (const field of ['changed', 'changed_count', 'partial', 'rollback_complete', 'rollback_errors']) expect(result).not.toHaveProperty(field);
  });

  it('distinguishes failed dry-run validation from a possibly modified document', async () => {
    const result = await failure({ expected_document: { name: 'Site.ai' }, edits: [edit()] }, new Error('Connection lost during preflight'));
    expect(result).toMatchObject({ stage: 'transport', outcome_unknown: true, dry_run: true, changes_possible: false, target_uuids: [A] });
    expect(result.retry_advice).toContain('does not write styles or notes');
    expect(result.retry_advice).toContain('Do not proceed to apply');
    expect(result).not.toHaveProperty('rollback_complete');
  });
});

describe('architecture style batch', () => {
  it('round-trips provenance and preserves it across subsequent partial semantic edits', async () => {
    const item = path();
    const document = doc([item]);
    const provenance = { evidence_kind: 'supplied', source_ref: 'brief v3, page 4', data_ref: 'opening-hours.csv:community' };
    const first = await run('arch_style_elements', apply([edit(A, { semantic: provenance })]), document);
    expect(first.success).toBe(true);
    expect(first.verified[0].semantic).toEqual(provenance);
    const second = await run('arch_style_elements', apply([edit(A, { semantic: { role: 'night_entry' } })]), document);
    expect(second.verified[0].semantic).toEqual({ ...provenance, role: 'night_entry' });
    const inspected = await run('arch_inspect_elements', { uuids: [A] }, document);
    expect(inspected.elements[0].semantic).toEqual({ ...provenance, role: 'night_entry' });
  });

  it('defaults to a no-write dry run and previews exact requested changes', async () => {
    const item = path();
    const result = await run('arch_style_elements', { expected_document: { name: 'Site.ai' }, edits: [edit()] }, doc([item]));
    expect(result).toMatchObject({ success: true, dry_run: true, changed: [], changed_count: 0 });
    expect(result.planned[0]).toMatchObject({ uuid: A, before: { style: { stroke_width: 1 } }, requested: { stroke_width: 2 } });
    expect(item.strokeWidth).toBe(1);
    expect(item.note).toBe(A);
  });

  it('sets and reads back stroke details, fill, opacity, blend and semantic patch', async () => {
    const originalNote = A + ' user notes::ai-mcp:rot=42';
    const item = path(A, { note: originalNote });
    const style = { fill: paint, stroke: paint, stroke_width: 2.5, opacity: 46, dashes: [7, 3], dash_offset: 1.5, cap: 'round', join: 'bevel', blending: 'multiply', semantic: { role: 'pedestrian_flow', evidence: 'Design proposal; route traced over base image.', confidence: 0.6 } };
    const result = await run('arch_style_elements', apply([edit(A, style)]), doc([item]));
    expect(result).toMatchObject({ success: true, partial: false, changed: [A], changed_count: 1 });
    const { semantic, ...expectedStyle } = style;
    expect(result.verified[0].style).toMatchObject(expectedStyle);
    expect(result.verified[0].semantic).toEqual(style.semantic);
    expect(item.note.startsWith(originalNote)).toBe(true);
    expect(item.note).toContain('::ai-mcp:arch_semantic=');
  });

  it('validates expected name and path before resolving or styling objects', async () => {
    const item = path();
    for (const expected of [{ name: 'Wrong.ai' }, { name: 'Site.ai', path: 'C:/Other/Site.ai' }]) {
      const result = await run('arch_style_elements', apply([edit()], { expected_document: expected }), doc([item]));
      expect(result).toMatchObject({ success: false, phase: 'preflight', changed: [], partial: false });
      expect(item.strokeWidth).toBe(1);
    }
    const result = await run('arch_style_elements', apply([edit()], { expected_document: { name: 'Site.ai', path: 'c:/drawings/site.ai' } }), doc([item]));
    expect(result.success).toBe(true);
  });

  it('rejects all edits when any UUID is missing', async () => {
    const item = path();
    const result = await run('arch_style_elements', apply([edit(), edit(B)]), doc([item]));
    expect(result).toMatchObject({ success: false, phase: 'preflight', changed: [], partial: false });
    expect(result.issues[0]).toMatchObject({ uuid: B, reason: 'UUID was not found.' });
    expect(item.strokeWidth).toBe(1);
  });

  it('rejects duplicate request IDs and duplicate persistent IDs', async () => {
    const item = path();
    const repeated = await run('arch_style_elements', apply([edit(), edit()]), doc([item]));
    expect(repeated.issues[0].reason).toContain('repeated');
    const duplicate = await run('arch_style_elements', apply([edit()]), doc([item, path()]));
    expect(duplicate.issues[0].reason).toContain('multiple');
    expect(item.strokeWidth).toBe(1);
  });

  it.each([
    [{ locked: true }, 'locked'], [{ hidden: true }, 'hidden'], [{ clipping: true }, 'Clipping'], [{ guides: true }, 'Guides'],
  ])('protects special leaves: %o', async (props, reason) => {
    const item = path(A, props);
    const result = await run('arch_style_elements', apply([edit()]), doc([item]));
    expect(result.issues[0].reason).toContain(reason);
    expect(item.strokeWidth).toBe(1);
  });

  it('protects locked or hidden ancestors and a hidden layer', async () => {
    for (const props of [{ locked: true }, { hidden: true }]) {
      const item = path(), parent = group([item]);
      Object.assign(parent, props);
      const result = await run('arch_style_elements', apply([edit()]), doc([parent]));
      expect(result.success).toBe(false);
      expect(item.strokeWidth).toBe(1);
    }
    expect((await run('arch_style_elements', apply([edit()]), doc([path()], { visible: false }))).success).toBe(false);
  });

  it('refuses group/raster edits and shared compound member appearance', async () => {
    for (const type of ['GroupItem', 'PlacedItem', 'RasterItem']) {
      const item = type === 'GroupItem' ? group([path()], B) : path(B, { typename: type });
      const result = await run('arch_style_elements', apply([edit(B, { opacity: 50 })]), doc([item]));
      expect(result.issues[0].reason).toContain('leaves');
      expect(item.opacity).toBe(100);
    }
    const item = path();
    const compound: Item = { typename: 'CompoundPathItem', note: B, pathItems: [item] };
    item.parent = compound;
    expect((await run('arch_style_elements', apply([edit()]), doc([compound]))).issues[0].reason).toContain('share appearance');
  });

  it('rejects text dashes before any paint is applied', async () => {
    const item = text();
    const result = await run('arch_style_elements', apply([edit(B, { fill: paint, dashes: [4, 2] })]), doc([item]));
    expect(result.issues[0].reason).toContain('only apply to PathItem');
    expect(item.characters[1].characterAttributes.fillColor.red).toBe(255);
  });

  it('styles all text characters, preserves contents, and verifies each character', async () => {
    const item = text();
    const result = await run('arch_style_elements', apply([edit(B, { fill: paint, stroke_width: 0.5 })]), doc([item]));
    expect(result.success).toBe(true);
    expect(item.contents).toBe('入口');
    expect(item.characters.map((c: Item) => c.characterAttributes.fillColor.red)).toEqual([24, 24]);
  });

  it('rolls back the failing object and earlier edits after a setter failure', async () => {
    const one = path(), two = path(B);
    let opacity = 100;
    Object.defineProperty(two, 'opacity', { get: () => opacity, set: (value) => { if (value === 30) throw new Error('host refused'); opacity = value; } });
    const result = await run('arch_style_elements', apply([edit(), edit(B, { stroke_width: 4, opacity: 30 })]), doc([one, two]));
    expect(result).toMatchObject({ success: false, phase: 'apply', partial: false, changed: [], rollback_complete: true });
    expect(one.strokeWidth).toBe(1);
    expect(two.strokeWidth).toBe(1);
  });

  it('detects a silently ignored setting and rolls back the batch', async () => {
    const item = path();
    Object.defineProperty(item, 'strokeWidth', { get: () => 1, set: () => {} });
    const result = await run('arch_style_elements', apply([edit(A, { opacity: 25, stroke_width: 3 })]), doc([item]));
    expect(result).toMatchObject({ success: false, partial: false, changed: [], rollback_complete: true });
    expect(result.message).toContain('Readback mismatch');
    expect(item.opacity).toBe(100);
  });

  it('restores mixed text colors per character on later batch failure', async () => {
    const item = text(), failing = path();
    Object.defineProperty(failing, 'strokeWidth', { get: () => 1, set: () => {} });
    const original = item.characters.map((c: Item) => ({ ...c.characterAttributes.fillColor }));
    const result = await run('arch_style_elements', apply([edit(B, { fill: paint }), edit()]), doc([item, failing]));
    expect(result).toMatchObject({ success: false, partial: false, rollback_complete: true });
    expect(item.characters.map((c: Item) => c.characterAttributes.fillColor)).toEqual(original);
  });

  it('reports residual UUIDs and prevents blind retry when rollback fails', async () => {
    const one = path(), two = path(B);
    let width = 1;
    Object.defineProperty(one, 'strokeWidth', { get: () => width, set: (value) => { if (width === 2 && value === 1) throw new Error('restore denied'); width = value; } });
    Object.defineProperty(two, 'strokeWidth', { get: () => 1, set: () => {} });
    const result = await run('arch_style_elements', apply([edit(), edit(B)]), doc([one, two]));
    expect(result).toMatchObject({ success: false, partial: true, changed: [A], changed_count: 1, rollback_complete: false });
    expect(result.rollback_errors[0].message).toContain('restore denied');
    expect(result.retry_advice).toContain('Do not blindly retry');
  });

  it('returns an unchanged result for an idempotent repeated style', async () => {
    const item = path();
    const document = doc([item]);
    await run('arch_style_elements', apply([edit()]), document);
    const result = await run('arch_style_elements', apply([edit()]), document);
    expect(result).toMatchObject({ success: true, changed: [], changed_count: 0 });
  });

  it('rejects invalid style ranges, empty changes and invalid IDs at the schema boundary', () => {
    const schema = captured.arch_style_elements.schema;
    for (const style of [{}, { opacity: 101 }, { stroke_width: -1 }, { dashes: [0, 0] }, { fill: { type: 'rgb', r: 256, g: 0, b: 0 } }, { semantic: { confidence: 2 } }, { unknown: true }]) {
      expect(schema.safeParse(apply([edit(A, style)])).success).toBe(false);
    }
    expect(schema.safeParse(apply([edit('not-a-uuid')])).success).toBe(false);
    expect(schema.safeParse({ edits: [edit()] }).success).toBe(false);
  });
});

describe('architecture inspection', () => {
  it('declares the metadata write honestly while keeping non-destructive idempotent behavior', () => {
    expect(captured.arch_inspect_elements.annotations).toEqual({ readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false });
    expect(captured.arch_inspect_elements.description).toContain('missing UUIDs are persisted');
  });

  it('returns bounded results, exact style and bounded point lists', async () => {
    const item = path(A, { pathPoints: Array.from({ length: 6 }, () => ({ anchor: [1, 2], leftDirection: [1, 2], rightDirection: [1, 2] })) });
    const result = await run('arch_inspect_elements', { limit: 1, include_points: true, max_points: 2 }, doc([item, path(B)]));
    expect(result).toMatchObject({ success: true, count: 1, matched_count: 2, has_more: true, coordinate_system: 'document', units: 'pt' });
    expect(result.elements[0]).toMatchObject({ uuid: A, uuid_persistent: true, editable: true, point_count: 6, points_truncated: true, style: { stroke_width: 1, cap: 'butt' } });
    expect(result.elements[0].points_document_pt).toHaveLength(2);
  });

  it('exposes group child UUIDs and image limits without editing image pixels', async () => {
    const image = path(B, { typename: 'PlacedItem', file: { fsName: 'C:/site.png' } });
    const parent = group([path(), image]);
    const result = await run('arch_inspect_elements', {}, doc([parent]));
    expect(result.elements[0].children.map((child: Item) => child.uuid)).toEqual([A, B]);
    const inspectedImage = result.elements.find((entry: Item) => entry.uuid === B);
    expect(inspectedImage).toMatchObject({ editable: false, image: { pixel_contents_editable: false, link_path: 'C:/site.png' } });
  });

  it('filters by UUID and immediate layer, reports missing IDs and duplicate ambiguity', async () => {
    const document = doc([path(), path(A), path(B)]);
    const result = await run('arch_inspect_elements', { uuids: [A, C], layer_name: 'Analysis' }, document);
    expect(result.missing_uuids).toEqual([C]);
    expect(result.elements).toHaveLength(2);
    expect(result.elements[0]).toMatchObject({ editable: false, uuid_match_count: 2 });
    expect((await run('arch_inspect_elements', { layer_name: 'Missing' }, document)).count).toBe(0);
  });

  it('reads overlay semantic JSON and merges patch while retaining metadata and user notes', async () => {
    const metadata = { version: 1, batch_id: 'diagram-01', semantic_id: 'entry-1', kind: 'route', role: 'vehicle_flow', component: 'shaft' };
    const item = path(A, { note: A + ' ' + JSON.stringify({ architectureMcp: metadata }) });
    const document = doc([item]);
    const result = await run('arch_style_elements', apply([edit(A, { semantic: { role: 'pedestrian_flow', evidence: 'Proposed, not surveyed.', confidence: 0.5 } })]), document);
    expect(result.success).toBe(true);
    const inspected = await run('arch_inspect_elements', {}, document);
    expect(inspected.elements[0].semantic).toEqual({ ...metadata, role: 'pedestrian_flow', evidence: 'Proposed, not surveyed.', confidence: 0.5 });
    expect(item.note).toContain(JSON.stringify({ architectureMcp: metadata }));
  });

  it('does not evaluate executable content in an Illustrator note', async () => {
    const item = path(A, { note: A + ' {architectureMcp:(function(){throw new Error("executed");})()}' });
    const result = await run('arch_inspect_elements', {}, doc([item]));
    expect(result.success).toBe(true);
    expect(result.elements[0].semantic).toEqual({});
  });

  it('assigns missing persistent IDs without losing the existing note', async () => {
    const item = path(A, { note: 'Original source: north arrow reference' });
    const document = doc([item]);
    const result = await run('arch_inspect_elements', {}, document);
    expect(result.elements[0].uuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(item.note).toContain(' Original source: north arrow reference');
    const firstNote = item.note;
    const repeated = await run('arch_inspect_elements', {}, document);
    expect(repeated.elements[0].uuid).toBe(result.elements[0].uuid);
    expect(item.note).toBe(firstNote);
  });
});
