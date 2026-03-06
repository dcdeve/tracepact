import { AuditEngine, parseSkill } from '@tracepact/core';
import type { AuditReport, AuditSeverity } from '@tracepact/core';

const SEVERITY_ICONS: Record<AuditSeverity, string> = {
  critical: '\u26D4',
  high: '\u26A0\uFE0F',
  medium: '\u2139\uFE0F',
  low: '\uD83D\uDCA1',
};

const SEVERITY_ORDER: Record<AuditSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

interface AuditOptions {
  format: string;
  failOn?: string;
}

export async function audit(skillPath: string, opts: AuditOptions): Promise<void> {
  const skill = await parseSkill(skillPath).catch((err: any) => {
    console.error(`Error parsing ${skillPath}: ${err.message}`);
    process.exit(2);
  });

  const engine = new AuditEngine();
  const report = engine.auditSkill(skill);

  if (opts.format === 'json') {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printSummary(report);
  }

  if (opts.failOn) {
    const threshold = SEVERITY_ORDER[opts.failOn as AuditSeverity] ?? 1;
    const hasViolation = report.findings.some((f) => SEVERITY_ORDER[f.severity] <= threshold);
    if (hasViolation) {
      process.exit(1);
    }
  } else if (!report.pass) {
    process.exit(1);
  }
}

function printSummary(report: AuditReport): void {
  console.log('');
  console.log(
    `  Audit Report (${report.summary.total} finding${report.summary.total === 1 ? '' : 's'})`
  );
  console.log('');

  if (report.findings.length === 0) {
    console.log('  No issues found.');
    console.log('');
    return;
  }

  const sorted = [...report.findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  for (const f of sorted) {
    const icon = SEVERITY_ICONS[f.severity];
    console.log(`  ${icon} ${f.severity}: ${f.message}`);
    if (f.suggestion) {
      console.log(`     ${f.suggestion}`);
    }
  }

  console.log('');
  const parts: string[] = [];
  if (report.summary.critical > 0) parts.push(`${report.summary.critical} critical`);
  if (report.summary.high > 0) parts.push(`${report.summary.high} high`);
  if (report.summary.medium > 0) parts.push(`${report.summary.medium} medium`);
  if (report.summary.low > 0) parts.push(`${report.summary.low} low`);
  console.log(`  Summary: ${parts.join(', ')}`);
  console.log(`  Result: ${report.pass ? 'PASS' : 'FAIL'}`);
  console.log('');
}
