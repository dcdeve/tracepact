import { createHash } from 'node:crypto';
import type { ParsedSkill } from '../parser/types.js';
import type { TypedToolDefinition } from '../tools/types.js';

export interface RunManifest {
  readonly skillHash: string;
  readonly promptHash: string;
  readonly toolDefsHash: string;
  readonly provider: string;
  readonly model: string;
  readonly modelVersion?: string;
  readonly temperature: number;
  readonly seed?: number;
  readonly frameworkVersion: string;
  readonly driverVersion: string;
}

export function computeManifest(params: {
  skill: ParsedSkill | { systemPrompt: string };
  prompt: string;
  tools?: TypedToolDefinition[];
  provider: string;
  model: string;
  modelVersion?: string;
  temperature: number;
  seed?: number;
  frameworkVersion: string;
  driverVersion: string;
}): RunManifest {
  const skillHash = 'hash' in params.skill ? params.skill.hash : sha256(params.skill.systemPrompt);

  const manifest: RunManifest = {
    skillHash,
    promptHash: sha256(params.prompt),
    toolDefsHash: sha256(
      JSON.stringify((params.tools ?? []).map((t) => ({ name: t.name, schema: t.jsonSchema })))
    ),
    provider: params.provider,
    model: params.model,
    temperature: params.temperature,
    frameworkVersion: params.frameworkVersion,
    driverVersion: params.driverVersion,
  };

  if (params.modelVersion !== undefined) {
    (manifest as any).modelVersion = params.modelVersion;
  }
  if (params.seed !== undefined) {
    (manifest as any).seed = params.seed;
  }

  return manifest;
}

export function manifestHash(manifest: RunManifest): string {
  const sorted = JSON.stringify(manifest, Object.keys(manifest).sort());
  return sha256(sorted);
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
