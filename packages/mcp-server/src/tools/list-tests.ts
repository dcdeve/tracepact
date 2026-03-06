import { readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

interface TestFile {
  path: string;
  name: string;
}

interface CassetteFile {
  path: string;
  name: string;
}

export function handleListTests(args: { skill_path: string }): {
  tests: TestFile[];
  cassettes: CassetteFile[];
} {
  const skillDir = dirname(resolve(args.skill_path));
  const tests: TestFile[] = [];
  const cassettes: CassetteFile[] = [];

  // Search for test files
  scanDir(skillDir, (filePath, name) => {
    if (name.endsWith('.test.ts') || name.endsWith('.test.js')) {
      tests.push({ path: filePath, name });
    }
  });

  // Search for cassettes
  const cassetteDirs = [join(skillDir, 'cassettes'), join(skillDir, '__cassettes__')];
  for (const dir of cassetteDirs) {
    try {
      scanDir(dir, (filePath, name) => {
        if (name.endsWith('.json')) {
          cassettes.push({ path: filePath, name });
        }
      });
    } catch {
      // Directory doesn't exist
    }
  }

  return { tests, cassettes };
}

function scanDir(dir: string, cb: (path: string, name: string) => void): void {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isFile()) {
          cb(fullPath, entry);
        } else if (stat.isDirectory() && entry !== 'node_modules' && entry !== 'dist') {
          scanDir(fullPath, cb);
        }
      } catch {
        // Skip inaccessible files
      }
    }
  } catch {
    // Directory doesn't exist or not readable
  }
}
