import { Alert, Button, Checkbox, Group, Loader, Modal, Select, Stack, Text } from '@mantine/core';
import { IconAlertTriangle, IconFileSpreadsheet, IconInfoCircle } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { patrolApi } from '@/api/patrol';
import { settingsApi } from '@/api/settings';
import { AreaSelect, DateRangeFilter, OfficerSelect, PatrolPointSelect, ShiftSelect } from '@/components/Filters';
import { useUnitScope } from '@/hooks/useUnitScope';
import { describeError } from '@/lib/api/errors';
import { downloadBlob } from '@/lib/csv';
import { dayjs, nowTz, todayDate } from '@/lib/format';
import { notifySuccess } from '@/lib/notify';

const DEFAULT_MAX_DAYS = 7;
const DEFAULT_PHOTO_MAX_DAYS = 1;

export interface ExportInitialFilters {
  shift_id: string;
  area_id: string;
  patrol_point_id: string;
  scanned_by: string;
  date_from: string;
  date_to: string;
  /** Page filters the server export does not support (condition, group). */
  unsupported: string;
}

function daysBetween(from: string, to: string): number {
  return dayjs(to).diff(dayjs(from), 'day') + 1;
}

/** Keeps `to` within `maxDays` of `from` (inclusive). */
function clampRange(from: string, to: string, maxDays: number): [string, string] {
  if (!from || !to) return [from, to];
  if (daysBetween(from, to) <= maxDays) return [from, to];
  return [from, dayjs(from).add(maxDays - 1, 'day').format('YYYY-MM-DD')];
}

interface Props {
  opened: boolean;
  onClose: () => void;
  initial: ExportInitialFilters;
}

/**
 * Server-side Excel export (GET /patrol-scans/export). The date range is
 * required and limited by the export_max_range_days / export_photo_max_range_days
 * settings; with photos the file is bigger and can take ±30 seconds.
 */
export function ExportExcelDialog({ opened, onClose, initial }: Props) {
  const { isHeadOffice, unitId, units } = useUnitScope();
  const [unit, setUnit] = useState<string>('all');
  const [shiftId, setShiftId] = useState('');
  const [pointId, setPointId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [officerId, setOfficerId] = useState('');
  const [range, setRange] = useState<[string, string]>(['', '']);
  const [withPhotos, setWithPhotos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const abort = useRef<AbortController | null>(null);

  // Start from the page filters each time the dialog opens.
  useEffect(() => {
    if (!opened) return;
    setUnit(unitId ? String(unitId) : 'all');
    setShiftId(initial.shift_id);
    setAreaId(initial.area_id);
    setPointId(initial.patrol_point_id);
    setOfficerId(initial.scanned_by);
    setRange([initial.date_from || todayDate(), initial.date_to || initial.date_from || todayDate()]);
    setWithPhotos(false);
    setError(null);
  }, [opened, initial, unitId]);

  const scopeUnit = isHeadOffice ? (unit === 'all' ? null : Number(unit)) : undefined;
  // Limits can differ per unit; head office without a unit uses the global values.
  const settings = useQuery({
    queryKey: ['settings', scopeUnit ?? 'own'],
    queryFn: () => settingsApi.list(scopeUnit ?? undefined),
    enabled: opened,
    staleTime: 60_000,
  });
  const limit = (key: string, fallback: number) => {
    const value = settings.data?.find((s) => s.key === key)?.value;
    return typeof value === 'number' && value > 0 ? value : fallback;
  };
  const maxDays = withPhotos ? limit('export_photo_max_range_days', DEFAULT_PHOTO_MAX_DAYS) : limit('export_max_range_days', DEFAULT_MAX_DAYS);

  // Keep the range valid when the limit shrinks (e.g. "Sertakan foto").
  useEffect(() => {
    setRange(([from, to]) => clampRange(from, to, maxDays));
  }, [maxDays]);

  const [from, to] = range;
  const rangeError = !from || !to ? 'Tanggal dari dan sampai wajib diisi.' : daysBetween(from, to) > maxDays ? `Maksimal ${maxDays} hari.` : null;

  const close = () => {
    abort.current?.abort();
    onClose();
  };

  const download = async () => {
    if (rangeError) return;
    setError(null);
    setRunning(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const blob = await patrolApi.exportScansExcel(
        {
          unit_id: scopeUnit ?? undefined,
          shift_id: shiftId ? Number(shiftId) : undefined,
          area_id: areaId ? Number(areaId) : undefined,
          patrol_point_id: pointId ? Number(pointId) : undefined,
          scanned_by: officerId ? Number(officerId) : undefined,
          date_from: from,
          date_to: to,
          include_photos: withPhotos || undefined,
        },
        controller.signal,
      );
      // Content-Disposition is not exposed through CORS; same name pattern as the server.
      downloadBlob(`${withPhotos ? 'riwayat-scan-foto' : 'riwayat-scan'}_${nowTz().format('YYYYMMDD-HHmmss')}.xlsx`, blob);
      notifySuccess('File Excel diunduh.');
      onClose();
    } catch (e) {
      if (!controller.signal.aborted) setError(describeError(e));
    } finally {
      abort.current = null;
      setRunning(false);
    }
  };

  // Changing the unit invalidates shift/point/officer picks of another unit.
  const changeUnit = (value: string) => {
    setUnit(value);
    setShiftId('');
    setAreaId('');
    setPointId('');
    setOfficerId('');
  };

  return (
    <Modal opened={opened} onClose={close} title="Export Excel" centered size="lg" closeOnClickOutside={!running}>
      <Stack>
        {isHeadOffice && (
          <Select
            label="Unit"
            data={[{ value: 'all', label: 'Semua unit' }, ...units.map((u) => ({ value: String(u.id), label: u.name }))]}
            value={unit}
            onChange={(v) => v && changeUnit(v)}
            allowDeselect={false}
            disabled={running}
          />
        )}
        <Group grow align="flex-start">
          <ShiftSelect label="Shift" value={shiftId} onChange={(v) => setShiftId(v ?? '')} scopeUnitId={scopeUnit} />
          <AreaSelect label="Area" value={areaId} onChange={(v) => setAreaId(v ?? '')} scopeUnitId={scopeUnit} />
        </Group>
        <Group grow align="flex-start">
          <PatrolPointSelect label="Titik" value={pointId} onChange={(v) => setPointId(v ?? '')} scopeUnitId={scopeUnit} />
        </Group>
        <Group grow align="flex-start">
          <OfficerSelect fieldLabel="Petugas" value={officerId} onChange={(v) => setOfficerId(v ?? '')} scopeUnitId={scopeUnit} />
          <div>
            <DateRangeFilter
              label="Tanggal shift"
              from={from}
              to={to}
              clearable={false}
              maxDays={maxDays}
              onChange={(f, t) => setRange(clampRange(f, t, maxDays))}
            />
            <Text size="xs" c={rangeError && from && to ? 'red' : 'dimmed'} mt={4}>
              {rangeError && from && to ? rangeError : `Wajib. Maksimal ${maxDays} hari.`}
            </Text>
          </div>
        </Group>
        <Checkbox
          label="Sertakan foto"
          description={`Menambah kolom Foto 1–3 berisi thumbnail. File lebih besar dan proses lebih lama; maksimal ${limit('export_photo_max_range_days', DEFAULT_PHOTO_MAX_DAYS)} hari dan 2.000 baris.`}
          checked={withPhotos}
          onChange={(e) => setWithPhotos(e.currentTarget.checked)}
          disabled={running}
        />
        {initial.unsupported && (
          <Alert variant="light" color="blue" icon={<IconInfoCircle size={18} />}>
            Filter {initial.unsupported} di halaman tidak ikut ke file Excel. Gunakan CSV jika filter itu diperlukan.
          </Alert>
        )}
        {error && (
          <Alert color="red" icon={<IconAlertTriangle size={18} />} role="alert">
            {error}
          </Alert>
        )}
        {running && (
          <Group gap="xs">
            <Loader size="xs" />
            <Text size="sm" c="dimmed">
              Menyiapkan file{withPhotos ? ' beserta foto' : ''}… Proses bisa memakan waktu hingga ±30 detik.
            </Text>
          </Group>
        )}
        <Text size="xs" c="dimmed">
          Kolom: Waktu scan, Diterima server, Dikirim offline, Tanggal shift, Unit, Shift, Area, Titik, Lokasi, Kondisi, Catatan, Petugas,
          Email petugas{withPhotos ? ', Foto 1–3' : ''}.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={close}>
            {running ? 'Batalkan' : 'Tutup'}
          </Button>
          <Button leftSection={<IconFileSpreadsheet size={16} />} onClick={() => void download()} loading={running} disabled={Boolean(rangeError)}>
            Unduh Excel
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
