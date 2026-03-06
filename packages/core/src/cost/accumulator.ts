export interface TokenEntry {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cached: boolean;
}

export interface TokenReport {
  totalInputTokens: number;
  totalOutputTokens: number;
  liveInputTokens: number;
  liveOutputTokens: number;
  byProvider: Record<string, { inputTokens: number; outputTokens: number }>;
  totalApiCalls: number;
  totalCacheHits: number;
}

export class TokenAccumulator {
  private entries: TokenEntry[] = [];

  add(entry: TokenEntry): void {
    this.entries.push(entry);
  }

  get totalTokens(): number {
    return this.entries.reduce((sum, e) => sum + e.inputTokens + e.outputTokens, 0);
  }

  get liveTokens(): number {
    return this.entries
      .filter((e) => !e.cached)
      .reduce((sum, e) => sum + e.inputTokens + e.outputTokens, 0);
  }

  exceedsBudget(maxTokens: number): boolean {
    return this.liveTokens > maxTokens;
  }

  getReport(): TokenReport {
    const byProvider: Record<string, { inputTokens: number; outputTokens: number }> = {};
    for (const e of this.entries) {
      const prev = byProvider[e.provider] ?? { inputTokens: 0, outputTokens: 0 };
      byProvider[e.provider] = {
        inputTokens: prev.inputTokens + e.inputTokens,
        outputTokens: prev.outputTokens + e.outputTokens,
      };
    }

    const live = this.entries.filter((e) => !e.cached);
    const cached = this.entries.filter((e) => e.cached);

    return {
      totalInputTokens: this.entries.reduce((s, e) => s + e.inputTokens, 0),
      totalOutputTokens: this.entries.reduce((s, e) => s + e.outputTokens, 0),
      liveInputTokens: live.reduce((s, e) => s + e.inputTokens, 0),
      liveOutputTokens: live.reduce((s, e) => s + e.outputTokens, 0),
      byProvider,
      totalApiCalls: live.length,
      totalCacheHits: cached.length,
    };
  }

  toJSON(): string {
    return JSON.stringify(this.getReport(), null, 2);
  }
}
