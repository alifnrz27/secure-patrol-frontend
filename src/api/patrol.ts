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

// The Go backend encodes an empty list as null (e.g. an area without points),
// so lists inside these responses are normalized to arrays here.
const withItems = <T extends { items: unknown[] | null }>(data: T): T => ({ ...data, items: data.items ?? [] });
const withPhotos = (scan: PatrolScan): PatrolScan => ({ ...scan, photos: scan.photos ?? [] });

export const patrolApi = {
  pointSummary: (params: PointSummaryParams) =>
    apiFetch<PointSummary>('/patrol-point-summary', { query: { ...params } }).then(withItems),
  /** .xlsx built by the server; date_from and date_to are required, the range is limited by settings. */
  exportScansExcel: (params: ScanExportParams, signal?: AbortSignal) =>
    apiFetchBlob('/patrol-scans/export', { query: { ...params }, signal }),
  /** Head office users must pass unitId (422 "unit_id is required" otherwise). */
  currentGroup: (unitId?: number) =>
    apiFetch<PatrolGroupDetail>('/patrol-groups/current', { query: { unit_id: unitId } }).then(withItems),
  groups: (params: GroupListParams, signal?: AbortSignal) =>
    apiFetch<Paginated<PatrolGroup>>('/patrol-groups', { query: { ...params }, signal }),
  group: (id: number) => apiFetch<PatrolGroupDetail>(`/patrol-groups/${id}`).then(withItems),
  listItems: (params: ListItemParams) =>
    apiFetch<Paginated<PatrolListItem>>('/patrol-list-items', { query: { ...params } }),
  scans: (params: ScanListParams, signal?: AbortSignal) =>
    apiFetch<Paginated<PatrolScan>>('/patrol-scans', { query: { ...params }, signal }).then((page) => ({
      ...page,
      items: (page.items ?? []).map(withPhotos),
    })),
  scan: (id: number) => apiFetch<PatrolScan>(`/patrol-scans/${id}`).then(withPhotos),
};
