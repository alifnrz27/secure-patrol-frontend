import { apiFetch, apiFetchBlob } from '@/lib/api/client';
import type {
  Paginated,
  PatrolGroup,
  PatrolGroupDetail,
  PatrolListItem,
  PatrolScan,
  PointSummary,
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
  area_id?: number;
  search?: string;
  group_id?: number;
  status?: 'scanned' | 'unscanned';
}

export interface ScanListParams extends GroupListParams {
  area_id?: number;
  group_id?: number;
  scanned_by?: number;
  patrol_point_id?: number;
  condition?: ScanCondition;
}

/** Filters the server-side Excel export understands (no condition or group). */
export type ScanExportParams = Pick<ScanListParams, 'unit_id' | 'area_id' | 'shift_id' | 'patrol_point_id' | 'scanned_by' | 'date_from' | 'date_to'> & {
  /** Thumbnails in Foto 1–3 (shorter range and row limit). */
  include_photos?: boolean;
};

/** One group, or one shift over a date range (the unit follows the shift). */
export type PointSummaryParams = ({ group_id: number } | { shift_id: number; date_from?: string; date_to?: string }) & { area_id?: number };

export const patrolApi = {
  pointSummary: (params: PointSummaryParams) => apiFetch<PointSummary>('/patrol-point-summary', { query: { ...params } }),
  /** .xlsx built by the server; date_from and date_to are required, the range is limited by settings. */
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
