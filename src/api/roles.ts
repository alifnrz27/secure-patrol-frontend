import { apiFetch } from '@/lib/api/client';
import type { ListParams, Paginated, Role } from '@/lib/api/types';

export interface CreateRoleBody {
  code: string;
  name: string;
  description: string;
  is_active: boolean;
}

export type UpdateRoleBody = Omit<CreateRoleBody, 'code'>;

export const rolesApi = {
  list: (params: ListParams) => apiFetch<Paginated<Role>>('/roles', { query: { ...params } }),
  create: (body: CreateRoleBody) => apiFetch<Role>('/roles', { method: 'POST', json: body }),
  update: (id: number, body: UpdateRoleBody) => apiFetch<Role>(`/roles/${id}`, { method: 'PUT', json: body }),
  remove: (id: number) => apiFetch<null>(`/roles/${id}`, { method: 'DELETE' }),
};
