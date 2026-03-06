import { describe, expect, it } from 'vitest';
import { Semaphore } from '../src/driver/semaphore.js';

describe('Semaphore', () => {
  it('allows tasks under the limit to run immediately', async () => {
    const sem = new Semaphore(5);
    const results: number[] = [];

    await Promise.all(
      [1, 2, 3].map((n) =>
        sem.run(async () => {
          results.push(n);
          return n;
        })
      )
    );

    expect(results).toHaveLength(3);
  });

  it('blocks tasks at the limit until a slot frees', async () => {
    const sem = new Semaphore(2);
    const order: string[] = [];
    let resolve1!: () => void;
    const blocker1 = new Promise<void>((r) => {
      resolve1 = r;
    });

    // Start 2 tasks that block
    const t1 = sem.run(async () => {
      order.push('t1-start');
      await blocker1;
      order.push('t1-end');
    });

    const t2Promise = sem.run(async () => {
      order.push('t2-start');
      return 't2';
    });

    // Third task should be queued
    const t3Promise = sem.run(async () => {
      order.push('t3-start');
      return 't3';
    });

    // Wait for t2 to complete (it should start immediately since limit=2)
    await t2Promise;

    // After t2 completes, t3 should get a slot
    await t3Promise;

    // Now release t1
    resolve1();
    await t1;

    expect(order).toContain('t1-start');
    expect(order).toContain('t2-start');
    expect(order).toContain('t3-start');
  });

  it('releases slot when task throws', async () => {
    const sem = new Semaphore(1);

    // First task throws
    await expect(
      sem.run(async () => {
        throw new Error('fail');
      })
    ).rejects.toThrow('fail');

    // Second task should still be able to run
    const result = await sem.run(async () => 'ok');
    expect(result).toBe('ok');
  });

  it('handles concurrent tasks correctly', async () => {
    const sem = new Semaphore(3);
    let maxConcurrent = 0;
    let current = 0;

    const tasks = Array.from({ length: 10 }, (_, i) =>
      sem.run(async () => {
        current++;
        if (current > maxConcurrent) maxConcurrent = current;
        await new Promise((r) => setTimeout(r, 10));
        current--;
        return i;
      })
    );

    const results = await Promise.all(tasks);
    expect(results).toHaveLength(10);
    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });
});
