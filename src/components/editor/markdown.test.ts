import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { articleExtensions, getArticleMarkdown } from './extensions';

function roundTrip(markdown: string): string {
  const editor = new Editor({ extensions: articleExtensions(), content: markdown, contentType: 'markdown' });
  const out = getArticleMarkdown(editor);
  editor.destroy();
  return out;
}

describe('article editor markdown', () => {
  it('keeps headings, emphasis, lists, links and quotes', () => {
    const md = [
      '## Langkah patroli',
      '',
      'Pastikan **HP terisi daya** dan *GPS aktif*. Lihat [panduan](https://example.com/panduan).',
      '',
      '1. Buka aplikasi',
      '2. Tempelkan HP ke tag NFC',
      '',
      '- Foto maksimal 3',
      '- Catatan wajib jika tidak normal',
      '',
      '> Hubungi kepala keamanan jika ragu.',
    ].join('\n');
    const out = roundTrip(md);
    for (const part of ['## Langkah patroli', '**HP terisi daya**', '*GPS aktif*', '[panduan](https://example.com/panduan)', '1. Buka aplikasi', '2. Tempelkan HP', '- Foto maksimal 3', '> Hubungi kepala']) {
      expect(out).toContain(part);
    }
  });

  it('keeps GFM tables', () => {
    const out = roundTrip('| Shift | Jam |\n| --- | --- |\n| 1 | 08:00-16:00 |');
    expect(out).toMatch(/\|\s*Shift\s*\|\s*Jam\s*\|/);
    expect(out).toMatch(/\|\s*1\s*\|\s*08:00-16:00\s*\|/);
  });

  it('never outputs raw HTML or javascript: links', () => {
    const out = roundTrip('Teks <script>alert(1)</script>\n\n<img src=x onerror="alert(2)">\n\n[klik](javascript:alert(3))');
    expect(out).not.toMatch(/<script|onerror|javascript:/i);
    expect(out).toContain('klik');
  });

  it('keeps safe links next to removed unsafe ones', () => {
    expect(roundTrip('[a](javascript:x) [b](https://a.com) [c](mailto:x@y.id)')).toBe('a [b](https://a.com) [c](mailto:x@y.id)');
  });
});
