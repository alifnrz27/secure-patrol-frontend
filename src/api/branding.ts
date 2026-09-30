import { apiFetch } from '@/lib/api/client';
import type { Branding } from '@/lib/api/types';

export interface BrandingUpdate {
  app_name: string;
  /** Omitted = keep the current logo. */
  logo?: File | null;
  /** true = back to the built-in logo. */
  remove_logo?: boolean;
}

export const brandingApi = {
  /** Public (signed app request only), so the login page can show it. */
  get: () => apiFetch<Branding>('/branding', { auth: false }),
  update: (values: BrandingUpdate) => {
    const form = new FormData();
    form.append('app_name', values.app_name.trim());
    if (values.logo) form.append('logo', values.logo, values.logo.name);
    if (values.remove_logo) form.append('remove_logo', 'true');
    return apiFetch<Branding>('/branding', { method: 'PUT', form });
  },
};
