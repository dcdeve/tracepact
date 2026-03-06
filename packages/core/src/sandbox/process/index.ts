export { ProcessSandbox } from './process-sandbox.js';
export type { ProcessSandboxConfig } from './types.js';

import { ProcessSandbox } from './process-sandbox.js';
import type { ProcessSandboxConfig } from './types.js';

export function createProcessTools(config?: ProcessSandboxConfig): ProcessSandbox {
  return new ProcessSandbox(config);
}
