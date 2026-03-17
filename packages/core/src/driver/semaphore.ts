import { log } from '../logger.js';

/** How long (ms) a queued acquire() logs a warning. Default: 10 s. */
const WARN_AFTER_MS = 10_000;

export class Semaphore {
  private current = 0;
  private queue: Array<() => void> = [];

  /**
   * @param max - Maximum number of concurrent slots.
   * @param timeoutMs - If provided, `acquire()` rejects after this many ms
   *   if a slot hasn't become available. Prevents deadlocks caused by
   *   callers that forget to call `release()`.
   */
  constructor(
    private readonly max: number,
    private readonly timeoutMs?: number
  ) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /** Number of callers currently waiting for a slot. Useful for diagnostics. */
  getQueueLength(): number {
    return this.queue.length;
  }

  private acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const start = Date.now();

      // Warn if the caller is waiting suspiciously long.
      const warnTimer = setTimeout(() => {
        if (!settled) {
          log.warn(
            `[semaphore] acquire() has been waiting ${WARN_AFTER_MS} ms — queue length: ${this.queue.length}. Possible deadlock or severe back-pressure.`
          );
        }
      }, WARN_AFTER_MS);

      const resolver = () => {
        settled = true;
        clearTimeout(warnTimer);
        resolve();
      };

      this.queue.push(resolver);

      // Optional hard timeout: reject and evict from queue.
      if (this.timeoutMs !== undefined) {
        const { timeoutMs } = this;
        setTimeout(() => {
          if (settled) return;
          settled = true;
          clearTimeout(warnTimer);
          const idx = this.queue.indexOf(resolver);
          if (idx !== -1) this.queue.splice(idx, 1);
          const waited = Date.now() - start;
          reject(
            new Error(`[semaphore] acquire() timed out after ${waited} ms (limit: ${timeoutMs} ms)`)
          );
        }, timeoutMs);
      }
    });
  }

  private release(): void {
    this.current--;
    const next = this.queue.shift();
    if (next) {
      this.current++;
      next();
    }
  }
}
