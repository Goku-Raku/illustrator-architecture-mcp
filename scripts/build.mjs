import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildSync } from 'esbuild';
import { generateBundleNotices } from './license-notices.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');
if (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name !== 'illustrator-architecture-mcp') {
  throw new Error('Unexpected build root.');
}
// Only remove this package's generated output; never a caller-supplied path.
if (dirname(output) !== root) throw new Error('Unsafe output path.');
if (existsSync(output)) rmSync(output, { recursive: true, force: true });
const compiler = spawnSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc')], { cwd: root, stdio: 'inherit' });
if (compiler.error) throw compiler.error;
if (compiler.status !== 0) process.exit(compiler.status || 1);
cpSync(join(root, 'src/jsx'), join(output, 'jsx'), { recursive: true });
const bundled = buildSync({
  absWorkingDir: root,
  entryPoints: [join(root, 'src/index.ts')], bundle: true, external: ['sharp'],
  platform: 'node', format: 'cjs', outfile: join(output, 'bundle.cjs'),
  define: { 'import.meta.url': '_importMetaUrl' },
  banner: { js: '// Third-party license and notice texts: ./THIRD-PARTY-NOTICES.txt\nconst _importMetaUrl = require("url").pathToFileURL(__filename).href;' },
  metafile: true,
});
writeFileSync(join(output, 'THIRD-PARTY-NOTICES.txt'), generateBundleNotices(root, bundled.metafile), 'utf8');
