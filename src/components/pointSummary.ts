import type { PointSummary, PointSummaryItem } from '@/lib/api/types';
import { toCsv } from '@/lib/csv';
import { formatDateTime } from '@/lib/format';

/** The chart scale ends at 10 scans: 10 or more is always a full bar, less is proportional. */
export const BAR_SCALE_MAX = 10;

export function barValue(totalScans: number, max = BAR_SCALE_MAX): number {
  return Math.max(0, Math.min(totalScans, max));
}

/** Never scanned, or missed in some of the shifts in the range. */
export function pointStatus(item: PointSummaryItem): 'unscanned' | 'partial' | 'ok' {
  if (item.total_scans === 0) return 'unscanned';
  if (item.scanned_groups < item.groups) return 'partial';
  return 'ok';
}

export function pointSummaryCsv(summary: PointSummary): string {
  return toCsv(
    ['Unit', 'Shift', 'Tanggal dari', 'Tanggal sampai', 'Titik', 'Lokasi', 'Kode NFC', 'Total scan', 'Normal', 'Tidak normal', 'Petugas', 'Shift ter-scan', 'Jumlah shift', 'Scan pertama', 'Scan terakhir'],
    summary.items.map((i) => [
      summary.unit.name,
      summary.shift.name,
      summary.date_from,
      summary.date_to,
      i.name,
      i.location,
      i.nfc_code,
      i.total_scans,
      i.normal_scans,
      i.abnormal_scans,
      i.officers,
      i.scanned_groups,
      i.groups,
      i.first_scanned_at ? formatDateTime(i.first_scanned_at) : '',
      i.last_scanned_at ? formatDateTime(i.last_scanned_at) : '',
    ]),
  );
}
