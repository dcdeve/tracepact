import type { AuditFinding, AuditInput, AuditRule } from './types.js';

export const toolComboRisk: AuditRule = {
  name: 'tool-combo-risk',
  description: 'Detects risky combinations of tool capabilities',
  check(input: AuditInput): AuditFinding[] {
    const tools = input.tools ?? [];
    const has = (name: string) => tools.some((t) => t.toLowerCase().includes(name));

    const hasBash = has('bash') || has('shell') || has('exec') || has('command');
    const hasWrite = has('write') || has('create_file') || has('save');
    const hasNetwork =
      has('http') || has('fetch') || has('curl') || has('network') || has('request');

    if (hasBash && hasWrite && hasNetwork) {
      return [
        {
          rule: 'tool-combo-risk',
          severity: 'critical',
          message: 'Agent has bash + write + network tools — can exfiltrate data.',
          suggestion:
            'Remove network access or add strict allowlists for bash and write operations.',
        },
      ];
    }

    if (hasBash && hasWrite) {
      return [
        {
          rule: 'tool-combo-risk',
          severity: 'high',
          message: 'Agent has bash + write tools — can modify filesystem arbitrarily.',
          suggestion: 'Add filesystem allowlists to restrict write paths.',
        },
      ];
    }

    if (hasBash) {
      return [
        {
          rule: 'tool-combo-risk',
          severity: 'medium',
          message: 'Agent has bash/shell access.',
          suggestion: 'Add a bash command allowlist to restrict executable commands.',
        },
      ];
    }

    return [];
  },
};

export const promptHygiene: AuditRule = {
  name: 'prompt-hygiene',
  description: 'Checks system prompt for scope declaration and instruction anchoring',
  check(input: AuditInput): AuditFinding[] {
    const body = input.body ?? '';
    const findings: AuditFinding[] = [];

    if (body.length === 0) {
      findings.push({
        rule: 'prompt-hygiene',
        severity: 'high',
        message: 'System prompt body is empty.',
        suggestion: 'Add a system prompt that declares the agent scope and constraints.',
      });
      return findings;
    }

    const lower = body.toLowerCase();
    const hasScope =
      lower.includes('you are') ||
      lower.includes('your role') ||
      lower.includes('your task') ||
      lower.includes('scope') ||
      lower.includes('you must') ||
      lower.includes('your job');

    if (!hasScope) {
      findings.push({
        rule: 'prompt-hygiene',
        severity: 'high',
        message: 'No scope declaration found in system prompt.',
        suggestion:
          'Add a clear scope statement like "You are a code reviewer. Your task is..." to anchor the agent\'s behavior.',
      });
    }

    const hasConstraints =
      lower.includes('do not') ||
      lower.includes("don't") ||
      lower.includes('never') ||
      lower.includes('must not') ||
      lower.includes('only') ||
      lower.includes('restricted to');

    if (!hasConstraints) {
      findings.push({
        rule: 'prompt-hygiene',
        severity: 'medium',
        message: 'No explicit constraints found in system prompt.',
        suggestion:
          'Add constraints like "Do not modify files outside /src" to limit agent behavior.',
      });
    }

    return findings;
  },
};

export const skillCompleteness: AuditRule = {
  name: 'skill-completeness',
  description: 'Checks that SKILL.md has all recommended fields',
  check(input: AuditInput): AuditFinding[] {
    const findings: AuditFinding[] = [];

    if (!input.name) {
      findings.push({
        rule: 'skill-completeness',
        severity: 'medium',
        message: 'Missing "name" field in frontmatter.',
        suggestion: 'Add a name to identify this skill.',
      });
    }

    if (!input.description) {
      findings.push({
        rule: 'skill-completeness',
        severity: 'medium',
        message: 'Missing "description" field in frontmatter.',
        suggestion: 'Add a description explaining what this agent does.',
      });
    }

    if (!input.triggers || input.triggers.length === 0) {
      findings.push({
        rule: 'skill-completeness',
        severity: 'medium',
        message: 'Missing "triggers" field in frontmatter.',
        suggestion: 'Add triggers to declare when this agent should activate.',
      });
    }

    if (!input.excludes || input.excludes.length === 0) {
      findings.push({
        rule: 'skill-completeness',
        severity: 'low',
        message: 'Missing "excludes" field in frontmatter.',
        suggestion: 'Add excludes to declare what this agent should NOT do.',
      });
    }

    if (!input.tools || input.tools.length === 0) {
      findings.push({
        rule: 'skill-completeness',
        severity: 'medium',
        message: 'Missing "tools" field in frontmatter.',
        suggestion: 'Declare the tools this agent uses for transparency.',
      });
    }

    return findings;
  },
};

export const noOpaqueTools: AuditRule = {
  name: 'no-opaque-tools',
  description: 'Flags tools without descriptions',
  check(input: AuditInput): AuditFinding[] {
    // This rule only applies when tools are provided as objects with names
    // With string-only tool lists, we can't check for descriptions
    // So we just verify tools are declared at all
    const tools = input.tools ?? [];
    if (tools.length === 0) return [];

    // In the current model, tools are strings. This rule will be more
    // useful when tool definitions include descriptions. For now, we
    // check if any tool name is suspiciously vague.
    const vague = tools.filter((t) => {
      const name = t.toLowerCase();
      return (
        name === 'tool' ||
        name === 'run' ||
        name === 'do' ||
        name === 'process' ||
        name === 'execute'
      );
    });

    return vague.map((t) => ({
      rule: 'no-opaque-tools',
      severity: 'medium' as const,
      message: `Tool "${t}" has a vague name — its purpose is unclear.`,
      suggestion: 'Use descriptive tool names like "read_file", "query_database", "send_email".',
    }));
  },
};

export const BUILTIN_RULES: AuditRule[] = [
  toolComboRisk,
  promptHygiene,
  skillCompleteness,
  noOpaqueTools,
];
