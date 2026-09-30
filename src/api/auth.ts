import { apiFetch } from '@/lib/api/client';
import type { User } from '@/lib/api/types';

export const authApi = {
  me: () => apiFetch<User>('/auth/me'),
  changePassword: (body: { old_password: string; password: string; password_confirmation: string }) =>
    apiFetch<null>('/auth/change-password', { method: 'PUT', json: body }),
};
