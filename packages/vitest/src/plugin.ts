import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function tracepactPlugin(): Plugin {
  return {
    name: 'tracepact',
    config() {
      const rawTimeout = process.env.TRACEPACT_TEST_TIMEOUT;
      const parsedTimeout = rawTimeout !== undefined ? Number(rawTimeout) : undefined;
      if (parsedTimeout !== undefined && !Number.isFinite(parsedTimeout)) {
        console.warn(
          `[tracepact] TRACEPACT_TEST_TIMEOUT="${rawTimeout}" is not a valid number — ignoring and using default timeout.`
        );
      }
      const envTimeout =
        parsedTimeout !== undefined && Number.isFinite(parsedTimeout) ? parsedTimeout : undefined;
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
