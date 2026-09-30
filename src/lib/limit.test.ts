import { describe, expect, it } from 'vitest';
import { createLimiter } from './limit';

describe('createLimiter', () => {
  it('never runs more than the limit at once and runs everything', async () => {
    const run = createLimiter(5);
    let active = 0;
    let peak = 0;
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        run(async () => {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise((r) => setTimeout(r, 5));
          active -= 1;
          return i;
        }),
      ),
    );
    expect(peak).toBe(5);
    expect(results).toEqual(Array.from({ length: 12 }, (_, i) => i));
  });

  it('keeps going after a failed task', async () => {
    const run = createLimiter(1);
    await expect(run(async () => { throw new Error('x'); })).rejects.toThrow('x');
    await expect(run(async () => 'ok')).resolves.toBe('ok');
  });
});
