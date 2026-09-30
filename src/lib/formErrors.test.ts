import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { applyServerErrors } from './formErrors';

type Form = { email: string; name: string; nfc_code: string };

describe('applyServerErrors', () => {
  it('maps validation messages and business errors to fields', () => {
    const setError = vi.fn();
    const error = new ApiError(422, 'Validation error', ["email failed on 'email' validation", "name failed on 'max=150' validation", 'something else']);
    const rest = applyServerErrors<Form>(error, setError, ['email', 'name', 'nfc_code']);
    expect(setError).toHaveBeenCalledWith('email', { type: 'server', message: 'Format email tidak valid.' });
    expect(setError).toHaveBeenCalledWith('name', { type: 'server', message: 'Maksimal 150 karakter.' });
    expect(rest).toEqual(['something else']);
  });

  it('maps a 409 conflict by message fragment', () => {
    const setError = vi.fn();
    const error = new ApiError(409, 'Conflict', 'nfc code is already used by another patrol point');
    const rest = applyServerErrors<Form>(error, setError, ['nfc_code'], { 'nfc code': 'nfc_code' });
    expect(setError).toHaveBeenCalledWith('nfc_code', { type: 'server', message: 'Kode NFC sudah dipakai (bisa di unit lain).' });
    expect(rest).toEqual([]);
  });
});
