import { describe, expect, it } from 'vitest';
import { ApiError, describeError, translateServerMessage } from './errors';

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

  it('shows how long a locked account stays locked', () => {
    const error = new ApiError(429, 'account is temporarily locked because of too many failed login attempts', { locked_until: '2026-09-30T10:05:00+07:00', retry_after_seconds: 241 });
    expect(describeError(error)).toBe('Akun terkunci karena terlalu banyak salah password. Coba lagi dalam 5 menit.');
  });

  it('translates the web platform block and setting range errors', () => {
    expect(describeError(new ApiError(403, 'Forbidden', 'your role is not allowed to sign in on this platform'))).toBe('Akun Anda tidak memiliki akses ke web admin. Gunakan aplikasi mobile.');
    expect(translateServerMessage('must be between 1 and 10000')).toBe('Harus antara 1 dan 10000.');
  });
});
