import { constants, accessSync, existsSync, mkdirSync } from 'node:fs';
import { PROVIDER_ENV_KEYS } from '@tracepact/core';

export async function doctor(): Promise<void> {
  let hasCriticalFailure = false;

  // 1. Node version
  const nodeVersion = Number.parseInt(process.versions.node.split('.')[0] as string);
  if (nodeVersion >= 20) {
    pass('Node.js', `v${process.versions.node}`);
  } else {
    fail('Node.js', `v${process.versions.node} (requires >=20)`);
    hasCriticalFailure = true;
  }

  // 2. Vitest installed
  try {
    await import('vitest');
    pass('Vitest', 'installed');
  } catch {
    fail('Vitest', 'not found — run `npm install vitest`');
    hasCriticalFailure = true;
  }

  // 3. Config file
  const configFile = ['tracepact.config.ts', 'tracepact.config.js'].find((f) => existsSync(f));
  if (configFile) {
    pass('Config', configFile);
  } else {
    warn('Config', 'not found — run `tracepact init` (only needed for live tests)');
  }

  // 4. SKILL.md
  if (existsSync('SKILL.md')) {
    pass('SKILL.md', 'found');
  } else {
    info('SKILL.md', 'not found (not required for --system-prompt mode)');
  }

  // 5. API keys — check all known providers
  const foundKeys: string[] = [];
  for (const [provider, envKey] of Object.entries(PROVIDER_ENV_KEYS)) {
    if (process.env[envKey]) {
      pass(`${provider} API key`, `${envKey} is set`);
      foundKeys.push(provider);
    }
  }
  if (foundKeys.length === 0) {
    info('API keys', 'No provider API keys found (not required for mock-only tests)');
  }

  // 6. Container runtime
  try {
    const { execFileSync } = await import('node:child_process');
    try {
      const version = execFileSync('docker', ['--version'], { timeout: 3000, stdio: 'pipe' })
        .toString()
        .trim();
      pass('Container runtime', version);
    } catch {
      try {
        const version = execFileSync('podman', ['--version'], { timeout: 3000, stdio: 'pipe' })
          .toString()
          .trim();
        pass('Container runtime', version);
      } catch {
        info('Container runtime', 'not found (not required for mock/live tests)');
      }
    }
  } catch {
    info('Container runtime', 'check skipped');
  }

  // 7. Cache directory
  const cacheDir = '.tracepact/cache';
  try {
    mkdirSync(cacheDir, { recursive: true });
    accessSync(cacheDir, constants.W_OK);
    pass('Cache dir', `${cacheDir} (writable)`);
  } catch {
    warn('Cache dir', `${cacheDir} is not writable`);
  }

  console.log('');
  if (hasCriticalFailure) {
    console.log('Critical issues found. Fix them before running tests.');
    process.exitCode = 2;
  } else {
    console.log('All critical checks passed.');
  }
}

function pass(label: string, detail: string) {
  console.log(`  [ok] ${label}: ${detail}`);
}
function fail(label: string, detail: string) {
  console.log(`  [FAIL] ${label}: ${detail}`);
}
function warn(label: string, detail: string) {
  console.log(`  [warn] ${label}: ${detail}`);
}
function info(label: string, detail: string) {
  console.log(`  [info] ${label}: ${detail}`);
}
