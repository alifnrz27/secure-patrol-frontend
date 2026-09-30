import { apiFetch } from '@/lib/api/client';
import type { PatrolShift } from '@/lib/api/types';

export interface PatrolShiftBody {
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export const patrolShiftsApi = {
  list: () => apiFetch<PatrolShift[]>('/patrol-shifts'),
  create: (body: PatrolShiftBody) => apiFetch<PatrolShift>('/patrol-shifts', { method: 'POST', json: body }),
  update: (id: number, body: PatrolShiftBody) =>
    apiFetch<PatrolShift>(`/patrol-shifts/${id}`, { method: 'PUT', json: body }),
  remove: (id: number) => apiFetch<null>(`/patrol-shifts/${id}`, { method: 'DELETE' }),
};
