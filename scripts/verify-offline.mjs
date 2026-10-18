import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const ARCHITECTURE_TOOLS = [
  'arch_read_reference', 'arch_map_preview_points', 'arch_add_overlay',
  'arch_inspect_elements', 'arch_style_elements', 'arch_get_diagram_guidance',
  'arch_prepare_site_map',
].sort();
const GUIDANCE_TOPICS = ['overview', 'workflow', 'analysis_atlas', 'visual_encoding', 'worked_examples', 'mcp_execution', 'urban_site', 'urban_atlas', 'urban_example'];

function decode(result) {
  assert.equal(result.isError, undefined, JSON.stringify(result));
  const block = result.content.find((part) => part.type === 'text');
  assert.ok(block, 'Expected a text result');
  const data = JSON.parse(block.text);
  assert.equal(data.success, true, block.text);
  return data;
}

// Synthetic local drawing coordinates: no real site data, Illustrator document,
// network lookup, route solving, or application activation is needed.
export function siteMapFixture() {
  return {
    expected_document: { name: 'offline-fixture.ai' }, artboard_index: 0, batch_id: 'offline-fixture',
    source_coordinates: { kind: 'local_planar', crs: 'Synthetic verification grid', units: 'm', y_axis: 'up' },
    source_ref: 'synthetic offline installation fixture', source_extent: [0, 0, 200, 100],
    frame: { left: 10, top: 20, width: 400, height: 400 },
    default_style: { role: 'fixture', fill: '#334455', stroke: { color: '#112233', width_pt: 1 } },
    geojson: { type: 'FeatureCollection', features: [
      { type: 'Feature', id: 'courtyard', geometry: { type: 'Polygon', coordinates: [
        [[0, 0], [200, 0], [200, 100], [0, 100], [0, 0]],
        [[20, 20], [40, 20], [40, 40], [20, 40], [20, 20]],
      ] } },
      { type: 'Feature', id: 'route', geometry: { type: 'LineString', coordinates: [[0, 0], [200, 100]] } },
      { type: 'Feature', id: 'entrance', geometry: { type: 'Point', coordinates: [10, 50] } },
    ] },
  };
}

export async function verifyOffline(root, report = console.log) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const notices = readFileSync(join(root, 'dist', 'THIRD-PARTY-NOTICES.txt'), 'utf8');
  for (const name of ['@modelcontextprotocol/sdk', 'zod', 'p-limit']) {
    assert.ok(notices.includes(`${name}@`), `Missing bundled license/notice record for ${name}`);
  }
  assert.ok(notices.includes('Permission is hereby granted'), 'Expected original bundled license text, not only a package list.');
  const results = [];
  for (const entry of ['dist/index.js', 'dist/bundle.cjs']) {
    for (const mode of ['addon', 'standalone']) {
      const client = new Client({ name: 'illustrator-architecture-offline-verifier', version: pkg.version });
      const env = Object.fromEntries(Object.entries(process.env).filter(([, value]) => typeof value === 'string'));
      env.ILLUSTRATOR_ARCHITECTURE_ONLY = mode === 'addon' ? '1' : '0';
      const transport = new StdioClientTransport({ command: process.execPath, args: [join(root, entry)], cwd: root, env, stderr: 'pipe' });
      let stderr = '';
      transport.stderr?.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-16000); });
      try {
        await client.connect(transport, { timeout: 15000 });
        assert.deepEqual(client.getServerVersion(), { name: pkg.name, version: pkg.version });
        const listing = await client.listTools({}, { timeout: 15000 });
        const names = listing.tools.map((tool) => tool.name);
        assert.deepEqual(names.filter((name) => name.startsWith('arch_')).sort(), ARCHITECTURE_TOOLS);
        if (mode === 'addon') assert.equal(names.length, 7);
        else {
          assert.equal(names.length, 73, 'Expected 66 upstream tools plus 7 architecture tools.');
          for (const name of ['open_document', 'save_document', 'export', 'create_document']) assert.ok(names.includes(name), `Missing ${name}`);
        }
        const guidance = listing.tools.find((tool) => tool.name === 'arch_get_diagram_guidance');
        assert.deepEqual([...guidance.inputSchema.properties.topic.enum].sort(), [...GUIDANCE_TOPICS].sort());
        for (const topic of GUIDANCE_TOPICS) {
          const data = decode(await client.callTool({ name: 'arch_get_diagram_guidance', arguments: { topic } }, undefined, { timeout: 15000 }));
          assert.equal(data.topic, topic);
          assert.ok(data.content.length > 200, `Empty or truncated guidance: ${topic}`);
        }
        const mapped = decode(await client.callTool({ name: 'arch_prepare_site_map', arguments: siteMapFixture() }, undefined, { timeout: 15000 }));
        assert.equal(mapped.nothing_created, true);
        assert.equal(mapped.calibration.scale_pt_per_source_unit, 2);
        assert.deepEqual(mapped.calibration.actual_frame, { left: 10, top: 120, width: 400, height: 200 });
        assert.deepEqual(mapped.feature_mapping.map((item) => item.feature_id), ['courtyard', 'route', 'entrance']);
        assert.deepEqual(mapped.overlay_params.elements.map((item) => item.kind), ['compound_zone', 'route', 'marker']);
        assert.deepEqual(mapped.overlay_params.elements[0].holes[0], [[50, 280], [90, 280], [90, 240], [50, 240]]);
        const invalid = siteMapFixture();
        invalid.source_coordinates.crs = 'EPSG:4326';
        const rejected = await client.callTool({ name: 'arch_prepare_site_map', arguments: invalid }, undefined, { timeout: 15000 });
        assert.equal(rejected.isError, true, 'Geographic input must not silently be accepted as planar.');
        results.push({ entry, mode, tools: names.length, guidance_topics: GUIDANCE_TOPICS.length, site_map: 'passed' });
        report(`PASS ${entry} / ${mode}: ${names.length} tools, 9 guidance topics, calibrated courtyard fixture and invalid-CRS rejection`);
      } catch (error) {
        throw new Error(`Offline verification failed (${entry}, ${mode}): ${error.message}${stderr ? `\nServer stderr: ${stderr}` : ''}`, { cause: error });
      } finally {
        await client.close();
        await transport.close();
      }
    }
  }
  report('Offline checks passed. Illustrator was not activated or called. This does not certify live Illustrator compatibility.');
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await verifyOffline(resolve(dirname(fileURLToPath(import.meta.url)), '..')); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
