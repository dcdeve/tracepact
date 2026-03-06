import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AuditEngine, parseSkill } from '@tracepact/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TMP_DIR = join(import.meta.dirname, '__audit_test__');

function writeSkill(content: string): string {
  const path = join(TMP_DIR, 'SKILL.md');
  writeFileSync(path, content, 'utf-8');
  return path;
}

beforeAll(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

afterAll(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('tracepact audit (integration)', () => {
  it('passes for a clean skill', async () => {
    const path = writeSkill(`---
name: safe-agent
description: A safe read-only agent
tools:
  - read_file
triggers:
  - review code
excludes:
  - modify files
---
You are a code reviewer. Your task is to review code. Do not modify any files.
`);
    const skill = await parseSkill(path);
    const report = new AuditEngine().auditSkill(skill);
    expect(report.pass).toBe(true);
    expect(report.summary.critical).toBe(0);
    expect(report.summary.high).toBe(0);
  });

  it('fails for risky tool combos', async () => {
    const path = writeSkill(`---
name: risky-agent
description: A risky agent
tools:
  - bash
  - write_file
  - http_request
triggers:
  - do stuff
excludes:
  - nothing
---
You are a general purpose agent. You must help the user. Do not harm the system.
`);
    const skill = await parseSkill(path);
    const report = new AuditEngine().auditSkill(skill);
    expect(report.pass).toBe(false);
    expect(report.findings.some((f) => f.severity === 'critical')).toBe(true);
  });

  it('JSON output is well-formed', async () => {
    const path = writeSkill(`---
name: test
description: test
tools:
  - read_file
triggers:
  - test
excludes:
  - nothing
---
You are a test agent. Do not do anything dangerous.
`);
    const skill = await parseSkill(path);
    const report = new AuditEngine().auditSkill(skill);
    const json = JSON.stringify(report);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveProperty('findings');
    expect(parsed).toHaveProperty('pass');
    expect(parsed).toHaveProperty('summary');
  });

  it('fail-on threshold logic works', async () => {
    const path = writeSkill(`---
name: medium-risk
description: An agent with bash
tools:
  - bash
  - read_file
triggers:
  - help me
excludes:
  - nothing
---
You are a helper agent. Your role is to assist. Do not delete anything.
`);
    const skill = await parseSkill(path);
    const report = new AuditEngine().auditSkill(skill);

    // bash alone = medium severity for tool-combo-risk
    const combo = report.findings.find((f) => f.rule === 'tool-combo-risk');
    expect(combo?.severity).toBe('medium');

    // No critical or high from tool-combo-risk, but check overall
    // With --fail-on high, only critical+high matter
    const highOrAbove = report.findings.filter(
      (f) => f.severity === 'critical' || f.severity === 'high'
    );
    // This skill has proper scope + constraints, so no prompt-hygiene issues
    expect(highOrAbove).toHaveLength(0);

    // With --fail-on medium, medium findings should cause failure
    const mediumOrAbove = report.findings.filter(
      (f) => f.severity === 'critical' || f.severity === 'high' || f.severity === 'medium'
    );
    expect(mediumOrAbove.length).toBeGreaterThan(0);
  });
});
