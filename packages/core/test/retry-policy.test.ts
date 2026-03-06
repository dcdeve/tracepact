import { describe, expect, it } from 'vitest';
import { RetryPolicy } from '../src/driver/retry-policy.js';
import { DriverError } from '../src/errors/driver-error.js';

describe('RetryPolicy', () => {
  it('succeeds on first try', async () => {
    const policy = new RetryPolicy({ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 });
    const result = await policy.execute(async () => 'ok');
    expect(result).toBe('ok');
  });

  it('retries on 429 then succeeds', async () => {
    const policy = new RetryPolicy({ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 });
    let attempt = 0;
    const result = await policy.execute(async () => {
      attempt++;
      if (attempt === 1) {
        const err: any = new Error('rate limited');
        err.status = 429;
        throw err;
      }
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(attempt).toBe(2);
  });

  it('retries on 500 then succeeds', async () => {
    const policy = new RetryPolicy({ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 });
    let attempt = 0;
    const result = await policy.execute(async () => {
      attempt++;
      if (attempt === 1) {
        const err: any = new Error('server error');
        err.status = 500;
        throw err;
      }
      return 'ok';
    });
    expect(result).toBe('ok');
  });

  it('does not retry on 401', async () => {
    const policy = new RetryPolicy({ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 });
    let attempt = 0;
    await expect(
      policy.execute(async () => {
        attempt++;
        const err: any = new Error('unauthorized');
        err.status = 401;
        throw err;
      })
    ).rejects.toThrow(DriverError);
    expect(attempt).toBe(1);
  });

  it('does not retry on 400', async () => {
    const policy = new RetryPolicy({ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 });
    let attempt = 0;
    await expect(
      policy.execute(async () => {
        attempt++;
        const err: any = new Error('bad request');
        err.status = 400;
        throw err;
      })
    ).rejects.toThrow(DriverError);
    expect(attempt).toBe(1);
  });

  it('throws after exhausting retries', async () => {
    const policy = new RetryPolicy({ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 });
    let attempt = 0;
    await expect(
      policy.execute(async () => {
        attempt++;
        const err: any = new Error('always failing');
        err.status = 429;
        throw err;
      })
    ).rejects.toThrow(DriverError);
    expect(attempt).toBe(3);
  });

  it('respects Retry-After header', () => {
    const policy = new RetryPolicy({ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 60000 });
    const err: any = new Error('rate limited');
    err.headers = { 'retry-after': '2' };
    const delay = policy.computeDelay(0, err);
    expect(delay).toBe(2000);
  });

  it('uses exponential backoff with jitter', () => {
    const policy = new RetryPolicy({ maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 60000 });
    const d0 = policy.computeDelay(0);
    const d1 = policy.computeDelay(1);
    const d2 = policy.computeDelay(2);
    // Exponential base: 100, 200, 400. With jitter up to half.
    expect(d0).toBeGreaterThanOrEqual(100);
    expect(d0).toBeLessThanOrEqual(150);
    expect(d1).toBeGreaterThanOrEqual(200);
    expect(d1).toBeLessThanOrEqual(300);
    expect(d2).toBeGreaterThanOrEqual(400);
    expect(d2).toBeLessThanOrEqual(600);
  });
});
