// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MAX_PHOTO_BYTES, passwordSchema, validateImageFile } from './validation';

const jpegHeader = [0xff, 0xd8, 0xff, 0xe0];
const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function file(bytes: number[], size: number, name = 'x.jpg', type = 'image/jpeg') {
  const data = new Uint8Array(size);
  data.set(bytes);
  return new File([data], name, { type });
}

describe('validateImageFile', () => {
  it('accepts a JPEG of exactly 5 MB and a PNG', async () => {
    expect(await validateImageFile(file(jpegHeader, MAX_PHOTO_BYTES))).toBeNull();
    expect(await validateImageFile(file(pngHeader, 1024, 'x.png', 'image/png'))).toBeNull();
  });

  it('rejects files over 5 MB', async () => {
    expect(await validateImageFile(file(jpegHeader, MAX_PHOTO_BYTES + 1))).toBe('Ukuran file maksimal 5 MB.');
  });

  it('rejects non-images even with an image extension', async () => {
    const text = new File(['hello world'], 'fake.jpg', { type: 'image/jpeg' });
    expect(await validateImageFile(text)).toBe('File harus berupa gambar JPEG atau PNG.');
  });
});

describe('passwordSchema', () => {
  it('requires 8–72 chars with a letter and a digit', () => {
    expect(passwordSchema.safeParse('Password123').success).toBe(true);
    expect(passwordSchema.safeParse('short1').success).toBe(false);
    expect(passwordSchema.safeParse('onlyletters').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(false);
    expect(passwordSchema.safeParse(`a1${'x'.repeat(71)}`).success).toBe(false);
  });
});
