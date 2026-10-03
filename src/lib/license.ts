import type { LicenseStatus, LicenseSummary } from '@/lib/api/types';

/** missing / expired / invalid: only the Super-Admin can work, on the License page. */
export function isLicenseLocked(status: LicenseStatus | null | undefined): boolean {
  return status === 'missing' || status === 'expired' || status === 'invalid';
}

export interface LicenseBanner {
  color: 'yellow' | 'red';
  message: string;
}

/** Yellow when an active license ends within 30 days, red during the grace period. */
export function licenseBanner(license: LicenseSummary | null | undefined): LicenseBanner | null {
  if (!license) return null;
  if (license.status === 'grace') {
    const days = license.days_left ?? 0;
    return { color: 'red', message: `License sudah berakhir. Sistem akan terkunci dalam ${days} hari. Hubungi vendor.` };
  }
  if (license.status === 'active' && license.days_left !== null && license.days_left !== undefined && license.days_left <= 30) {
    return { color: 'yellow', message: `License berakhir dalam ${license.days_left} hari.` };
  }
  return null;
}

export const LICENSE_STATUS_LABEL: Record<LicenseStatus, { label: string; color: string }> = {
  active: { label: 'Aktif', color: 'green' },
  grace: { label: 'Masa tenggang', color: 'orange' },
  expired: { label: 'Berakhir', color: 'red' },
  missing: { label: 'Belum dipasang', color: 'gray' },
  invalid: { label: 'Tidak valid', color: 'red' },
};
