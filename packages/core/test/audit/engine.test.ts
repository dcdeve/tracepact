import { describe, expect, it } from 'vitest';
import { AuditEngine } from '../../src/audit/engine.js';
import type { AuditInput, AuditRule } from '../../src/audit/types.js';

describe('AuditEngine', () => {
  describe('tool-combo-risk', () => {
    it('critical: bash + write + network', () => {
      const report = new AuditEngine().audit({
        tools: ['bash', 'write_file', 'http_request'],
      });
      const finding = report.findings.find((f) => f.rule === 'tool-combo-risk');
      expect(finding?.severity).toBe('critical');
      expect(report.pass).toBe(false);
    });

    it('high: bash + write', () => {
      const report = new AuditEngine().audit({
        tools: ['bash', 'write_file'],
      });
      const finding = report.findings.find((f) => f.rule === 'tool-combo-risk');
      expect(finding?.severity).toBe('high');
    });

    it('medium: bash only', () => {
      const report = new AuditEngine().audit({
        tools: ['bash', 'read_file'],
      });
      const finding = report.findings.find((f) => f.rule === 'tool-combo-risk');
      expect(finding?.severity).toBe('medium');
    });

    it('clean: read_file only', () => {
      const report = new AuditEngine().audit({
        tools: ['read_file'],
      });
      const combos = report.findings.filter((f) => f.rule === 'tool-combo-risk');
      expect(combos).toHaveLength(0);
    });
  });

  describe('prompt-hygiene', () => {
    it('flags empty body', () => {
      const report = new AuditEngine().audit({ body: '' });
      const findings = report.findings.filter((f) => f.rule === 'prompt-hygiene');
      expect(findings.some((f) => f.severity === 'high')).toBe(true);
    });

    it('flags missing scope declaration', () => {
      const report = new AuditEngine().audit({
        body: 'Read the file and summarize it.',
      });
      const findings = report.findings.filter((f) => f.rule === 'prompt-hygiene');
      expect(findings.some((f) => f.message.includes('scope'))).toBe(true);
    });

    it('passes with scope and constraints', () => {
      const report = new AuditEngine().audit({
        body: 'You are a code reviewer. You must only review files in /src. Do not modify any files.',
      });
      const findings = report.findings.filter((f) => f.rule === 'prompt-hygiene');
      expect(findings).toHaveLength(0);
    });
  });

  describe('skill-completeness', () => {
    it('flags missing fields', () => {
      const report = new AuditEngine().audit({});
      const findings = report.findings.filter((f) => f.rule === 'skill-completeness');
      expect(findings.length).toBeGreaterThanOrEqual(4);
    });

    it('passes with all fields', () => {
      const report = new AuditEngine().audit({
        name: 'code-reviewer',
        description: 'Reviews code for issues',
        triggers: ['review this code'],
        excludes: ['modify files'],
        tools: ['read_file'],
      });
      const findings = report.findings.filter((f) => f.rule === 'skill-completeness');
      expect(findings).toHaveLength(0);
    });
  });

  describe('no-opaque-tools', () => {
    it('flags vague tool names', () => {
      const report = new AuditEngine().audit({
        tools: ['read_file', 'process', 'run'],
      });
      const findings = report.findings.filter((f) => f.rule === 'no-opaque-tools');
      expect(findings).toHaveLength(2);
    });

    it('passes with descriptive names', () => {
      const report = new AuditEngine().audit({
        tools: ['read_file', 'write_file', 'query_database'],
      });
      const findings = report.findings.filter((f) => f.rule === 'no-opaque-tools');
      expect(findings).toHaveLength(0);
    });
  });

  describe('report', () => {
    it('pass is true when no critical/high findings', () => {
      const report = new AuditEngine().audit({
        name: 'safe-agent',
        description: 'A safe agent',
        body: 'You are a helper. Do not access the network.',
        tools: ['read_file'],
        triggers: ['help me'],
        excludes: ['delete files'],
      });
      expect(report.pass).toBe(true);
    });

    it('pass is false with critical findings', () => {
      const report = new AuditEngine().audit({
        tools: ['bash', 'write_file', 'fetch'],
      });
      expect(report.pass).toBe(false);
    });

    it('summary counts are correct', () => {
      const report = new AuditEngine().audit({
        tools: ['bash'],
        body: '',
      });
      expect(report.summary.total).toBe(report.findings.length);
      expect(
        report.summary.critical + report.summary.high + report.summary.medium + report.summary.low
      ).toBe(report.summary.total);
    });
  });

  describe('custom rules', () => {
    it('accepts custom audit rules', () => {
      const customRule: AuditRule = {
        name: 'no-production-tools',
        description: 'No production deployment tools',
        check: (input: AuditInput) => {
          const tools = input.tools ?? [];
          return tools
            .filter((t) => t.includes('deploy'))
            .map((t) => ({
              rule: 'no-production-tools',
              severity: 'critical' as const,
              message: `Tool "${t}" gives agent production access.`,
            }));
        },
      };

      const engine = new AuditEngine([customRule]);
      const report = engine.audit({ tools: ['read_file', 'deploy_service'] });
      expect(report.findings).toHaveLength(1);
      expect(report.findings[0]?.severity).toBe('critical');
    });
  });

  describe('auditSkill', () => {
    it('extracts fields from ParsedSkill', () => {
      const engine = new AuditEngine();
      const report = engine.auditSkill({
        frontmatter: {
          name: 'test-skill',
          description: 'A test skill',
          tools: ['bash', 'write_file'],
          triggers: ['test'],
          excludes: ['delete'],
        },
        body: 'You are a test agent. Do not access the network.',
        hash: 'abc123',
        parseWarnings: [],
        filePath: '/test/SKILL.md',
      });
      expect(report.summary.total).toBeGreaterThan(0);
      const combo = report.findings.find((f) => f.rule === 'tool-combo-risk');
      expect(combo?.severity).toBe('high');
    });
  });
});
