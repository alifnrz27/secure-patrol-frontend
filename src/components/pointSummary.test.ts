import { describe, expect, it } from 'vitest';
import { barValue, pointStatus } from './pointSummary';

const item = { patrol_point_id: 1, area_id: null, area_name: '', name: 'A', location: '', nfc_code: '', groups: 3, scanned_groups: 3, total_scans: 5, normal_scans: 5, abnormal_scans: 0, officers: 1, first_scanned_at: null, last_scanned_at: null };

describe('point summary', () => {
  it('caps bars at 10 scans and keeps smaller values proportional', () => {
    expect(barValue(0)).toBe(0);
    expect(barValue(4)).toBe(4);
    expect(barValue(10)).toBe(10);
    expect(barValue(37)).toBe(10);
  });

  it('flags points never scanned or missed in some shifts', () => {
    expect(pointStatus({ ...item, total_scans: 0, scanned_groups: 0 })).toBe('unscanned');
    expect(pointStatus({ ...item, scanned_groups: 2 })).toBe('partial');
    expect(pointStatus(item)).toBe('ok');
  });
});
