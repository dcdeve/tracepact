import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineTools } from '../src/tools/define-tools.js';

describe('defineTools', () => {
  it('creates a single tool definition with correct jsonSchema', () => {
    const tools = defineTools({
      read_file: z.object({ path: z.string() }),
    });

    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('read_file');
    expect(tools[0]?.jsonSchema).toEqual({
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    });
  });

  it('creates multiple tool definitions', () => {
    const tools = defineTools({
      read_file: z.object({ path: z.string() }),
      bash: z.object({ command: z.string() }),
      write_file: z.object({ path: z.string(), content: z.string() }),
    });

    expect(tools).toHaveLength(3);
    const names = tools.map((t) => t.name);
    expect(names).toContain('read_file');
    expect(names).toContain('bash');
    expect(names).toContain('write_file');
  });

  it('throws on empty tool name', () => {
    expect(() => defineTools({ '': z.object({}) })).toThrow('Tool name cannot be empty');
  });

  it('throws on whitespace-only tool name', () => {
    expect(() => defineTools({ '  ': z.object({}) })).toThrow('Tool name cannot be empty');
  });

  it('handles complex schemas with nested objects, arrays, and enums', () => {
    const tools = defineTools({
      deploy: z.object({
        target: z.enum(['staging', 'production']),
        replicas: z.number(),
        tags: z.array(z.string()),
        dryRun: z.boolean().optional(),
      }),
    });

    const schema = tools[0]?.jsonSchema as any;
    expect(schema.type).toBe('object');
    expect(schema.properties.target).toEqual({ type: 'string', enum: ['staging', 'production'] });
    expect(schema.properties.replicas).toEqual({ type: 'number' });
    expect(schema.properties.tags).toEqual({ type: 'array', items: { type: 'string' } });
    expect(schema.properties.dryRun).toEqual({ type: 'boolean' });
    expect(schema.required).toContain('target');
    expect(schema.required).toContain('replicas');
    expect(schema.required).toContain('tags');
    expect(schema.required).not.toContain('dryRun');
  });

  it('preserves the zod schema reference', () => {
    const readSchema = z.object({ path: z.string() });
    const tools = defineTools({ read_file: readSchema });

    expect(tools[0]?.schema).toBe(readSchema);
  });

  it("falls back to { type: 'object' } for unsupported zod types", () => {
    const tools = defineTools({
      custom: z.any() as any,
    });

    expect(tools[0]?.jsonSchema).toEqual({ type: 'object' });
  });
});
