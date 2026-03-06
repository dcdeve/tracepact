import { tracepactPlugin } from '@tracepact/vitest';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tracepactPlugin()],
});
