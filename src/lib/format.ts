import dayjs from 'dayjs';
import 'dayjs/locale/id';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import relativeTime from 'dayjs/plugin/relativeTime';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { serverNow } from '@/lib/api/clock';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(relativeTime);
dayjs.locale('id');

let displayTimezone = 'Asia/Jakarta';

export function setDisplayTimezone(tz: string | null | undefined): void {
  if (tz) displayTimezone = tz;
}

export function getDisplayTimezone(): string {
  return displayTimezone;
}

/** Current time on the server clock, in the display timezone. */
export function nowTz() {
  return dayjs(serverNow()).tz(displayTimezone);
}

export function toTz(value: string | number | Date) {
  return dayjs(value).tz(displayTimezone);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  return toTz(value).format('DD MMM YYYY HH:mm');
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '-';
  return toTz(value).format('HH:mm');
}

/** Formats a calendar date (YYYY-MM-DD, e.g. shift_date) without timezone shifts. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return dayjs(value, 'YYYY-MM-DD').format('DD MMM YYYY');
}

export function todayDate(): string {
  return nowTz().format('YYYY-MM-DD');
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h && m) return `${h} jam ${m} menit`;
  if (h) return `${h} jam`;
  return `${m} menit`;
}

export function formatRemaining(untilIso: string): string {
  const diffMin = Math.max(0, Math.round((Date.parse(untilIso) - serverNow()) / 60000));
  return formatDuration(diffMin);
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || Number.isNaN(meters)) return '-';
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${meters.toFixed(1)} m`;
}

export function formatPercent(part: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

export function percent(part: number, total: number): number {
  return total ? Math.round((part / total) * 100) : 0;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** Received more than 5 minutes after the scan: it was queued offline on the phone. */
export function isSentOffline(scannedAt: string, receivedAt: string): boolean {
  return Date.parse(receivedAt) - Date.parse(scannedAt) > 5 * 60 * 1000;
}

export { dayjs };
