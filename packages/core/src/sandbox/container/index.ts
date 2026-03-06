export { ContainerSandbox } from './container-sandbox.js';
export { DockerClient, detectRuntime } from './docker-client.js';
export type { ContainerConfig, ContainerToolResult } from './types.js';

export async function createContainerTools(
  config: import('./types.js').ContainerConfig
): Promise<import('./container-sandbox.js').ContainerSandbox> {
  const { ContainerSandbox } = await import('./container-sandbox.js');
  const sandbox = new ContainerSandbox(config);
  await sandbox.initialize();
  return sandbox;
}
