import { log } from '../logger.js';
import type { ParsedSkill } from '../parser/types.js';
import { BUILTIN_RULES } from './rules.js';
import type { AuditInput, AuditReport, AuditRule } from './types.js';

export class AuditEngine {
  private rules: AuditRule[];

  constructor(rules?: AuditRule[]) {
    this.rules = rules ? [...rules] : [...BUILTIN_RULES];
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
    const findings = this.rules.flatMap((rule) => {
      try {
        return rule.check(input);
      } catch (err) {
        const stack = err instanceof Error ? err.stack : undefined;
        log.warn(`AuditEngine: rule "${rule.name}" threw unexpectedly`, stack ?? String(err));
        return [
          {
            rule: rule.name,
            severity: 'high' as const,
            message: `Rule "${rule.name}" threw an unexpected error: ${err instanceof Error ? err.message : String(err)}`,
            suggestion:
              'This finding was produced by a rule exception, not a real audit result. Check logs for the full stack trace.',
          },
        ];
      }
    });

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
