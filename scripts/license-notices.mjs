import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';

const NOTICE_FILE = /^(?:licen[cs]e|copying|notice)(?:[.-].*)?$/i;

function readNoticeFiles(packageRoot) {
  return readdirSync(packageRoot).filter((name) => NOTICE_FILE.test(name) && statSync(join(packageRoot, name)).isFile())
    .sort().map((name) => ({ name, text: readFileSync(join(packageRoot, name), 'utf8').replace(/\r\n/g, '\n') }));
}

function namedPackageRoot(input, root) {
  let current = dirname(input);
  while (current !== root && current !== parse(current).root) {
    const metadata = join(current, 'package.json');
    if (existsSync(metadata)) {
      const pkg = JSON.parse(readFileSync(metadata, 'utf8'));
      // Some packages include a { "type": "module" } package.json inside dist.
      // Continue upward until the actual named dependency is reached.
      if (typeof pkg.name === 'string' && typeof pkg.version === 'string') return { root: current, pkg };
    }
    current = dirname(current);
  }
  throw new Error(`Cannot identify bundled dependency: ${relative(root, input)}`);
}

export function collectBundledPackages(root, metafile) {
  root = resolve(root);
  const packages = new Map();
  for (const input of Object.keys(metafile.inputs)) {
    const full = isAbsolute(input) ? resolve(input) : resolve(root, input);
    if (!full.split(sep).includes('node_modules')) continue;
    const item = namedPackageRoot(full, root);
    if (!packages.has(item.root)) {
      const files = readNoticeFiles(item.root);
      if (!files.length || files.every((file) => !file.text.trim())) {
        throw new Error(`Bundled dependency ${item.pkg.name}@${item.pkg.version} has no license/notice text; review it before distributing.`);
      }
      packages.set(item.root, { ...item, files, source: relative(root, item.root).split(sep).join('/') });
    }
  }
  return [...packages.values()].sort((a, b) => `${a.pkg.name}@${a.pkg.version}/${a.source}`.localeCompare(`${b.pkg.name}@${b.pkg.version}/${b.source}`));
}

export function generateBundleNotices(root, metafile) {
  const packages = collectBundledPackages(root, metafile);
  if (!packages.length) throw new Error('Bundle contains no detected third-party inputs; inspect the build metadata before release.');
  const sections = [
    'THIRD-PARTY LICENSE AND NOTICE TEXTS FOR dist/bundle.cjs',
    'Generated from the actual esbuild inputs. Original license/notice texts follow without translation.',
    'The root MIT license does not replace third-party terms. Package license fields below are declarations, not a legal determination.',
    'sharp is external to this bundle; its separately installed npm package and platform/native dependencies retain their own license and notice files.',
    `Bundled packages: ${packages.length}`,
  ];
  for (const { pkg, source, files } of packages) {
    sections.push(`\n${'='.repeat(78)}\n${pkg.name}@${pkg.version}\nDeclared license: ${typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license ?? pkg.licenses ?? 'not declared')}\nBuild input package: ${source}`);
    for (const file of files) sections.push(`\n--- ${file.name} ---\n${file.text}`);
  }
  return `${sections.join('\n\n')}\n`;
}
