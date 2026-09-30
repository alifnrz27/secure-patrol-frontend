import { z } from 'zod';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** 8–72 characters with at least one letter and one digit (same rule as the server). */
export const passwordSchema = z
  .string()
  .min(8, 'Minimal 8 karakter.')
  .max(72, 'Maksimal 72 karakter.')
  .regex(/[A-Za-z]/, 'Harus mengandung huruf.')
  .regex(/\d/, 'Harus mengandung angka.');

/**
 * Checks a face photo before upload: size and real image type. file.type only
 * reflects the extension, so the first bytes are checked too.
 */
export async function validateImageFile(file: File, maxBytes = MAX_PHOTO_BYTES): Promise<string | null> {
  if (file.size > maxBytes) return `Ukuran file maksimal ${Math.round(maxBytes / 1024 / 1024)} MB.`;
  if (file.size === 0) return 'File kosong.';
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  if (!isJpeg && !isPng) return 'File harus berupa gambar JPEG atau PNG.';
  return null;
}
