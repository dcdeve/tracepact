import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BUNDLED_NAMES,
  loadBundledCalibration,
  loadCustomCalibration,
} from '../../../src/matchers/tier4/calibration.js';

describe('loadBundledCalibration', () => {
  it('loads code-review set with 3 examples', () => {
    const set = loadBundledCalibration('code-review');
    expect(set.name).toBe('code-review');
    expect(set.examples).toHaveLength(3);
    expect(set.examples[0]).toHaveProperty('pass', true);
    expect(set.examples[1]).toHaveProperty('pass', false);
  });

  it('loads deploy set', () => {
    const set = loadBundledCalibration('deploy');
    expect(set.name).toBe('deploy');
    expect(set.examples.length).toBeGreaterThanOrEqual(2);
  });

  it('loads documentation set', () => {
    const set = loadBundledCalibration('documentation');
    expect(set.name).toBe('documentation');
    expect(set.examples.length).toBeGreaterThanOrEqual(2);
  });

  it('throws on unknown name with available list', () => {
    expect(() => loadBundledCalibration('nonexistent')).toThrow(
      /not found.*Available.*code-review.*deploy.*documentation/
    );
  });

  it('exports BUNDLED_NAMES', () => {
    expect(BUNDLED_NAMES).toContain('code-review');
    expect(BUNDLED_NAMES).toContain('deploy');
    expect(BUNDLED_NAMES).toContain('documentation');
  });
});

describe('loadCustomCalibration', () => {
  const tmpDir = join(import.meta.dirname ?? '.', '__tmp_calibration__');
  const tmpFile = join(tmpDir, 'custom.yaml');

  it('loads custom YAML calibration file', async () => {
    await mkdir(tmpDir, { recursive: true });
    await writeFile(
      tmpFile,
      `examples:
  - input: "test input"
    output: "test output"
    pass: true
    justification: "works"
`
    );

    const set = await loadCustomCalibration(tmpFile);
    expect(set.examples).toHaveLength(1);
    expect(set.examples[0].pass).toBe(true);
    expect(set.examples[0].justification).toBe('works');

    await rm(tmpDir, { recursive: true, force: true });
  });
});
