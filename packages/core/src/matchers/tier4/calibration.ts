import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

export interface CalibrationSet {
  name: string;
  examples: CalibrationExample[];
}

export interface CalibrationExample {
  input: string;
  output: string;
  pass: boolean;
  justification: string;
}

const BUNDLED_SETS: Record<string, CalibrationSet> = {
  'code-review': {
    name: 'code-review',
    examples: [
      {
        input: 'Review this code for security issues',
        output:
          'The code contains a SQL injection vulnerability on line 5. User input is directly concatenated into the query string. Use parameterized queries instead.',
        pass: true,
        justification: 'Correctly identifies SQL injection and suggests parameterized queries.',
      },
      {
        input: 'Review this code for security issues',
        output: 'The code looks fine.',
        pass: false,
        justification: 'Fails to identify the SQL injection vulnerability.',
      },
      {
        input: 'Review this code for security issues',
        output:
          "There might be some issues with the code. I'd recommend looking at the database queries more carefully.",
        pass: false,
        justification:
          "Identifies the general area but doesn't name the specific vulnerability or suggest a fix.",
      },
    ],
  },
  deploy: {
    name: 'deploy',
    examples: [
      {
        input: 'Deploy the application to staging',
        output:
          'Running deployment pipeline: 1) Built Docker image app:v2.1.0, 2) Pushed to registry, 3) Updated staging Kubernetes deployment, 4) Verified health check passed. Deployment complete.',
        pass: true,
        justification: 'Follows a clear deployment sequence with verification step.',
      },
      {
        input: 'Deploy the application to staging',
        output: 'I deployed it.',
        pass: false,
        justification: 'No details about what was done or verification that it succeeded.',
      },
      {
        input: 'Deploy the application to staging',
        output: "I'll deploy to production right away.",
        pass: false,
        justification:
          'Deploys to production instead of staging, violating the requested target environment.',
      },
    ],
  },
  documentation: {
    name: 'documentation',
    examples: [
      {
        input: 'Document the authentication module',
        output:
          '## Authentication Module\n\n### Overview\nHandles user authentication via JWT tokens.\n\n### API\n- `login(email, password)` — Returns JWT token on success\n- `verify(token)` — Validates token and returns user payload\n- `refresh(token)` — Issues new token before expiry\n\n### Configuration\nSet `JWT_SECRET` environment variable. Token TTL defaults to 1 hour.',
        pass: true,
        justification:
          'Structured documentation with overview, API reference, and configuration details.',
      },
      {
        input: 'Document the authentication module',
        output: 'This module does auth stuff.',
        pass: false,
        justification: 'Too vague. No API reference, no structure, no useful information.',
      },
      {
        input: 'Document the authentication module',
        output:
          "The authentication module uses bcrypt for password hashing and JWT for session tokens. It exposes login and logout endpoints but I'm not sure about the exact parameters.",
        pass: false,
        justification:
          'Partially informative but lacks structure and admits uncertainty about the API.',
      },
    ],
  },
};

export const BUNDLED_NAMES = Object.keys(BUNDLED_SETS);

export function loadBundledCalibration(name: string): CalibrationSet {
  const set = BUNDLED_SETS[name];
  if (!set) {
    throw new Error(`Calibration set "${name}" not found. Available: ${BUNDLED_NAMES.join(', ')}.`);
  }
  return set;
}

export async function loadCustomCalibration(filePath: string): Promise<CalibrationSet> {
  const raw = await readFile(resolve(filePath), 'utf-8');
  const data = parseYaml(raw);
  return { name: filePath, examples: data.examples ?? data };
}
