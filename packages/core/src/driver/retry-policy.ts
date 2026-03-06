import { DEFAULT_RETRY } from '../config/defaults.js';
import { DriverError } from '../errors/driver-error.js';
import { log } from '../logger.js';

export class RetryPolicy {
  private maxAttempts: number;
  private baseDelayMs: number;
  private maxDelayMs: number;

  constructor(config?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  }) {
    this.maxAttempts = config?.maxAttempts ?? DEFAULT_RETRY.maxAttempts;
    this.baseDelayMs = config?.baseDelayMs ?? DEFAULT_RETRY.baseDelayMs;
    this.maxDelayMs = config?.maxDelayMs ?? DEFAULT_RETRY.maxDelayMs;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;

        if (!this.isRetryable(err)) {
          throw this.wrapError(err);
        }

        if (attempt < this.maxAttempts - 1) {
          const delay = this.computeDelay(attempt, err);
          log.info(`Retry attempt ${attempt + 1}/${this.maxAttempts} after ${delay}ms.`);
          await sleep(delay);
        }
      }
    }

    throw this.wrapError(lastError as Error);
  }

  private isRetryable(err: any): boolean {
    const status = err.status ?? err.statusCode;
    if (status === 429 || status === 500 || status === 502 || status === 503 || status === 529) {
      return true;
    }
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
      return true;
    }
    return false;
  }

  computeDelay(attempt: number, err?: any): number {
    const retryAfter = err?.headers?.['retry-after'];
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (!Number.isNaN(seconds)) return seconds * 1000;
    }

    const exponential = this.baseDelayMs * 2 ** attempt;
    const jitter = Math.random() * (exponential / 2);
    return Math.min(exponential + jitter, this.maxDelayMs);
  }

  private wrapError(err: any): DriverError {
    const status = err.status ?? err.statusCode;
    if (status === 401) return new DriverError('Invalid API key.');
    if (status === 400) return new DriverError(`Bad request: ${err.message}`);
    return new DriverError(`Provider error: ${err.message}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
