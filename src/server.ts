import { readFileSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JsxToolError } from './executor/jsx-runner.js';
import { registerAllTools } from './tools/registry.js';
import { formatToolResult } from './tools/tool-executor.js';
import { registerAllPrompts } from './prompts/registry.js';
import { register as registerArchitectureReference } from './tools/architecture/reference.js';
import { register as registerArchitectureOverlay } from './tools/architecture/overlay.js';
import { register as registerArchitectureStyle } from './tools/architecture/style.js';
import { register as registerArchitectureGuidance } from './tools/architecture/guidance.js';
import { register as registerArchitectureSiteMap } from './tools/architecture/site-map.js';

/**
 * serverInfo.version は package.json から読む（手書き定数はリリースのたびにずれる）。
 * dist/server.js・dist/bundle.cjs・src/server.ts のいずれからも ../package.json で届く
 */
export function readPackageVersion(): string {
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(path.resolve(dir, '../package.json'), 'utf-8')) as { version?: unknown };
    if (typeof pkg.version === 'string' && pkg.version) return pkg.version;
  } catch {
    // package.json が同梱されていない配置でもサーバー自体は起動させる
  }
  return '0.0.0-unknown';
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'illustrator-architecture-mcp',
    version: readPackageVersion(),
  }, {
    instructions: 'Building and urban site diagrams: use architecture-diagramming or the relevant arch_get_diagram_guidance topic. For neighbourhood/district/site analysis use urban_site, urban_atlas or urban_example; define scope, boundaries, evidence, topology, time, denominator and a testable design action. arch_read_reference returns a real PNG and frame; inspect it visually, then arch_map_preview_points maps pixels. arch_prepare_site_map is read-only: converts explicitly planar/projected GeoJSON-shaped data to calibrated overlay_params; it does not verify CRS or compute GIS results. Inspect the result before arch_add_overlay writes editable zones (including compound holes), routes, curves, markers, sectors, boundaries, labels and hatches. Sectors do not compute visibility or accessibility; routes do not solve networks or traffic. Inspect UUIDs and use permitted leaf styling; compound path members are protected. Re-capture and visually verify. Do not invent north, scale, climate or measurements. Serialize Illustrator operations across servers. In architecture-only mode use the original illustrator server for opening, saving, export and general geometry edits.',
  });

  applyToolErrorBoundary(server);
  if (process.env['ILLUSTRATOR_ARCHITECTURE_ONLY'] !== '1') {
    registerAllTools(server);
    registerAllPrompts(server);
  }
  registerArchitectureReference(server);
  registerArchitectureOverlay(server);
  registerArchitectureStyle(server);
  registerArchitectureGuidance(server);
  registerArchitectureSiteMap(server);

  return server;
}

/**
 * 失敗をツール応答の isError に揃える境界。JSX の error: true は JsxToolError として投げられるので、
 * ここで formatToolResult() に通して追加情報ごと返す（例外のまま SDK に渡すと message しか残らない）。
 * 戻り値の error: true / success: false は formatToolResult() が isError を付ける
 */
export function applyToolErrorBoundary(server: McpServer): void {
  const register = server.registerTool.bind(server) as (...args: unknown[]) => unknown;
  (server as { registerTool: unknown }).registerTool = (name: string, config: unknown, handler: (...a: unknown[]) => unknown) =>
    register(name, config, async (...args: unknown[]) => {
      try {
        return await handler(...args);
      } catch (e) {
        if (!(e instanceof JsxToolError)) throw e;
        return formatToolResult(e.result);
      }
    });
}
