import { readFileSync, realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

function isDirectExecution() {
  if (!process.argv[1]) return false;
  // Resolve both the module and argv to handle symlinked parents and CLI files.
  try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1])); }
  catch { return false; }
}

export function validateRelease(tag, pkg) {
  if (!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-alpha\.(?:0|[1-9]\d*)$/.test(tag || '')) {
    throw new Error('This workflow only releases explicit alpha tags, e.g. v0.1.0-alpha.1.');
  }
  if (pkg.version !== tag.slice(1)) throw new Error(`Tag ${tag} does not match package version ${pkg.version}.`);
  if (pkg.name !== 'illustrator-architecture-mcp' || pkg.private !== true) throw new Error('Unexpected package identity or missing private:true registry-publish guard.');
  return pkg.version;
}

if (isDirectExecution()) {
  const root = resolve(dirname(realpathSync(fileURLToPath(import.meta.url))), '..');
  try {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    console.log(`Validated alpha release: ${validateRelease(process.argv[2], pkg)}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
