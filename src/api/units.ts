import { apiFetch } from '@/lib/api/client';
import type { ListParams, Paginated, Unit } from '@/lib/api/types';

export interface UnitListParams extends ListParams {
  is_active?: boolean;
}

export interface UnitBody {
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
}

export const unitsApi = {
  list: (params: UnitListParams) => apiFetch<Paginated<Unit>>('/units', { query: { ...params } }),
  create: (body: UnitBody) => apiFetch<Unit>('/units', { method: 'POST', json: body }),
  update: (id: number, body: UnitBody) => apiFetch<Unit>(`/units/${id}`, { method: 'PUT', json: body }),
  remove: (id: number) => apiFetch<null>(`/units/${id}`, { method: 'DELETE' }),
};
