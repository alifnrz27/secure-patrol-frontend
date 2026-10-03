import { licenseApi } from '@/api/license';
import type { LicensePublicStatus } from '@/lib/api/types';

// Public license status (GET /license/status), loaded when the app opens so the
// login page can show "License belum aktif" before anyone logs in.

let status: LicensePublicStatus | null = null;
const listeners = new Set<() => void>();

export const licenseGate = {
  get: (): LicensePublicStatus | null => status,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  async load(): Promise<void> {
    try {
      status = await licenseApi.status();
    } catch {
      // Unknown (offline, older backend): the login page works as before.
      status = null;
    }
    listeners.forEach((l) => l());
  },
};
