import { describe, expect, it } from 'vitest';
import { pageTitle, toBrandingState } from './branding';

describe('branding', () => {
  it('builds a data URL for a custom logo and falls back to the built-in logo', () => {
    expect(toBrandingState({ app_name: 'Patroli Kita', logo_base64: 'iVBORw0K', logo_mime_type: 'image/png', logo_updated_at: '2026-09-30T10:00:00+07:00', updated_at: '' })).toEqual({
      appName: 'Patroli Kita',
      logoUrl: 'data:image/png;base64,iVBORw0K',
      logoUpdatedAt: '2026-09-30T10:00:00+07:00',
    });
    expect(toBrandingState({ app_name: ' ', logo_base64: null, logo_mime_type: null, logo_updated_at: null, updated_at: '' })).toEqual({
      appName: 'Secure Patrol',
      logoUrl: null,
      logoUpdatedAt: null,
    });
  });

  it('formats document titles', () => {
    expect(pageTitle('Dashboard', 'Patroli Kita')).toBe('Dashboard — Patroli Kita');
    expect(pageTitle(null, 'Patroli Kita')).toBe('Patroli Kita');
  });
});
