import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { log } from '../../logger.js';
import type { ContainerToolResult } from './types.js';

const exec = promisify(execFile);

export class DockerClient {
  private runtime: 'docker' | 'podman';

  constructor(runtime?: 'docker' | 'podman') {
    this.runtime = runtime ?? detectRuntime();
  }

  getRuntime(): 'docker' | 'podman' {
    return this.runtime;
  }

  async createContainer(config: {
    image: string;
    mounts: Array<{ host: string; container: string }>;
    network: 'none' | 'bridge';
    limits: { cpu?: string; memory?: string };
    workdir?: string;
  }): Promise<string> {
    const args = [
      'create',
      '--network',
      config.network,
      '--workdir',
      config.workdir ?? '/workspace',
    ];

    if (config.limits.cpu) args.push('--cpus', config.limits.cpu);
    if (config.limits.memory) args.push('--memory', config.limits.memory);

    for (const mount of config.mounts) {
      args.push('-v', `${mount.host}:${mount.container}`);
    }

    args.push(config.image, 'sleep', 'infinity');

    const { stdout } = await exec(this.runtime, args);
    const containerId = stdout.trim();
    await exec(this.runtime, ['start', containerId]);
    log.info(`Container created: ${containerId.slice(0, 12)}`);
    return containerId;
  }

  async execInContainer(
    containerId: string,
    command: string[],
    timeout: number
  ): Promise<ContainerToolResult> {
    const start = performance.now();
    try {
      const { stdout, stderr } = await exec(this.runtime, ['exec', containerId, ...command], {
        timeout,
      });
      return { stdout, stderr, exitCode: 0, durationMs: performance.now() - start };
    } catch (err: any) {
      return {
        stdout: err.stdout ?? '',
        stderr: err.stderr ?? err.message,
        exitCode: err.code ?? 1,
        durationMs: performance.now() - start,
      };
    }
  }

  async readFile(containerId: string, path: string): Promise<string> {
    const result = await this.execInContainer(containerId, ['cat', path], 5000);
    if (result.exitCode !== 0) throw new Error(`Cannot read ${path}: ${result.stderr}`);
    return result.stdout;
  }

  async writeFile(containerId: string, path: string, content: string): Promise<void> {
    const child = execFile(this.runtime, ['exec', '-i', containerId, 'tee', path], {
      timeout: 5000,
    });
    if (child.stdin) {
      child.stdin.write(content);
      child.stdin.end();
    }
    await new Promise<void>((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`tee exited with code ${code}`));
      });
      child.on('error', reject);
    });
  }

  async destroyContainer(containerId: string): Promise<void> {
    try {
      await exec(this.runtime, ['rm', '-f', containerId]);
      log.info(`Container destroyed: ${containerId.slice(0, 12)}`);
    } catch (err: any) {
      log.warn(`Failed to destroy container ${containerId.slice(0, 12)}: ${err.message}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await exec(this.runtime, ['info'], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string | null> {
    try {
      const { stdout } = await exec(this.runtime, ['--version'], { timeout: 3000 });
      return stdout.trim();
    } catch {
      return null;
    }
  }
}

export function detectRuntime(): 'docker' | 'podman' {
  try {
    execFileSync('docker', ['--version'], { timeout: 3000, stdio: 'pipe' });
    return 'docker';
  } catch {
    try {
      execFileSync('podman', ['--version'], { timeout: 3000, stdio: 'pipe' });
      return 'podman';
    } catch {
      throw new Error('Neither Docker nor Podman found. Container sandbox requires one of them.');
    }
  }
}
