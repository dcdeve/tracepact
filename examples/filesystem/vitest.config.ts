import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.tracepact.ts'],
    setupFiles: ['@tracepact/vitest/setup'],
  },
});
