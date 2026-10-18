import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function makeServerDefinition(root, mode = 'standalone', nodePath = process.execPath) {
  if (!['standalone', 'addon'].includes(mode)) throw new Error('Mode must be standalone or addon.');
  if (!isAbsolute(root) || !isAbsolute(nodePath)) throw new Error('Absolute package and Node paths are required.');
  const entry = join(root, 'dist', 'index.js');
  if (!existsSync(entry)) throw new Error('Built server is missing. Run npm ci and npm run build in the source checkout, or install the release .tgz.');
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (pkg.name !== 'illustrator-architecture-mcp') throw new Error('Unexpected package identity.');
  return {
    command: nodePath,
    args: [entry],
    env: {
      ILLUSTRATOR_ARCHITECTURE_ONLY: mode === 'addon' ? '1' : '0',
      ILLUSTRATOR_MCP_TIMEOUT_NORMAL: '60000',
      ILLUSTRATOR_MCP_TIMEOUT_HEAVY: '180000',
    },
  };
}

export function parseArguments(args) {
  let mode = 'standalone', output;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode' && args[i + 1]) mode = args[++i];
    else if (args[i] === '--output' && args[i + 1]) output = resolve(args[++i]);
    else throw new Error('Usage: node scripts/generate-config.mjs [--mode standalone|addon] [--output new-file.json]');
  }
  return { mode, output };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const { mode, output } = parseArguments(process.argv.slice(2));
    const json = `${JSON.stringify(makeServerDefinition(root, mode), null, 2)}\n`;
    if (output) {
      // Exclusive create prevents overwriting a previously reviewed definition.
      writeFileSync(output, json, { encoding: 'utf8', flag: 'wx' });
      console.error(`Created server definition: ${output}`);
    } else process.stdout.write(json);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
