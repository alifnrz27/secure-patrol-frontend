import { describe, expect, it } from 'vitest';
import { ApiError, describeError } from './errors';

describe('describeError', () => {
  it('shows the login reason for 401 instead of a session message', () => {
    expect(describeError(new ApiError(401, 'Unauthorized', 'email or password is incorrect'))).toBe('Email atau password salah.');
    expect(describeError(new ApiError(401, 'Unauthorized', 'Token is invalid'))).toBe('Sesi berakhir, silakan login kembali.');
  });

  it('classifies app signature errors separately and never as a session problem', () => {
    const error = new ApiError(401, 'Unauthorized app', 'request signature is invalid');
    expect(error.kind).toBe('app');
    expect(describeError(error)).toBe('Konfigurasi aplikasi tidak valid. Hubungi admin sistem.');
  });

  it('translates shift overlap conflicts', () => {
    expect(describeError(new ApiError(409, 'Conflict', 'patrol shift overlaps with another active shift: Shift 1 (08:00-16:00)'))).toBe(
      'Jam shift tumpang tindih dengan shift aktif lain: Shift 1 (08:00-16:00).',
    );
  });

  it('translates the export row limit', () => {
    expect(describeError(new ApiError(422, 'Validation error', 'export is limited to 50000 rows, narrow the filter (for example the date range)'))).toBe(
      'Ekspor maksimal 50.000 baris. Persempit filter, misalnya rentang tanggal.',
    );
  });
});
