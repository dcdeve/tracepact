import { AuditEngine, BUILTIN_RULES, parseSkill } from '@tracepact/core';
import type { AuditFinding } from '@tracepact/core';

export async function handleAudit(args: { skill_path: string }): Promise<{
  riskLevel: string;
  pass: boolean;
  findings: AuditFinding[];
  summary: { critical: number; high: number; medium: number; low: number; total: number };
}> {
  try {
    const skill = await parseSkill(args.skill_path);
    const engine = new AuditEngine(BUILTIN_RULES);
    const report = engine.auditSkill(skill);

    let riskLevel = 'none';
    if (report.summary.critical > 0) riskLevel = 'critical';
    else if (report.summary.high > 0) riskLevel = 'high';
    else if (report.summary.medium > 0) riskLevel = 'medium';
    else if (report.summary.low > 0) riskLevel = 'low';

    return {
      riskLevel,
      pass: report.pass,
      findings: report.findings,
      summary: report.summary,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      riskLevel: 'unknown',
      pass: false,
      findings: [
        {
          rule: 'parse-error',
          severity: 'critical',
          message,
          suggestion: 'Check that the file exists and has valid YAML frontmatter.',
        },
      ],
      summary: { critical: 1, high: 0, medium: 0, low: 0, total: 1 },
    };
  }
}
