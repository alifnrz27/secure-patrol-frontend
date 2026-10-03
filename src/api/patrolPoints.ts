import { apiFetch } from '@/lib/api/client';
import type { ListParams, Paginated, PatrolPoint } from '@/lib/api/types';

export interface PatrolPointBody {
  name: string;
  location: string;
  nfc_code: string;
  latitude: number;
  longitude: number;
  is_location_match_required: boolean;
  is_face_validation_required: boolean;
  /** Optional; null/omitted on update takes the point out of its area. */
  area_id: number | null;
}

export const patrolPointsApi = {
  list: (params: ListParams & { unit_id?: number; area_id?: number }) => apiFetch<Paginated<PatrolPoint>>('/patrol-points', { query: { ...params } }),
  get: (id: number) => apiFetch<PatrolPoint>(`/patrol-points/${id}`),
  create: (body: PatrolPointBody) => apiFetch<PatrolPoint>('/patrol-points', { method: 'POST', json: body }),
  update: (id: number, body: PatrolPointBody) =>
    apiFetch<PatrolPoint>(`/patrol-points/${id}`, { method: 'PUT', json: body }),
  remove: (id: number) => apiFetch<null>(`/patrol-points/${id}`, { method: 'DELETE' }),
};
