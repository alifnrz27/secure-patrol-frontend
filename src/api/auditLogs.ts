import { apiFetch } from '@/lib/api/client';
import type { AuditAction, AuditLog, Paginated } from '@/lib/api/types';

export interface AuditLogParams {
  page?: number;
  limit?: number;
  /** Path, IP, or an exact data ID */
  search?: string;
  user_id?: number;
  action?: AuditAction;
  resource?: string;
  date_from?: string;
  date_to?: string;
}

export const auditLogsApi = {
  list: (params: AuditLogParams) => apiFetch<Paginated<AuditLog>>('/audit-logs', { query: { ...params } }),
};
