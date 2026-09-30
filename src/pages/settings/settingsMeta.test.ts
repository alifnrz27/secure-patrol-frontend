import { describe, expect, it } from 'vitest';
import type { Setting } from '@/lib/api/types';
import { formatSettingValue, validateSetting } from './settingsMeta';

const radius: Setting = {
  key: 'patrol_location_radius_meters', level: 'global', global_value: 100, is_inherited: false,
  group: 'patrol', type: 'number', value: 100, default_value: 100, is_default: true,
  min: 1, max: 10000, unit: 'meters', description: '', updated_by: null, updated_at: null,
};
const attempts: Setting = { ...radius, key: 'login_max_failed_attempts', group: 'security', type: 'integer', value: 3, min: 1, max: 20, unit: 'attempts' };

describe('settings', () => {
  it('validates with the server bounds and type', () => {
    expect(validateSetting(radius, 150)).toBeNull();
    expect(validateSetting(radius, 0)).toBe('Minimal 1.');
    expect(validateSetting(radius, 10001)).toBe('Maksimal 10.000.');
    expect(validateSetting(attempts, 2.5)).toBe('Harus bilangan bulat.');
    expect(validateSetting(attempts, undefined)).toBe('Wajib diisi.');
  });

  it('formats values with Indonesian units', () => {
    expect(formatSettingValue(radius)).toBe('100 m');
    expect(formatSettingValue(attempts)).toBe('3 kali');
    expect(formatSettingValue({ ...radius, type: 'boolean', unit: '', value: true })).toBe('Aktif');
  });
});
