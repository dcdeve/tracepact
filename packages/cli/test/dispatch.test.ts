import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/commands/run.js', () => ({
  runTests: vi.fn(),
}));
vi.mock('../src/commands/init.js', () => ({
  init: vi.fn(),
}));
vi.mock('../src/commands/cache.js', () => ({
  cache: vi.fn(),
}));
vi.mock('../src/commands/cost-report.js', () => ({
  costReport: vi.fn(),
}));
vi.mock('../src/commands/doctor.js', () => ({
  doctor: vi.fn(),
}));
vi.mock('../src/commands/audit.js', () => ({
  audit: vi.fn(),
}));
vi.mock('../src/commands/capture.js', () => ({
  capture: vi.fn(),
}));

import { audit } from '../src/commands/audit.js';
import { doctor } from '../src/commands/doctor.js';
import { runTests } from '../src/commands/run.js';
import { createProgram } from '../src/index.js';

function parse(...args: string[]) {
  const program = createProgram();
  program.exitOverride();
  return program.parseAsync(['node', 'tracepact', ...args]);
}

describe('dispatch', () => {
  it('defaults to runTests when no subcommand given', async () => {
    await parse();
    expect(runTests).toHaveBeenCalledWith(expect.objectContaining({}), []);
  });

  it('defaults to runTests with flags when no subcommand matched', async () => {
    await parse('--provider', 'openai', '--budget', '5000');
    expect(runTests).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'openai', budget: '5000' }),
      []
    );
  });

  it('explicit "run" subcommand calls runTests', async () => {
    await parse('run', '--live');
    expect(runTests).toHaveBeenCalledWith(expect.objectContaining({ live: true }), []);
  });

  it('routes to doctor', async () => {
    await parse('doctor');
    expect(doctor).toHaveBeenCalled();
  });

  it('routes to audit with positional arg', async () => {
    await parse('audit', 'SKILL.md');
    expect(audit).toHaveBeenCalledWith('SKILL.md', expect.objectContaining({ format: 'summary' }));
  });

  it('passes vitest args through for run', async () => {
    await parse('run', '--live', '--', '--reporter=verbose');
    expect(runTests).toHaveBeenCalledWith(expect.objectContaining({ live: true }), [
      '--reporter=verbose',
    ]);
  });
});
