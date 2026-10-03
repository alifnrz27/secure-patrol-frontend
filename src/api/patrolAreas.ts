import { apiFetch } from '@/lib/api/client';
import type { ListParams, Paginated, PatrolArea } from '@/lib/api/types';

export interface PatrolAreaBody {
  name: string;
  description: string;
}

export const patrolAreasApi = {
  list: (params: ListParams & { unit_id?: number }) => apiFetch<Paginated<PatrolArea>>('/patrol-areas', { query: { ...params } }),
  create: (body: PatrolAreaBody) => apiFetch<PatrolArea>('/patrol-areas', { method: 'POST', json: body }),
  update: (id: number, body: PatrolAreaBody) => apiFetch<PatrolArea>(`/patrol-areas/${id}`, { method: 'PUT', json: body }),
  remove: (id: number) => apiFetch<null>(`/patrol-areas/${id}`, { method: 'DELETE' }),
};
