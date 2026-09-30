import { Badge, Button, Card, CloseButton, Group, Menu, SegmentedControl, Text } from '@mantine/core';
import { IconChevronDown, IconDownload, IconFileSpreadsheet, IconFileText } from '@tabler/icons-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { patrolApi, type ScanListParams } from '@/api/patrol';
import { DateRangeFilter, OfficerSelect, PatrolPointSelect, ShiftSelect } from '@/components/Filters';
import { useExport } from '@/components/ExportProgress';
import { PageHeader } from '@/components/PageHeader';
import { PaginationBar } from '@/components/PaginationBar';
import { ScanDetailDrawer } from '@/components/ScanDetailDrawer';
import { ScansTable } from '@/components/ScansTable';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/StateViews';
import { usePermission } from '@/hooks/useSession';
import { toNumber, toPage, useUrlFilters } from '@/hooks/useUrlFilters';
import type { PatrolScan, ScanCondition } from '@/lib/api/types';
import { downloadBlob, downloadCsv, toCsv } from '@/lib/csv';
import { formatDate, formatDateTime, isSentOffline, nowTz, todayDate } from '@/lib/format';
import { notifyError, notifySuccess } from '@/lib/notify';
import { fetchAllPages, MAX_PAGE_SIZE } from '@/lib/pagination';

const KEYS = ['group_id', 'shift_id', 'date_from', 'date_to', 'scanned_by', 'patrol_point_id', 'condition', 'page', 'limit'] as const;

function scansToCsv(scans: PatrolScan[]): string {
  return toCsv(
    ['ID', 'Waktu scan', 'Diterima server', 'Dikirim offline', 'Tanggal shift', 'Shift', 'Titik', 'Lokasi', 'Kode NFC', 'Kondisi', 'Catatan', 'Petugas', 'Email petugas', 'Latitude', 'Longitude', 'Jarak (m)', 'Lokasi valid', 'Wajah terverifikasi', 'Skor wajah', 'Jumlah foto'],
    scans.map((s) => [
      s.id,
      formatDateTime(s.scanned_at),
      formatDateTime(s.received_at),
      isSentOffline(s.scanned_at, s.received_at) ? 'Ya' : 'Tidak',
      formatDate(s.group.shift_date),
      s.group.shift_name,
      s.patrol_point.name,
      s.patrol_point.location,
      s.patrol_point.nfc_code,
      s.condition === 'abnormal' ? 'Tidak Normal' : 'Normal',
      s.note,
      s.scanned_by.name,
      s.scanned_by.email,
      s.latitude,
      s.longitude,
      Math.round(s.distance_meters * 10) / 10,
      s.is_location_valid ? 'Ya' : 'Tidak',
      s.is_face_verified ? 'Ya' : 'Tidak',
      s.face_match_score ?? '',
      s.photos.length,
    ]),
  );
}

export default function ScansPage() {
  const canFilterOfficer = usePermission('filterScansByOfficer');
  const { filters, setFilters, resetFilters } = useUrlFilters(KEYS, { limit: '20' });
  const [scanId, setScanId] = useState<number | null>(null);
  const exporter = useExport();

  const filterParams: ScanListParams = {
    group_id: toNumber(filters.group_id),
    shift_id: toNumber(filters.shift_id),
    date_from: filters.date_from,
    date_to: filters.date_to,
    scanned_by: canFilterOfficer ? toNumber(filters.scanned_by) : undefined,
    patrol_point_id: toNumber(filters.patrol_point_id),
    condition: (filters.condition || undefined) as ScanCondition | undefined,
  };
  const params = { ...filterParams, page: toPage(filters.page), limit: Number(filters.limit) || 20 };
  const query = useQuery({ queryKey: ['patrol-scans', 'list', params], queryFn: () => patrolApi.scans(params), placeholderData: keepPreviousData });
  const hasFilter = KEYS.some((k) => k !== 'page' && k !== 'limit' && filters[k]);

  // The server export ignores condition and group, so it is offered only when
  // the file would match what the table shows.
  const excelUnsupported = [filters.condition && 'kondisi', filters.group_id && 'group'].filter(Boolean).join(' dan ');
  const [excelRunning, setExcelRunning] = useState(false);
  const exportExcel = async () => {
    setExcelRunning(true);
    try {
      const { shift_id, patrol_point_id, scanned_by, date_from, date_to } = filterParams;
      const blob = await patrolApi.exportScansExcel({ shift_id, patrol_point_id, scanned_by, date_from, date_to });
      // Content-Disposition is not exposed through CORS, so the name is built here (same pattern as the server).
      downloadBlob(`riwayat-scan_${nowTz().format('YYYYMMDD-HHmmss')}.xlsx`, blob);
      notifySuccess('File Excel diunduh.');
    } catch (error) {
      notifyError(error);
    } finally {
      setExcelRunning(false);
    }
  };

  const exportCsv = () =>
    exporter.run(async (signal, onProgress) => {
      const scans = await fetchAllPages((page, s) => patrolApi.scans({ ...filterParams, page, limit: MAX_PAGE_SIZE }, s), { signal, onProgress });
      downloadCsv(`riwayat-scan-${todayDate()}.csv`, scansToCsv(scans));
      return scans.length;
    });

  return (
    <>
      <PageHeader
        title="Riwayat Scan"
        description="Seluruh history scan NFC, terbaru dulu."
        actions={
          <Menu position="bottom-end" width={300} withinPortal>
            <Menu.Target>
              <Button
                leftSection={<IconDownload size={16} />}
                rightSection={<IconChevronDown size={14} />}
                variant="light"
                loading={exporter.running || excelRunning}
                disabled={!query.data?.pagination.total}
              >
                Ekspor
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Sesuai filter yang aktif</Menu.Label>
              <Menu.Item leftSection={<IconFileSpreadsheet size={16} />} disabled={Boolean(excelUnsupported)} onClick={() => void exportExcel()}>
                <Text size="sm">Excel (.xlsx)</Text>
                <Text size="xs" c="dimmed">
                  {excelUnsupported ? `Filter ${excelUnsupported} tidak didukung; gunakan CSV.` : 'Dibuat server, maksimal 50.000 baris.'}
                </Text>
              </Menu.Item>
              <Menu.Item leftSection={<IconFileText size={16} />} onClick={() => void exportCsv()}>
                <Text size="sm">CSV</Text>
                <Text size="xs" c="dimmed">Semua filter didukung, termasuk jarak dan validasi.</Text>
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        }
      />
      <Card withBorder radius="md">
        <Group mb="md" gap="sm">
          {filters.group_id && (
            <Badge size="lg" variant="light" rightSection={<CloseButton size="xs" aria-label="Hapus filter group" onClick={() => setFilters({ group_id: null })} />}>
              Group #{filters.group_id}
            </Badge>
          )}
          <ShiftSelect value={filters.shift_id} onChange={(shift_id) => setFilters({ shift_id })} />
          <DateRangeFilter from={filters.date_from} to={filters.date_to} onChange={(date_from, date_to) => setFilters({ date_from, date_to })} />
          <PatrolPointSelect value={filters.patrol_point_id} onChange={(patrol_point_id) => setFilters({ patrol_point_id })} />
          {canFilterOfficer && <OfficerSelect value={filters.scanned_by} onChange={(scanned_by) => setFilters({ scanned_by })} />}
          <SegmentedControl
            aria-label="Filter kondisi"
            value={filters.condition}
            onChange={(condition) => setFilters({ condition })}
            data={[
              { value: '', label: 'Semua' },
              { value: 'normal', label: 'Normal' },
              { value: 'abnormal', label: 'Tidak Normal' },
            ]}
          />
          {hasFilter && (
            <Button variant="subtle" size="xs" onClick={resetFilters}>
              Reset filter
            </Button>
          )}
        </Group>
        {query.isPending ? (
          <TableSkeleton cols={9} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <EmptyState title="Tidak ada scan" description={hasFilter ? 'Coba ubah filter.' : 'Scan dibuat dari aplikasi mobile.'} />
        ) : (
          <ScansTable scans={query.data.items} onOpen={setScanId} />
        )}
        <PaginationBar pagination={query.data?.pagination} onPageChange={(page) => setFilters({ page })} onLimitChange={(limit) => setFilters({ limit })} />
      </Card>
      <ScanDetailDrawer scanId={scanId} onClose={() => setScanId(null)} />
      {exporter.modal}
    </>
  );
}
