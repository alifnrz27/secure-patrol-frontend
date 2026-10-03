import { describe, expect, it } from 'vitest';
import { isLicenseLocked, licenseBanner } from './license';

describe('license', () => {
  it('locks only missing, expired and invalid', () => {
    expect(['missing', 'expired', 'invalid'].map((s) => isLicenseLocked(s as never))).toEqual([true, true, true]);
    expect(isLicenseLocked('active')).toBe(false);
    expect(isLicenseLocked('grace')).toBe(false);
  });

  it('shows a yellow banner within 30 days and a red one in grace', () => {
    expect(licenseBanner({ status: 'active', expires_at: null, grace_until: null, days_left: 12 })).toEqual({ color: 'yellow', message: 'License berakhir dalam 12 hari.' });
    expect(licenseBanner({ status: 'active', expires_at: null, grace_until: null, days_left: null })).toBeNull();
    expect(licenseBanner({ status: 'grace', expires_at: null, grace_until: null, days_left: 3 })?.color).toBe('red');
    expect(licenseBanner(null)).toBeNull();
  });
});
