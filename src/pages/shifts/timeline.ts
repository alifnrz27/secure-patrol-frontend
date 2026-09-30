export const DAY_MINUTES = 24 * 60;

export interface TimelineShift {
  id: number | 'draft';
  name: string;
  start_time: string;
  end_time: string;
}

export function toMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h === 24 && m === 0) return DAY_MINUTES;
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** Splits a shift into [start, end) segments within one day; crossing midnight gives two. */
export function segmentsOf(shift: Pick<TimelineShift, 'start_time' | 'end_time'>): [number, number][] {
  const start = toMinutes(shift.start_time);
  const end = toMinutes(shift.end_time);
  if (start === null || end === null || start === DAY_MINUTES) return [];
  if (end > start) return [[start, end]];
  // end <= start: the shift ends the next day.
  const segments: [number, number][] = [[start, DAY_MINUTES]];
  if (end > 0) segments.push([0, end]);
  return segments;
}

export interface CoverageRange {
  from: number;
  to: number;
  count: number;
}

/** Ranges of the day with how many shifts cover them (0 = gap, >1 = overlap). */
export function coverage(shifts: Pick<TimelineShift, 'start_time' | 'end_time'>[]): CoverageRange[] {
  const counts = new Uint8Array(DAY_MINUTES);
  for (const shift of shifts) {
    for (const [from, to] of segmentsOf(shift)) {
      for (let m = from; m < to; m++) counts[m] = (counts[m] ?? 0) + 1;
    }
  }
  const ranges: CoverageRange[] = [];
  let from = 0;
  for (let m = 1; m <= DAY_MINUTES; m++) {
    if (m === DAY_MINUTES || counts[m] !== counts[from]) {
      ranges.push({ from, to: m, count: counts[from]! });
      from = m;
    }
  }
  return ranges;
}

export function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
