import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { doctor } from '../src/commands/doctor.js';

describe('doctor', () => {
  const logs: string[] = [];
  const originalLog = console.log;

  beforeEach(() => {
    logs.length = 0;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '));
    };
  });

  afterEach(() => {
    console.log = originalLog;
  });

  it('checks Node.js version', async () => {
    await doctor();
    const nodeLog = logs.find((l) => l.includes('Node.js'));
    expect(nodeLog).toBeDefined();
    expect(nodeLog).toContain('[ok]');
  });

  it('checks for Vitest', async () => {
    await doctor();
    const vitestLog = logs.find((l) => l.includes('Vitest'));
    expect(vitestLog).toBeDefined();
    expect(vitestLog).toContain('[ok]');
  });

  it('reports missing config', async () => {
    await doctor();
    const configLog = logs.find((l) => l.includes('Config'));
    expect(configLog).toBeDefined();
    // No config file in test dir
    expect(configLog).toContain('[warn]');
  });

  it('reports SKILL.md status', async () => {
    await doctor();
    const skillLog = logs.find((l) => l.includes('SKILL.md'));
    expect(skillLog).toBeDefined();
    // SKILL.md exists at repo root — [ok]; if missing — [info]
    expect(skillLog).toMatch(/\[(ok|info)\]/);
  });

  it('reports cache dir status', async () => {
    await doctor();
    const cacheLog = logs.find((l) => l.includes('Cache dir'));
    expect(cacheLog).toBeDefined();
  });
});
