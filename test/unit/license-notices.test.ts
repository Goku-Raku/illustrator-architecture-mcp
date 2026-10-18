import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
// @ts-expect-error Build helper is plain JavaScript and runs without TypeScript.
import { collectBundledPackages, generateBundleNotices } from '../../scripts/license-notices.mjs';

function fixture(run: (root: string, file: (path: string, content: string) => void) => void) {
  const root = mkdtempSync(join(tmpdir(), 'architecture-notices-test-'));
  const file = (path: string, content: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  try { run(root, file); }
  finally {
    if (dirname(root) === tmpdir() && root.startsWith(join(tmpdir(), 'architecture-notices-test-'))) rmSync(root, { recursive: true, force: true });
  }
}

describe('bundled third-party license and notice capture', () => {
  it('follows actual inputs, skips unnamed subpackage metadata and preserves full license/NOTICE texts', () => fixture((root, file) => {
    file('node_modules/@scope/sdk/package.json', JSON.stringify({ name: '@scope/sdk', version: '1.2.3', license: 'MIT' }));
    file('node_modules/@scope/sdk/LICENSE', 'Copyright example\nPermission text remains verbatim.\n');
    file('node_modules/@scope/sdk/NOTICE.txt', 'Required upstream notice.\n');
    file('node_modules/@scope/sdk/dist/package.json', JSON.stringify({ type: 'module' }));
    file('node_modules/@scope/sdk/dist/a.js', 'export {};');
    file('node_modules/@scope/sdk/dist/b.js', 'export {};');
    file('node_modules/external/package.json', JSON.stringify({ name: 'external', version: '9.0.0' }));
    const inputs = { 'src/index.ts': {}, 'node_modules/@scope/sdk/dist/a.js': {}, 'node_modules/@scope/sdk/dist/b.js': {} };
    const entries = collectBundledPackages(root, { inputs });
    expect(entries).toHaveLength(1);
    expect(entries[0].source).toBe('node_modules/@scope/sdk');
    const text = generateBundleNotices(root, { inputs });
    expect(text).toContain('@scope/sdk@1.2.3');
    expect(text).toContain('Copyright example\nPermission text remains verbatim.\n');
    expect(text).toContain('Required upstream notice.\n');
    expect(text).not.toContain('external@9.0.0');
    expect(text).not.toContain(root);
  }));

  it('keeps separately bundled versions of a nested dependency', () => fixture((root, file) => {
    for (const [location, version] of [['node_modules/lib', '1.0.0'], ['node_modules/parent/node_modules/lib', '2.0.0']]) {
      file(`${location}/package.json`, JSON.stringify({ name: 'lib', version, license: 'BSD-3-Clause' }));
      file(`${location}/COPYING`, `Original license for ${version}.`);
      file(`${location}/index.js`, '');
    }
    const text = generateBundleNotices(root, { inputs: { 'node_modules/lib/index.js': {}, 'node_modules/parent/node_modules/lib/index.js': {} } });
    expect(text).toContain('lib@1.0.0');
    expect(text).toContain('lib@2.0.0');
    expect(text).toContain('Original license for 1.0.0.');
    expect(text).toContain('Original license for 2.0.0.');
  }));

  it('blocks redistribution when a bundled package has only metadata and no license text', () => fixture((root, file) => {
    file('node_modules/missing/package.json', JSON.stringify({ name: 'missing', version: '1.0.0', license: 'MIT' }));
    file('node_modules/missing/index.js', '');
    expect(() => generateBundleNotices(root, { inputs: { 'node_modules/missing/index.js': {} } })).toThrow(/no license\/notice text/);
  }));

  it('fails an unidentifiable dependency or empty metadata instead of silently dropping notices', () => fixture((root, file) => {
    file('node_modules/unnamed/package.json', JSON.stringify({ type: 'module' }));
    file('node_modules/unnamed/index.js', '');
    expect(() => generateBundleNotices(root, { inputs: { 'node_modules/unnamed/index.js': {} } })).toThrow(/Cannot identify/);
    expect(() => generateBundleNotices(root, { inputs: { 'src/index.ts': {} } })).toThrow(/no detected third-party/);
  }));
});
