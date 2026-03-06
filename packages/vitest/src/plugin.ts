import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function tracepactPlugin(): Plugin {
  return {
    name: 'tracepact',
    config() {
      return {
        test: {
          include: ['**/*.tracepact.ts', '**/*.tracepact.js'],
          setupFiles: [resolve(__dirname, 'setup.js')],
          testTimeout: 30_000,
        },
      };
    },
  };
}
