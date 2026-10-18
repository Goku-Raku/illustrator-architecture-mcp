import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validatePackageFiles } from './package-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this check with npm run verify:package so the current npm CLI and configuration are used.');
const sandbox = mkdtempSync(join(tmpdir(), 'illustrator-architecture-package-'));
const checkedSandbox = realpathSync(sandbox);
let passed = false;
function run(command, args, cwd = root, json = false) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: process.env, maxBuffer: 16 * 1024 * 1024, timeout: 300000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${args.join(' ')} failed (${result.status}):\n${result.stdout}\n${result.stderr}`);
  if (json) return JSON.parse(result.stdout);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}
try {
  // No repository node_modules are copied. npm resolves only the packed runtime
  // dependencies into a completely separate directory (registry/cache required).
  const [packed] = run(process.execPath, [npmCli, 'pack', '--ignore-scripts', '--json', '--pack-destination', sandbox], root, true);
  const policy = validatePackageFiles(packed.files);
  console.log(`Package allowlist passed: ${policy.files} files; ${packed.filename}`);
  const tarball = join(sandbox, packed.filename);
  assert.equal(dirname(tarball), sandbox);
  writeFileSync(join(sandbox, 'package.json'), JSON.stringify({ name: 'clean-alpha-install-check', version: '0.0.0', private: true }));
  run(process.execPath, [npmCli, 'install', '--omit=dev', '--no-audit', '--no-fund', '--ignore-scripts', tarball], sandbox);
  const installed = join(sandbox, 'node_modules', 'illustrator-architecture-mcp');
  const pkg = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
  assert.equal(pkg.version, JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version);
  run(process.execPath, [join(installed, 'scripts', 'verify-offline.mjs')], sandbox);
  for (const mode of ['standalone', 'addon']) {
    const spec = run(process.execPath, [join(installed, 'scripts', 'generate-config.mjs'), '--mode', mode], sandbox, true);
    assert.deepEqual(spec.args, [join(installed, 'dist', 'index.js')]);
    assert.equal(spec.command, process.execPath);
    assert.equal(spec.env.ILLUSTRATOR_ARCHITECTURE_ONLY, mode === 'addon' ? '1' : '0');
  }
  passed = true;
  console.log(`Clean tarball installation passed: ${pkg.name}@${pkg.version}; runtime-only dependencies; both configuration modes.`);
} finally {
  // This directory was freshly created by this process. Verify its final path
  // before recursive cleanup, and retain failed installations for inspection.
  if (passed && realpathSync(sandbox) === checkedSandbox && dirname(sandbox) === tmpdir() && sandbox.startsWith(join(tmpdir(), 'illustrator-architecture-package-'))) {
    rmSync(sandbox, { recursive: true, force: true });
  } else console.error(`Verification work directory retained: ${sandbox}`);
}
