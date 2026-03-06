import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadScenarios } from '../src/scenarios/loader.js';

const tmpDir = join(import.meta.dirname, '__scenarios_test__');

function writeTemp(name: string, content: string): string {
  mkdirSync(tmpDir, { recursive: true });
  const path = join(tmpDir, name);
  writeFileSync(path, content);
  return path;
}

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('loadScenarios', () => {
  it('loads JSON scenarios', async () => {
    const path = writeTemp(
      'test.json',
      JSON.stringify([
        { name: 'SQL injection', code: 'SELECT *' },
        { name: 'XSS', code: '<script>' },
      ])
    );
    const scenarios = await loadScenarios(path);
    expect(scenarios).toHaveLength(2);
    expect(scenarios[0]?.name).toBe('SQL injection');
    expect(scenarios[1]?.code).toBe('<script>');
  });

  it('loads YAML scenarios', async () => {
    const path = writeTemp(
      'test.yaml',
      `- name: SQL injection
  code: "SELECT *"
- name: XSS
  code: "<script>"
`
    );
    const scenarios = await loadScenarios(path);
    expect(scenarios).toHaveLength(2);
    expect(scenarios[0]?.name).toBe('SQL injection');
  });

  it('throws on unsupported extension', async () => {
    const path = writeTemp('test.txt', '[]');
    await expect(loadScenarios(path)).rejects.toThrow('Unsupported scenario file format');
  });

  it('throws when file is not an array', async () => {
    const path = writeTemp('obj.json', '{"name": "test"}');
    await expect(loadScenarios(path)).rejects.toThrow('must contain an array');
  });

  it('throws when entry missing name field', async () => {
    const path = writeTemp('noname.json', '[{"code": "x"}]');
    await expect(loadScenarios(path)).rejects.toThrow('index 0');
    await expect(loadScenarios(path)).rejects.toThrow('"name" field');
  });

  it('throws on empty array', async () => {
    const path = writeTemp('empty.json', '[]');
    await expect(loadScenarios(path)).rejects.toThrow('empty array');
  });

  it('loads large scenario file (100 entries)', async () => {
    const entries = Array.from({ length: 100 }, (_, i) => ({ name: `scenario-${i}`, value: i }));
    const path = writeTemp('large.json', JSON.stringify(entries));
    const scenarios = await loadScenarios(path);
    expect(scenarios).toHaveLength(100);
    expect(scenarios[99]?.name).toBe('scenario-99');
  });
});
