import { describe, expect, it } from 'vitest';
import { coverage, segmentsOf, toMinutes } from './timeline';

describe('shift timeline', () => {
  it('parses HH:MM including 24:00', () => {
    expect(toMinutes('08:30')).toBe(510);
    expect(toMinutes('24:00')).toBe(1440);
    expect(toMinutes('24:01')).toBeNull();
    expect(toMinutes('8:00')).toBeNull();
  });

  it('splits shifts that cross midnight', () => {
    expect(segmentsOf({ start_time: '08:00', end_time: '16:00' })).toEqual([[480, 960]]);
    expect(segmentsOf({ start_time: '22:00', end_time: '06:00' })).toEqual([[1320, 1440], [0, 360]]);
    expect(segmentsOf({ start_time: '16:00', end_time: '24:00' })).toEqual([[960, 1440]]);
  });

  it('reports gaps and overlaps', () => {
    const ranges = coverage([
      { start_time: '00:00', end_time: '08:00' },
      { start_time: '07:00', end_time: '16:00' },
    ]);
    expect(ranges).toEqual([
      { from: 0, to: 420, count: 1 },
      { from: 420, to: 480, count: 2 },
      { from: 480, to: 960, count: 1 },
      { from: 960, to: 1440, count: 0 },
    ]);
  });
});
