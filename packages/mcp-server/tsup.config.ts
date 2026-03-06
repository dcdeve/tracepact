import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: false,
  outDir: 'dist',
  target: 'node20',
  banner: {
    js: '#!/usr/bin/env node',
  },
  external: ['@tracepact/core'],
});
