import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
// Release scripts are also directly runnable by an installed Node runtime.
// @ts-expect-error JavaScript helper has no declaration file.
import { makeServerDefinition } from '../../scripts/generate-config.mjs';
// @ts-expect-error JavaScript helper has no declaration file.
import { validateRelease } from '../../scripts/release-check.mjs';
// @ts-expect-error JavaScript helper has no declaration file.
import { validatePackageFiles } from '../../scripts/package-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const required = [
  'package.json', 'LICENSE', 'UPSTREAM.md', 'ACKNOWLEDGEMENTS.md', 'DISCLAIMER.md', 'README.md', 'README.zh-CN.md', 'README.en.md', 'README.ja.md',
  'dist/index.js', 'dist/bundle.cjs', 'dist/jsx/helpers/common.jsx',
  'dist/THIRD-PARTY-NOTICES.txt',
  'scripts/verify-offline.mjs', 'scripts/generate-config.mjs', 'skills/architecture-diagramming/SKILL.md',
  'skills/architecture-diagramming/references/urban-site-analysis.md',
  'skills/architecture-diagramming/references/urban-analysis-atlas.md',
  'skills/architecture-diagramming/references/urban-worked-example.md',
];

describe('portable alpha distribution', () => {
  it('requires the exact alpha version and protects the npm identity', () => {
    expect(validateRelease(`v${pkg.version}`, pkg)).toBe(pkg.version);
    for (const tag of ['v0.1.0', 'v0.1.0-beta.1', 'v00.1.0-alpha.1', 'v0.1.0-alpha.99', '$(echo secret)']) {
      expect(() => validateRelease(tag, pkg)).toThrow();
    }
    expect(() => validateRelease(`v${pkg.version}`, { ...pkg, private: false })).toThrow();
    expect(() => validateRelease(`v${pkg.version}`, { ...pkg, name: 'upstream-name' })).toThrow();
  });

  it('rejects leaked files, traversal and incomplete runtime tarballs', () => {
    expect(validatePackageFiles(required).files).toBe(required.length);
    for (const extra of ['outputs/live-log.json', '.env', 'node_modules/a.js', 'research/source.png', 'dist/../secret', '/etc/passwd', 'dist/credentials.json']) {
      expect(() => validatePackageFiles([...required, extra])).toThrow();
    }
    expect(() => validatePackageFiles(required.filter((item) => item !== 'dist/jsx/helpers/common.jsx'))).toThrow();
    expect(() => validatePackageFiles(required.filter((item) => item !== 'skills/architecture-diagramming/references/urban-worked-example.md'))).toThrow();
  });

  it('generates absolute runtime paths, explicit modes and an exclusive UTF-8 spec file', () => {
    const work = mkdtempSync(join(tmpdir(), 'architecture-config-test-'));
    try {
      const packageRoot = join(work, 'package with spaces');
      mkdirSync(join(packageRoot, 'dist'), { recursive: true });
      writeFileSync(join(packageRoot, 'package.json'), JSON.stringify({ name: pkg.name }));
      expect(() => makeServerDefinition(packageRoot)).toThrow(/Built server/);
      writeFileSync(join(packageRoot, 'dist', 'index.js'), '');
      const spec = makeServerDefinition(packageRoot, 'addon');
      expect(spec.command).toBe(process.execPath);
      expect(spec.args).toEqual([join(packageRoot, 'dist', 'index.js')]);
      expect(spec.env.ILLUSTRATOR_ARCHITECTURE_ONLY).toBe('1');
      expect(makeServerDefinition(packageRoot, 'standalone').env.ILLUSTRATOR_ARCHITECTURE_ONLY).toBe('0');
      expect(() => makeServerDefinition(packageRoot, 'typo')).toThrow();
      expect(() => makeServerDefinition('relative', 'addon')).toThrow();
      // Use a portable copy to prove config generation is rooted at its installed
      // package, not the shell's cwd or a developer-specific path.
      mkdirSync(join(packageRoot, 'scripts'));
      const script = join(packageRoot, 'scripts', 'generate-config.mjs');
      writeFileSync(script, readFileSync(join(root, 'scripts', 'generate-config.mjs')));
      const output = join(work, 'generated.json');
      const run = () => spawnSync(process.execPath, [script, '--mode', 'addon', '--output', output], { cwd: work, encoding: 'utf8' });
      expect(run().status).toBe(0);
      expect(JSON.parse(readFileSync(output, 'utf8'))).toEqual(spec);
      expect(run().status).toBe(1);
      expect(JSON.parse(readFileSync(output, 'utf8'))).toEqual(spec);
    } finally {
      if (dirname(work) === tmpdir() && work.startsWith(join(tmpdir(), 'architecture-config-test-'))) rmSync(work, { recursive: true, force: true });
    }
  });

  it('has no active upstream registry or plugin installer entry point', () => {
    for (const file of ['manifest.json', 'server.json', 'glama.json', '.claude-plugin/marketplace.json', 'plugins/ie3-design-bridge/.mcp.json']) {
      expect(existsSync(join(root, file))).toBe(false);
      expect(existsSync(join(root, 'upstream-distribution', `${file}.txt`))).toBe(true);
    }
    expect(pkg.scripts['pack:mcpb']).toBeUndefined();
    expect(pkg.scripts.release).toBeUndefined();
    expect(pkg.repository).toBeUndefined();
  });
});
