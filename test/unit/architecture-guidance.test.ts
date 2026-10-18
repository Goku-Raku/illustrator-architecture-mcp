import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import { guidanceFiles, guidanceInputSchema, readDiagramGuidance, register } from '../../src/tools/architecture/guidance.js';

describe('architecture guidance', () => {
  it('accepts only fixed topics and defaults to the overview', () => {
    expect(guidanceInputSchema.parse({}).topic).toBe('overview');
    expect(() => guidanceInputSchema.parse({ topic: '../../config.toml' })).toThrow();
    expect(() => guidanceInputSchema.parse({ path: 'C:/secret' })).toThrow();
  });
  it('loads every shipped canonical document without Illustrator', async () => {
    for (const topic of Object.keys(guidanceFiles) as (keyof typeof guidanceFiles)[]) {
      const content = await readDiagramGuidance(topic);
      expect(content.length).toBeGreaterThan(100);
    }
    await expect(readDiagramGuidance('../SKILL.md' as keyof typeof guidanceFiles)).rejects.toThrow('Unknown');
  });
  it('exposes read-only guidance and an explicit no-inspection scope', async () => {
    let registered: any;
    register({ registerTool(name: string, config: unknown, handler: unknown) { registered = { name, config, handler }; } } as unknown as McpServer);
    expect(registered.name).toBe('arch_get_diagram_guidance');
    expect(registered.config.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    const result = await registered.handler({ topic: 'workflow' });
    const body = JSON.parse(result.content[0].text);
    expect(body.success).toBe(true);
    expect(body.source).toBe('skills/architecture-diagramming/references/method.md');
    expect(body.scope).toContain('no document inspection');
  });
});
