import type { ParsedSkill } from '../parser/types.js';
import { BUILTIN_RULES } from './rules.js';
import type { AuditInput, AuditReport, AuditRule } from './types.js';

export class AuditEngine {
  private rules: AuditRule[];

  constructor(rules?: AuditRule[]) {
    this.rules = rules ?? BUILTIN_RULES;
  }

  addRule(rule: AuditRule): void {
    this.rules.push(rule);
  }

  auditSkill(skill: ParsedSkill): AuditReport {
    const fm = skill.frontmatter;
    const input: AuditInput = {
      name: fm.name,
      body: skill.body,
      ...(fm.description ? { description: fm.description } : {}),
      ...(fm.tools ? { tools: fm.tools.map((t) => String(t)) } : {}),
      ...(fm.triggers ? { triggers: fm.triggers.map((t) => String(t)) } : {}),
      ...(fm.excludes ? { excludes: fm.excludes.map((t) => String(t)) } : {}),
    };
    return this.audit(input);
  }

  audit(input: AuditInput): AuditReport {
    const findings = this.rules.flatMap((rule) => rule.check(input));

    const summary = {
      critical: findings.filter((f) => f.severity === 'critical').length,
      high: findings.filter((f) => f.severity === 'high').length,
      medium: findings.filter((f) => f.severity === 'medium').length,
      low: findings.filter((f) => f.severity === 'low').length,
      total: findings.length,
    };

    return {
      findings,
      pass: summary.critical === 0 && summary.high === 0,
      summary,
    };
  }
}
