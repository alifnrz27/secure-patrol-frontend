import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { isApiError, translateServerMessage } from '@/lib/api/errors';

const VALIDATION_PATTERN = /^([a-z0-9_]+) failed on '([a-z_]+)(?:=([^']*))?' validation$/i;

function translateValidationTag(tag: string, param?: string): string {
  switch (tag) {
    case 'required':
      return 'Wajib diisi.';
    case 'email':
      return 'Format email tidak valid.';
    case 'max':
      return `Maksimal ${param} karakter.`;
    case 'min':
      return `Minimal ${param} karakter.`;
    case 'len':
      return `Harus ${param} karakter.`;
    case 'eqfield':
      return 'Konfirmasi tidak sama.';
    case 'gt':
    case 'gte':
      return param === '0' ? 'Wajib dipilih.' : `Minimal ${param}.`;
    case 'lte':
      return `Maksimal ${param}.`;
    case 'oneof':
      return `Harus salah satu dari: ${param?.split(' ').join(', ')}.`;
    default:
      return 'Nilai tidak valid.';
  }
}

/**
 * Puts server errors on form fields. `messageFields` maps a fragment of a
 * business error message (e.g. "email is already registered") to a field.
 * Returns the messages that could not be placed on a field.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
  messageFields: Partial<Record<string, Path<T>>> = {},
): string[] {
  if (!isApiError(error)) return [];
  const unplaced: string[] = [];
  const messages = error.details.length ? error.details : [error.serverMessage];
  for (const message of messages) {
    const validation = VALIDATION_PATTERN.exec(message);
    if (validation && (fields as readonly string[]).includes(validation[1])) {
      setError(validation[1] as Path<T>, { type: 'server', message: translateValidationTag(validation[2], validation[3]) });
      continue;
    }
    const match = Object.entries(messageFields).find(([fragment]) => message.toLowerCase().includes(fragment.toLowerCase()));
    if (match?.[1]) {
      setError(match[1], { type: 'server', message: translateServerMessage(message) });
      continue;
    }
    unplaced.push(message);
  }
  return unplaced;
}
