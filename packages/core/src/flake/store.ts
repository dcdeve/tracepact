import { mkdir, readFile, writeFile } from 'node:fs/promises';

export interface FlakeEntry {
  testId: string;
  pass: boolean;
  timestamp: string;
}

export interface FlakeScore {
  testId: string;
  passCount: number;
  failCount: number;
  totalRuns: number;
  failureRate: number;
  isFlaky: boolean;
  lastRun: string;
}

interface FlakeHistory {
  entries: FlakeEntry[];
  version: number;
}

const MAX_ENTRIES_PER_TEST = 10;
const FLAKY_MIN_RUNS = 3;
const FLAKY_THRESHOLD = 0.1;

export class FlakeStore {
  private history: FlakeHistory = { entries: [], version: 1 };
  private path: string;

  constructor(path = '.tracepact/flake-history.json') {
    this.path = path;
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.path, 'utf-8');
      this.history = JSON.parse(raw);
    } catch {
      this.history = { entries: [], version: 1 };
    }
  }

  record(testId: string, pass: boolean): void {
    this.history.entries.push({
      testId,
      pass,
      timestamp: new Date().toISOString(),
    });
    this.trim();
  }

  getScore(testId: string): FlakeScore {
    const entries = this.history.entries.filter((e) => e.testId === testId);
    const passCount = entries.filter((e) => e.pass).length;
    const failCount = entries.length - passCount;
    const failureRate = entries.length > 0 ? failCount / entries.length : 0;

    return {
      testId,
      passCount,
      failCount,
      totalRuns: entries.length,
      failureRate,
      isFlaky: entries.length >= FLAKY_MIN_RUNS && failureRate > FLAKY_THRESHOLD,
      lastRun: entries[entries.length - 1]?.timestamp ?? '',
    };
  }

  getAllScores(): FlakeScore[] {
    const testIds = [...new Set(this.history.entries.map((e) => e.testId))];
    return testIds.map((id) => this.getScore(id));
  }

  async save(): Promise<void> {
    const dir = this.path.substring(0, this.path.lastIndexOf('/'));
    if (dir) await mkdir(dir, { recursive: true });
    await writeFile(this.path, JSON.stringify(this.history, null, 2));
  }

  private trim(): void {
    const byTest = new Map<string, FlakeEntry[]>();
    for (const entry of this.history.entries) {
      const list = byTest.get(entry.testId) ?? [];
      list.push(entry);
      byTest.set(entry.testId, list);
    }
    for (const [id, entries] of byTest) {
      if (entries.length > MAX_ENTRIES_PER_TEST) {
        byTest.set(id, entries.slice(-MAX_ENTRIES_PER_TEST));
      }
    }
    this.history.entries = [...byTest.values()].flat();
  }
}
