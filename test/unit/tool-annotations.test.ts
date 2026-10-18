/**
 * 全ツールの annotations。判定基準は src/tools/modify/shared.ts の annotations 定数を参照。
 * ツールを足したらここにも追加する。
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { registerAllTools } from '../../src/tools/registry.js';

type Annotations = { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean };

function collectAnnotations(): { annotations: Record<string, Annotations>; descriptions: Record<string, string> } {
  const out: Record<string, Annotations> = {};
  const descriptions: Record<string, string> = {};
  const server = {
    registerTool: vi.fn((name: string, cfg: { annotations: Annotations; description: string }) => {
      out[name] = cfg.annotations;
      descriptions[name] = cfg.description;
    }),
    registerPrompt: vi.fn(),
    registerResource: vi.fn(),
  } as unknown as McpServer;
  registerAllTools(server);
  return { annotations: out, descriptions };
}

const READ = [
  'convert_coordinate', 'get_artboards', 'get_document_info', 'get_guidelines',
  'get_separation_info', 'list_fonts', 'list_graphic_styles', 'list_text_styles',
];

// Inspection can persist missing IDs; retaining appearance is not read-only.
const UUID_METADATA_READERS = [
  'check_contrast', 'check_text_consistency', 'find_objects', 'get_colors',
  'get_document_structure', 'get_effects', 'get_groups', 'get_images', 'get_layers',
  'get_overprint_info', 'get_path_items', 'get_selection', 'get_symbols',
  'get_text_frame_detail', 'list_text_frames', 'preflight_check',
];

// 足すだけ、または中身を変えずに配置だけ変えるもの
const ADDITIVE = [
  'align_objects', 'create_document', 'create_ellipse', 'create_line', 'create_path', 'create_path_text',
  'create_rectangle', 'create_text_frame', 'duplicate_objects', 'import_svg_as_editable', 'move_to_layer',
  'open_document', 'place_color_chips', 'place_image', 'place_style_guide', 'resize_for_variation', 'set_z_order',
];

// 選択・セッション設定だけを変え、同じ引数で何度呼んでも同じ状態になるもの
const ADDITIVE_IDEMPOTENT = ['select_objects', 'set_illustrator_version', 'set_workflow', ...UUID_METADATA_READERS];

// 消す・既存の値やファイルを上書きしうるもの
const DESTRUCTIVE = [
  'apply_graphic_style', 'apply_text_style', 'close_document', 'convert_to_outlines',
  'create_crop_marks', 'create_gradient', 'delete_objects', 'export', 'export_pdf', 'extract_design_tokens',
  'group_objects', 'manage_artboards', 'manage_datasets', 'manage_layers', 'manage_linked_images',
  'manage_swatches', 'modify_object', 'place_symbol', 'replace_color', 'save_document', 'undo', 'ungroup_objects',
];

describe('tool annotations (T12)', () => {
  const { annotations: all, descriptions } = collectAnnotations();

  it('classifies every registered tool exactly once', () => {
    const listed = [...READ, ...ADDITIVE, ...ADDITIVE_IDEMPOTENT, ...DESTRUCTIVE].sort();
    expect(new Set(listed).size).toBe(listed.length);
    expect(listed).toEqual(Object.keys(all).sort());
  });

  it('discloses UUID metadata writes for every inspection script that can assign an ID', () => {
    const writers: string[] = [];
    for (const directory of ['read', 'utility']) {
      const base = new URL(`../../src/tools/${directory}/`, import.meta.url);
      for (const file of readdirSync(base).filter((name) => name.endsWith('.ts'))) {
        const source = readFileSync(new URL(file, base), 'utf8');
        if (!source.includes('ensureUUID(')) continue;
        const name = source.match(/server\.registerTool\(\s*['"]([^'"]+)['"]/u)?.[1];
        expect(name, `Registered tool name in ${directory}/${file}`).toBeTruthy();
        writers.push(name!);
        expect(all[name!]).toMatchObject({ readOnlyHint: false, destructiveHint: false, idempotentHint: true });
        expect(descriptions[name!]).toContain('may persist missing UUID metadata in object notes');
      }
    }
    expect(writers.sort()).toEqual([...UUID_METADATA_READERS].sort());
  });

  it.each(READ)('%s is read-only and idempotent', (name) => {
    expect(all[name]).toEqual({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
  });

  it.each(ADDITIVE)('%s is a non-destructive write', (name) => {
    expect(all[name]).toMatchObject({ readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false });
  });

  it.each(ADDITIVE_IDEMPOTENT)('%s is a non-destructive idempotent write', (name) => {
    expect(all[name]).toEqual({ readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false });
  });

  it.each(DESTRUCTIVE)('%s is destructive', (name) => {
    expect(all[name]).toMatchObject({ readOnlyHint: false, destructiveHint: true, openWorldHint: false });
  });
});
