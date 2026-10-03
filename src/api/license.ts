import { apiFetch } from '@/lib/api/client';
import type { License, LicensePublicStatus } from '@/lib/api/types';

export const licenseApi = {
  /** Public: the app checks this before the login page. */
  status: () => apiFetch<LicensePublicStatus>('/license/status', { auth: false }),
  get: () => apiFetch<License>('/license'),
  install: (code: string) => apiFetch<License>('/license', { method: 'PUT', json: { code: code.trim() } }),
};
