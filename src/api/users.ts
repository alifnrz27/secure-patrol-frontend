import { apiFetch } from '@/lib/api/client';
import type { ListParams, Paginated, User } from '@/lib/api/types';

export interface UserListParams extends ListParams {
  role_id?: number;
  is_active?: boolean;
}

export interface UserFormValues {
  name: string;
  email: string;
  role_id: number;
  is_active: boolean;
  face_photo?: File | null;
  password?: string;
  password_confirmation?: string;
}

function toFormData(values: UserFormValues): FormData {
  const form = new FormData();
  form.append('name', values.name.trim());
  form.append('email', values.email.trim());
  form.append('role_id', String(values.role_id));
  form.append('is_active', String(values.is_active));
  if (values.password !== undefined) form.append('password', values.password);
  if (values.password_confirmation !== undefined) form.append('password_confirmation', values.password_confirmation);
  if (values.face_photo) form.append('face_photo', values.face_photo, values.face_photo.name);
  return form;
}

export const usersApi = {
  list: (params: UserListParams) => apiFetch<Paginated<User>>('/users', { query: { ...params } }),
  get: (id: number) => apiFetch<User>(`/users/${id}`),
  create: (values: UserFormValues) => apiFetch<User>('/users', { method: 'POST', form: toFormData(values) }),
  update: (id: number, values: UserFormValues) =>
    apiFetch<User>(`/users/${id}`, { method: 'PUT', form: toFormData(values) }),
  remove: (id: number) => apiFetch<null>(`/users/${id}`, { method: 'DELETE' }),
  resetPassword: (id: number, body: { password: string; password_confirmation: string }) =>
    apiFetch<null>(`/users/${id}/reset-password`, { method: 'PUT', json: body }),
  facePhotoPath: (id: number) => `/api/v1/users/${id}/face-photo`,
};
