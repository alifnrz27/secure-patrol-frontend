import { ActionIcon, AppShell, Card, Container, Group, Loader, SegmentedControl, Stack, Text, Title, Tooltip } from '@mantine/core';
import { IconArrowLeft, IconMaximize, IconMinimize, IconRefresh } from '@tabler/icons-react';
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { patrolApi } from '@/api/patrol';
import { LicenseBannerBar } from '@/app/LicenseScreens';
import { GroupStatusBadge } from '@/components/Badges';
import { BrandLogo } from '@/components/BrandLogo';
import { AreaSelect, DateRangeFilter, ShiftSelect } from '@/components/Filters';
import { PointSummaryView } from '@/components/PointSummaryView';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/StateViews';
import { UnitPicker } from '@/components/UnitPicker';
import { useBranding, useDocumentTitle } from '@/hooks/useBranding';
import { useUnitScope } from '@/hooks/useUnitScope';
import { toNumber, useUrlFilters } from '@/hooks/useUrlFilters';
import { isApiError } from '@/lib/api/errors';
import { dayjs, formatDate, formatRemaining, formatTime, todayDate } from '@/lib/format';

/** How often the page refreshes itself (paused while the tab is hidden). */
const REFRESH_MS = 30_000;
const MAX_DAYS = 31;
const KEYS = ['shift_id', 'area_id', 'date_from', 'date_to'] as const;

function isNoActiveShift(error: unknown) {
  return isApiError(error) && error.kind === 'validation' && error.mentions('no active patrol shift');
}

/** Ticks every second so "diperbarui … detik lalu" and the remaining time stay current. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function UpdatedAt() {
  const now = useNow();
  const queryClient = useQueryClient();
  const fetching = useIsFetching({ queryKey: ['recap'] }) > 0;
  const updated = Math.max(0, ...queryClient.getQueryCache().findAll({ queryKey: ['recap'] }).map((q) => q.state.dataUpdatedAt));
  if (fetching) {
    return (
      <Group gap={6}>
        <Loader size={12} />
        <Text size="xs" c="dimmed">Memperbarui…</Text>
      </Group>
    );
  }
  if (!updated) return null;
  const next = Math.min(REFRESH_MS / 1000, Math.max(0, Math.ceil((updated + REFRESH_MS - now) / 1000)));
  return (
    <Text size="xs" c="dimmed">
      Diperbarui {formatTime(new Date(updated).toISOString())} · berikutnya {next} dtk
    </Text>
  );
}

function FullscreenButton() {
  const [full, setFull] = useState(() => Boolean(document.fullscreenElement));
  useEffect(() => {
    const onChange = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  if (!document.fullscreenEnabled) return null;
  const toggle = () => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined);
  return (
    <Tooltip label={full ? 'Keluar layar penuh' : 'Layar penuh'}>
      <ActionIcon variant="light" size="lg" onClick={toggle} aria-label={full ? 'Keluar layar penuh' : 'Layar penuh'}>
        {full ? <IconMinimize size={18} /> : <IconMaximize size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}

/** Default mode: the shift running now (the current group), refreshed every 30 seconds. */
function ActiveShiftRecap({ unitId, areaId }: { unitId: number | undefined; areaId: number | undefined }) {
  useNow(); // keeps the remaining time current
  const current = useQuery({
    queryKey: ['recap', 'current', unitId ?? 'own'],
    queryFn: () => patrolApi.currentGroup(unitId),
    refetchInterval: REFRESH_MS,
    retry: (count, error) => !isNoActiveShift(error) && count < 2 && isApiError(error) && (error.kind === 'network' || error.kind === 'server'),
  });
  const groupId = current.data?.id;
  const summary = useQuery({
    queryKey: ['recap', 'summary', { group_id: groupId, area_id: areaId }],
    queryFn: () => patrolApi.pointSummary({ group_id: groupId!, area_id: areaId }),
    enabled: Boolean(groupId),
    refetchInterval: REFRESH_MS,
  });

  if (current.isPending) return <TableSkeleton cols={6} />;
  if (current.isError) {
    return isNoActiveShift(current.error) ? (
      <Card withBorder radius="md">
        <EmptyState title="Tidak ada shift aktif saat ini" description='Halaman akan menampilkan shift berikutnya begitu dimulai. Gunakan "Pilih shift" untuk melihat shift lain.' />
      </Card>
    ) : (
      <ErrorState error={current.error} onRetry={() => void current.refetch()} />
    );
  }
  const group = current.data;
  return (
    <Stack>
      <Card withBorder radius="md" p="md">
        <Group justify="space-between" wrap="wrap">
          <div>
            <Group gap="xs">
              <Title order={3}>{group.shift.name}</Title>
              <GroupStatusBadge status={group.status} />
            </Group>
            <Text size="sm" c="dimmed">
              {group.unit.name} · {formatDate(group.shift_date)} · {formatTime(group.start_at)}–{formatTime(group.end_at)}
            </Text>
          </div>
          {group.status === 'ongoing' && (
            <div style={{ textAlign: 'right' }}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Sisa waktu</Text>
              <Text fz={22} fw={700}>{formatRemaining(group.end_at)}</Text>
            </div>
          )}
        </Group>
      </Card>
      {summary.isPending ? (
        <TableSkeleton cols={6} />
      ) : summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      ) : (
        <PointSummaryView summary={summary.data} fileName={`rekap-titik-${group.shift.name}-${group.shift_date}.csv`.replace(/\s+/g, '-')} />
      )}
    </Stack>
  );
}

/** Chosen mode: one shift (its unit) over a date range, refreshed every 30 seconds. */
function ChosenShiftRecap({ shiftId, areaId, dateFrom, dateTo }: { shiftId: number | undefined; areaId: number | undefined; dateFrom: string; dateTo: string }) {
  const summary = useQuery({
    queryKey: ['recap', 'summary', { shift_id: shiftId, area_id: areaId, date_from: dateFrom, date_to: dateTo }],
    queryFn: () => patrolApi.pointSummary({ shift_id: shiftId!, area_id: areaId, date_from: dateFrom, date_to: dateTo }),
    enabled: Boolean(shiftId),
    refetchInterval: REFRESH_MS,
  });
  if (!shiftId) {
    return (
      <Card withBorder radius="md">
        <EmptyState title="Pilih shift" description="Rekap dihitung untuk satu shift (dan unitnya) pada rentang tanggal yang dipilih." />
      </Card>
    );
  }
  if (summary.isPending) return <TableSkeleton cols={6} />;
  if (summary.isError) return <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />;
  return (
    <PointSummaryView summary={summary.data} fileName={`rekap-titik-${summary.data.shift.name}-${dateFrom}_${dateTo}.csv`.replace(/\s+/g, '-')} />
  );
}

/**
 * Point recap as its own full-width page without the sidebar (for a wall
 * monitor). Opens on the shift running now and refreshes itself.
 */
export default function RecapPage() {
  useDocumentTitle('Rekap per Titik');
  const { appName } = useBranding();
  const queryClient = useQueryClient();
  const { isHeadOffice, unitId, unitName } = useUnitScope();
  const { filters, setFilters } = useUrlFilters(KEYS);
  // A shift in the URL means the chosen mode; otherwise the active shift.
  const [mode, setMode] = useState<'active' | 'chosen'>(filters.shift_id ? 'chosen' : 'active');
  const dateFrom = filters.date_from || todayDate();
  const dateTo = filters.date_to || dateFrom;
  const rangeTooLong = dayjs(dateTo).diff(dayjs(dateFrom), 'day') + 1 > MAX_DAYS;
  const needsUnit = mode === 'active' && isHeadOffice && !unitId;

  const changeMode = (value: string) => {
    setMode(value as 'active' | 'chosen');
    if (value === 'active') setFilters({ shift_id: null, date_from: null, date_to: null });
  };

  return (
    <AppShell header={{ height: 64 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap" gap="sm">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <Tooltip label="Kembali ke Dashboard">
              <ActionIcon component={Link} to="/" variant="subtle" size="lg" aria-label="Kembali ke Dashboard">
                <IconArrowLeft size={18} />
              </ActionIcon>
            </Tooltip>
            <BrandLogo size={28} />
            <div style={{ minWidth: 0 }}>
              <Text fw={700} truncate>Rekap Patroli per Titik</Text>
              <Text size="xs" c="dimmed" truncate>{appName}{isHeadOffice && unitId ? ` · ${unitName(unitId)}` : ''}</Text>
            </div>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <UpdatedAt />
            <Tooltip label="Muat ulang sekarang">
              <ActionIcon variant="light" size="lg" aria-label="Muat ulang" onClick={() => void queryClient.invalidateQueries({ queryKey: ['recap'] })}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <FullscreenButton />
            <UnitPicker />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="xl" px={0}>
          <LicenseBannerBar />
          <Group mb="md" gap="sm" wrap="wrap">
            <SegmentedControl
              aria-label="Shift yang ditampilkan"
              value={mode}
              onChange={changeMode}
              data={[
                { value: 'active', label: 'Shift aktif' },
                { value: 'chosen', label: 'Pilih shift' },
              ]}
            />
            {mode === 'chosen' && (
              <>
                <ShiftSelect value={filters.shift_id} onChange={(shift_id) => setFilters({ shift_id })} />
                <DateRangeFilter
                  from={dateFrom}
                  to={dateTo}
                  clearable={false}
                  maxDays={MAX_DAYS}
                  onChange={(date_from, date_to) => setFilters({ date_from, date_to })}
                />
              </>
            )}
            <AreaSelect value={filters.area_id} onChange={(area_id) => setFilters({ area_id })} />
          </Group>

          {needsUnit ? (
            <Card withBorder radius="md">
              <EmptyState title="Pilih unit" description="Shift aktif ditampilkan per unit. Pilih unit di kanan atas." />
            </Card>
          ) : mode === 'active' ? (
            <ActiveShiftRecap unitId={unitId} areaId={toNumber(filters.area_id)} />
          ) : rangeTooLong ? (
            <Card withBorder radius="md">
              <EmptyState title={`Rentang maksimal ${MAX_DAYS} hari`} />
            </Card>
          ) : (
            <ChosenShiftRecap shiftId={toNumber(filters.shift_id)} areaId={toNumber(filters.area_id)} dateFrom={dateFrom} dateTo={dateTo} />
          )}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
