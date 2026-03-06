import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { TracepactError } from '../errors/base.js';

export interface Scenario {
  name: string;
  [key: string]: unknown;
}

export async function loadScenarios(filePath: string): Promise<Scenario[]> {
  const resolved = resolve(filePath);
  const raw = await readFile(resolved, 'utf-8');
  const ext = extname(resolved).toLowerCase();

  let data: unknown;
  if (ext === '.json') {
    data = JSON.parse(raw);
  } else if (ext === '.yaml' || ext === '.yml') {
    data = parseYaml(raw);
  } else {
    throw new TracepactError(
      'SCENARIO_LOAD_ERROR',
      `Unsupported scenario file format: ${ext}. Use .json or .yaml`
    );
  }

  if (!Array.isArray(data)) {
    throw new TracepactError(
      'SCENARIO_LOAD_ERROR',
      `Scenario file must contain an array. Got ${typeof data}.`
    );
  }

  if (data.length === 0) {
    throw new TracepactError('SCENARIO_LOAD_ERROR', 'Scenario file contains an empty array.');
  }

  for (let i = 0; i < data.length; i++) {
    if (typeof data[i] !== 'object' || data[i] == null) {
      throw new TracepactError('SCENARIO_LOAD_ERROR', `Scenario at index ${i} must be an object.`);
    }
    if (!('name' in data[i]) || typeof data[i].name !== 'string') {
      throw new TracepactError(
        'SCENARIO_LOAD_ERROR',
        `Scenario at index ${i} must have a string "name" field.`
      );
    }
  }

  return data as Scenario[];
}
