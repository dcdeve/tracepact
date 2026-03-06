export type AuditSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface AuditFinding {
  readonly rule: string;
  readonly severity: AuditSeverity;
  readonly message: string;
  readonly suggestion?: string;
}

export interface AuditInput {
  readonly name?: string;
  readonly description?: string;
  readonly body?: string;
  readonly tools?: readonly string[];
  readonly triggers?: readonly string[];
  readonly excludes?: readonly string[];
}

export interface AuditRule {
  readonly name: string;
  readonly description: string;
  readonly check: (input: AuditInput) => AuditFinding[];
}

export interface AuditReport {
  readonly findings: AuditFinding[];
  readonly pass: boolean;
  readonly summary: {
    readonly critical: number;
    readonly high: number;
    readonly medium: number;
    readonly low: number;
    readonly total: number;
  };
}
