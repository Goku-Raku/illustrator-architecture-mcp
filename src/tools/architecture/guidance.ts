import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { READ_ANNOTATIONS } from '../modify/shared.js';

// The installed skill is the canonical method source, also shipped in npm files.
// Only these fixed local documents can be read. No user paths or network calls.
export const guidanceFiles = {
  overview: 'SKILL.md',
  workflow: 'references/method.md',
  analysis_atlas: 'references/analysis-atlas.md',
  visual_encoding: 'references/visual-language.md',
  worked_examples: 'references/examples.md',
  mcp_execution: 'references/mcp-execution.md',
  urban_site: 'references/urban-site-analysis.md',
  urban_atlas: 'references/urban-analysis-atlas.md',
  urban_example: 'references/urban-worked-example.md',
} as const;
export const guidanceInputSchema = z.object({
  topic: z.enum(['overview', 'workflow', 'analysis_atlas', 'visual_encoding', 'worked_examples', 'mcp_execution', 'urban_site', 'urban_atlas', 'urban_example']).default('overview')
    .describe('Choose only the guidance needed. Urban site/neighbourhood/district work: urban_site for scope, boundaries and workflow; urban_atlas for analysis dimensions; urban_example for a topology/time-based worked case. Other topics cover buildings, visual encoding and MCP execution.'),
}).strict();

export async function readDiagramGuidance(topic: keyof typeof guidanceFiles): Promise<string> {
  if (!Object.hasOwn(guidanceFiles, topic)) throw new Error('Unknown diagram guidance topic.');
  const base = dirname(fileURLToPath(import.meta.url));
  // src/tools/architecture or dist/tools/architecture; bundled dist/bundle.cjs.
  const roots = [resolve(base, '../../../skills/architecture-diagramming'), resolve(base, '../skills/architecture-diagramming')];
  for (const root of roots) {
    try {
      return await readFile(resolve(root, guidanceFiles[topic]), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  throw new Error('Diagram guidance is missing. Reinstall the package including skills/architecture-diagramming.');
}

export function register(server: McpServer): void {
  server.registerTool('arch_get_diagram_guidance', {
    title: 'Get Architectural Diagram Guidance',
    description: 'Read task-specific building, urban site, neighbourhood and district analysis guidance without opening or changing Illustrator. Helps choose a question, evidence, spatial relationship, diagram method and verification. Urban topics cover networks, morphology, land use, public life, ecology, time and governance, with a topology-based worked case. This returns guidance, not a completed site analysis, GIS computation, simulation or drawing. Read only the relevant topic; the architecture-diagramming skill contains the same canonical documents.',
    inputSchema: guidanceInputSchema.shape,
    annotations: READ_ANNOTATIONS,
  }, async (input) => {
    const { topic } = guidanceInputSchema.parse(input);
    try {
      const body = await readDiagramGuidance(topic);
      return { content: [{ type: 'text' as const, text: JSON.stringify({
        success: true, topic, source: `skills/architecture-diagramming/${guidanceFiles[topic]}`,
        scope: 'Guidance only; no document inspection or mutation was performed.', content: body,
      }) }] };
    } catch (error) {
      return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({
        success: false, topic, message: error instanceof Error ? error.message : String(error),
      }) }] };
    }
  });
}
