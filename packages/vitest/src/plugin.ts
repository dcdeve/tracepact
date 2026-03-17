import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function tracepactPlugin(): Plugin {
  return {
    name: 'tracepact',
    config() {
      const envTimeout = process.env.TRACEPACT_TEST_TIMEOUT
        ? Number(process.env.TRACEPACT_TEST_TIMEOUT)
        : undefined;
      return {
        test: {
          include: ['**/*.tracepact.ts', '**/*.tracepact.js'],
          setupFiles: [resolve(__dirname, 'setup.js')],
          testTimeout: envTimeout ?? 30_000,
        },
      };
    },
  };
}
