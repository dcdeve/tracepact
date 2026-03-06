import { log } from '../logger.js';
import type { ToolResult } from '../trace/types.js';
import { MockSandbox } from './mock-sandbox.js';
import type { MockBashResult, MockToolDefs, MockToolImpl } from './types.js';

export function createMockTools(defs: MockToolDefs): MockSandbox {
  return new MockSandbox(defs);
}

export function mockReadFile(files: Record<string, string>): MockToolImpl {
  const exactPaths = new Map<string, string>();
  const globPatterns: Array<{ regex: RegExp; content: string }> = [];

  for (const [key, content] of Object.entries(files)) {
    if (key.includes('*')) {
      globPatterns.push({ regex: globToRegex(key), content });
    } else {
      exactPaths.set(key, content);
    }
  }

  return (args) => {
    const path = String(args.path ?? '');

    if (exactPaths.has(path)) {
      return { type: 'success', content: exactPaths.get(path) as string };
    }

    for (const { regex, content } of globPatterns) {
      if (regex.test(path)) {
        return { type: 'success', content };
      }
    }

    log.warn(`MockSandbox: No fixture for '${path}'. Define it in mockReadFile().`);
    return { type: 'error', message: `File not found: ${path}` };
  };
}

export function captureWrites(): MockToolImpl {
  return () => ({ type: 'success', content: '' });
}

export const mockWriteFile = captureWrites;

export function denyAll(): MockToolImpl {
  return () => ({ type: 'error', message: 'Tool is denied in this test.' });
}

export function mockBash(commands: Record<string, MockBashResult>): MockToolImpl {
  const entries: Array<{ matcher: string; result: MockBashResult }> = [];

  for (const [key, result] of Object.entries(commands)) {
    entries.push({ matcher: key, result });
  }

  return (args) => {
    const command = String(args.command ?? '');

    for (const { matcher, result } of entries) {
      if (command === matcher) {
        if (result.error) {
          return { type: 'error', message: result.error };
        }
        const stdout = result.stdout ?? '';
        const stderr = result.stderr ?? '';
        const exitCode = result.exitCode ?? 0;
        return (
          exitCode === 0
            ? { type: 'success', content: stdout }
            : { type: 'error', message: `Exit code ${exitCode}: ${stderr || stdout}` }
        ) as ToolResult;
      }
    }

    return { type: 'error', message: `No mock defined for command: '${command}'.` };
  };
}

export function passthrough(): MockToolImpl {
  return () => ({ type: 'success', content: '' });
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\0GLOBSTAR\0')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\0GLOBSTAR\0/g, '(?:.*/)?');
  return new RegExp(`^${escaped}$`);
}
