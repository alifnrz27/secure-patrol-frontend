import { apiFetch } from '@/lib/api/client';
import type { AppClient, AppClientCredential, ListParams, Paginated, Platform } from '@/lib/api/types';

export interface CreateAppClientBody {
  name: string;
  platform: Platform;
  description: string;
  expires_at: string | null;
}

export interface UpdateAppClientBody {
  name: string;
  description: string;
  is_active: boolean;
  expires_at: string | null;
}

export const appClientsApi = {
  list: (params: ListParams) => apiFetch<Paginated<AppClient>>('/app-clients', { query: { ...params } }),
  create: (body: CreateAppClientBody) => apiFetch<AppClientCredential>('/app-clients', { method: 'POST', json: body }),
  update: (id: number, body: UpdateAppClientBody) =>
    apiFetch<AppClient>(`/app-clients/${id}`, { method: 'PUT', json: body }),
  remove: (id: number) => apiFetch<null>(`/app-clients/${id}`, { method: 'DELETE' }),
  rotateKey: (id: number, graceHours: number) =>
    apiFetch<AppClientCredential>(`/app-clients/${id}/rotate-key`, {
      method: 'POST',
      json: { grace_period_hours: graceHours },
    }),
};
