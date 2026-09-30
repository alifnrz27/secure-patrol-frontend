import { apiFetch, apiFetchBlob } from '@/lib/api/client';
import type {
  Paginated,
  PatrolGroup,
  PatrolGroupDetail,
  PatrolListItem,
  PatrolScan,
  ScanCondition,
} from '@/lib/api/types';

export interface GroupListParams {
  unit_id?: number;
  page?: number;
  limit?: number;
  shift_id?: number;
  date_from?: string;
  date_to?: string;
}

export interface ListItemParams extends GroupListParams {
  search?: string;
  group_id?: number;
  status?: 'scanned' | 'unscanned';
}

export interface ScanListParams extends GroupListParams {
  group_id?: number;
  scanned_by?: number;
  patrol_point_id?: number;
  condition?: ScanCondition;
}

/** Filters the server-side Excel export understands (no condition or group). */
export type ScanExportParams = Pick<ScanListParams, 'unit_id' | 'shift_id' | 'patrol_point_id' | 'scanned_by' | 'date_from' | 'date_to'>;

export const patrolApi = {
  /** .xlsx built by the server, max 50.000 rows. */
  exportScansExcel: (params: ScanExportParams, signal?: AbortSignal) =>
    apiFetchBlob('/patrol-scans/export', { query: { ...params }, signal }),
  /** Head office users must pass unitId (422 "unit_id is required" otherwise). */
  currentGroup: (unitId?: number) => apiFetch<PatrolGroupDetail>('/patrol-groups/current', { query: { unit_id: unitId } }),
  groups: (params: GroupListParams, signal?: AbortSignal) =>
    apiFetch<Paginated<PatrolGroup>>('/patrol-groups', { query: { ...params }, signal }),
  group: (id: number) => apiFetch<PatrolGroupDetail>(`/patrol-groups/${id}`),
  listItems: (params: ListItemParams) =>
    apiFetch<Paginated<PatrolListItem>>('/patrol-list-items', { query: { ...params } }),
  scans: (params: ScanListParams, signal?: AbortSignal) =>
    apiFetch<Paginated<PatrolScan>>('/patrol-scans', { query: { ...params }, signal }),
  scan: (id: number) => apiFetch<PatrolScan>(`/patrol-scans/${id}`),
};
