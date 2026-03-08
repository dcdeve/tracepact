import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handleAudit } from '../src/tools/audit.js';
import { handleDiff } from '../src/tools/diff.js';
import { handleListTests } from '../src/tools/list-tests.js';
import { handleReplay } from '../src/tools/replay.js';

const TEST_DIR = join(import.meta.dirname, '__mcp_test__');

const CASSETTE_A = {
  version: 1,
  recordedAt: '2026-03-06T00:00:00Z',
  metadata: { skillHash: 'abc', prompt: 'deploy', provider: 'openai', model: 'gpt-4o' },
  result: {
    output: 'Deployed.',
    trace: {
      calls: [
        {
          toolName: 'read_file',
          args: { path: '/config.yaml' },
          result: { type: 'success', content: 'port: 3000' },
          durationMs: 10,
          sequenceIndex: 0,
          unknownTool: false,
        },
        {
          toolName: 'bash',
          args: { command: 'npm run deploy' },
          result: { type: 'success', content: 'ok' },
          durationMs: 500,
          sequenceIndex: 1,
          unknownTool: false,
        },
      ],
    },
    usage: { inputTokens: 100, outputTokens: 50 },
  },
};

const CASSETTE_B = {
  version: 1,
  recordedAt: '2026-03-07T00:00:00Z',
  metadata: { skillHash: 'abc', prompt: 'deploy', provider: 'openai', model: 'gpt-4o' },
  result: {
    output: 'Deployed.',
    trace: {
      calls: [
        {
          toolName: 'read_file',
          args: { path: '/config.json' },
          result: { type: 'success', content: '{"port":3000}' },
          durationMs: 10,
          sequenceIndex: 0,
          unknownTool: false,
        },
        {
          toolName: 'bash',
          args: { command: 'npm run deploy' },
          result: { type: 'success', content: 'ok' },
          durationMs: 500,
          sequenceIndex: 1,
          unknownTool: false,
        },
        {
          toolName: 'write_file',
          args: { path: '/log.txt', content: 'done' },
          result: { type: 'success', content: '' },
          durationMs: 5,
          sequenceIndex: 2,
          unknownTool: false,
        },
      ],
    },
    usage: { inputTokens: 120, outputTokens: 60 },
  },
};

const SKILL_CONTENT = `---
name: test-agent
description: A test agent
tools:
  - bash
  - read_file
---

## Instructions

Do stuff.
`;

beforeAll(() => {
  mkdirSync(join(TEST_DIR, 'cassettes'), { recursive: true });
  writeFileSync(join(TEST_DIR, 'cassette-a.json'), JSON.stringify(CASSETTE_A));
  writeFileSync(join(TEST_DIR, 'cassette-b.json'), JSON.stringify(CASSETTE_B));
  writeFileSync(join(TEST_DIR, 'SKILL.md'), SKILL_CONTENT);
  writeFileSync(join(TEST_DIR, 'deploy.test.ts'), 'test("deploy", () => {})');
  writeFileSync(join(TEST_DIR, 'cassettes', 'deploy.json'), JSON.stringify(CASSETTE_A));
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('tracepact_replay', () => {
  it('replays a valid cassette', () => {
    const result = handleReplay({ cassette_path: join(TEST_DIR, 'cassette-a.json') });
    expect(result.pass).toBe(true);
    expect(result.trace).toBeDefined();
    const trace = result.trace as { calls: unknown[] };
    expect(trace.calls).toHaveLength(2);
  });

  it('returns error for missing cassette', () => {
    const result = handleReplay({ cassette_path: join(TEST_DIR, 'nonexistent.json') });
    expect(result.pass).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('tracepact_diff', () => {
  it('detects changes between cassettes', async () => {
    const result = await handleDiff({
      cassette_a: join(TEST_DIR, 'cassette-a.json'),
      cassette_b: join(TEST_DIR, 'cassette-b.json'),
    });
    expect(result.changed).toBe(true);
    expect(result.additions).toHaveLength(1); // write_file added
    expect(result.additions[0]?.toolName).toBe('write_file');
    expect(result.diffs.length).toBeGreaterThan(0); // path arg changed
  });

  it('reports no changes for identical cassettes', async () => {
    const result = await handleDiff({
      cassette_a: join(TEST_DIR, 'cassette-a.json'),
      cassette_b: join(TEST_DIR, 'cassette-a.json'),
    });
    expect(result.changed).toBe(false);
    expect(result.additions).toHaveLength(0);
    expect(result.removals).toHaveLength(0);
    expect(result.diffs).toHaveLength(0);
  });
});

describe('tracepact_audit', () => {
  it('audits a skill file using AuditEngine', async () => {
    const result = await handleAudit({ skill_path: join(TEST_DIR, 'SKILL.md') });
    expect(result.riskLevel).toBeDefined();
    expect(typeof result.pass).toBe('boolean');
    expect(Array.isArray(result.findings)).toBe(true);
    expect(result.summary).toBeDefined();
    expect(typeof result.summary.total).toBe('number');
  });

  it('returns summary with severity counts', async () => {
    const result = await handleAudit({ skill_path: join(TEST_DIR, 'SKILL.md') });
    expect(result.summary).toHaveProperty('critical');
    expect(result.summary).toHaveProperty('high');
    expect(result.summary).toHaveProperty('medium');
    expect(result.summary).toHaveProperty('low');
    expect(result.summary.total).toBe(result.findings.length);
  });

  it('findings include suggestions', async () => {
    const result = await handleAudit({ skill_path: join(TEST_DIR, 'SKILL.md') });
    // The test SKILL.md has bash tool, so at least one finding with suggestion
    if (result.findings.length > 0) {
      expect(result.findings[0]).toHaveProperty('suggestion');
    }
  });

  it('reports error for invalid skill path', async () => {
    const result = await handleAudit({ skill_path: join(TEST_DIR, 'nonexistent.md') });
    expect(result.riskLevel).toBe('unknown');
    expect(result.pass).toBe(false);
    expect(result.findings[0]?.rule).toBe('parse-error');
    expect(result.findings[0]?.suggestion).toBeDefined();
  });
});

describe('tracepact_list_tests', () => {
  it('finds test files and cassettes', () => {
    const result = handleListTests({ skill_path: join(TEST_DIR, 'SKILL.md') });
    expect(result.tests.length).toBeGreaterThan(0);
    expect(result.tests.some((t) => t.name === 'deploy.test.ts')).toBe(true);
    expect(result.cassettes.length).toBeGreaterThan(0);
    expect(result.cassettes.some((c) => c.name === 'deploy.json')).toBe(true);
  });
});
