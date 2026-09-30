import { apiFetch } from '@/lib/api/client';
import type { Setting, SettingValue } from '@/lib/api/types';

export const settingsApi = {
  /** Head office: global values, or one unit's values with unitId. Unit users: their unit. */
  list: (unitId?: number) => apiFetch<Setting[]>('/settings', { query: { unit_id: unitId } }),
  /**
   * Only the given keys change; all-or-nothing on the server. `null` = back to the
   * default (Super-Admin, global) or back to the head office value (unit users).
   */
  update: (values: Record<string, SettingValue | null>) => apiFetch<Setting[]>('/settings', { method: 'PUT', json: { values } }),
};
