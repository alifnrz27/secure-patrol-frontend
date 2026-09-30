import { ActionIcon, Badge, Button, Card, Grid, Group, Paper, RingProgress, SimpleGrid, Skeleton, Stack, Text, Title, Tooltip, UnstyledButton } from '@mantine/core';
import { IconAlertTriangle, IconClock, IconRefresh } from '@tabler/icons-react';
import { useIsFetching, useQueries, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { patrolApi } from '@/api/patrol';
import { ConditionBadge, GroupStatusBadge } from '@/components/Badges';
import { GroupItemsTable, ProgressCell } from '@/components/GroupItemsTable';
import { PageHeader } from '@/components/PageHeader';
import { ScanDetailDrawer } from '@/components/ScanDetailDrawer';
import { CardsSkeleton, EmptyState, ErrorState, TableSkeleton } from '@/components/StateViews';
import { usePermission } from '@/hooks/useSession';
import { useUnitScope } from '@/hooks/useUnitScope';
import { describeError, isApiError } from '@/lib/api/errors';
import type { PatrolGroupDetail, Unit } from '@/lib/api/types';
import { createLimiter } from '@/lib/limit';
import { formatDate, formatDateTime, formatRemaining, formatTime, percent } from '@/lib/format';

const PointsStatusMap = lazy(() => import('@/components/maps/PointsStatusMap').then((m) => ({ default: m.PointsStatusMap })));

const REFRESH_MS = 30_000;

function isNoActiveShift(error: unknown) {
  return isApiError(error) && error.kind === 'validation' && error.mentions('no active patrol shift');
}

function StatCard({ label, value, hint, color }: { label: string; value: ReactNode; hint?: ReactNode; color?: string }) {
  return (
    <Paper withBorder p="md" radius="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        {label}
      </Text>
      <Text fz={26} fw={700} c={color} mt={4} lh={1.2}>
        {value}
      </Text>
      {hint && (
        <Text component="div" size="sm" c="dimmed" mt={4}>
          {hint}
        </Text>
      )}
    </Paper>
  );
}

function Summary({ group }: { group: PatrolGroupDetail }) {
  const { progress } = group;
  const pct = percent(progress.scanned_points, progress.total_points);
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }}>
      <StatCard
        label="Shift berjalan"
        value={group.shift.name}
        hint={
          <>
            <Text span fw={600} c="dark" size="sm">{group.unit.name}</Text>
            <br />
            {formatDate(group.shift_date)} · {formatTime(group.start_at)}–{formatTime(group.end_at)} <GroupStatusBadge status={group.status} />
          </>
        }
      />
      <StatCard label="Sisa waktu" value={formatRemaining(group.end_at)} hint={`Berakhir ${formatDateTime(group.end_at)}`} />
      <Paper withBorder p="md" radius="md">
        <Group justify="space-between" wrap="nowrap">
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Progres
            </Text>
            <Text fz={26} fw={700} mt={4} lh={1.2}>
              {progress.scanned_points}/{progress.total_points} titik
            </Text>
            <Text size="sm" c="dimmed" mt={4}>
              {progress.unscanned_points} belum · {progress.total_scans} scan
            </Text>
          </div>
          <RingProgress
            size={78}
            thickness={8}
            roundCaps
            sections={[{ value: pct, color: pct === 100 ? 'teal' : 'blue' }]}
            label={<Text ta="center" fw={700} size="sm">{pct}%</Text>}
            aria-label={`Progres ${pct} persen`}
          />
        </Group>
      </Paper>
      <StatCard
        label="Temuan tidak normal"
        value={progress.abnormal_scans}
        color={progress.abnormal_scans > 0 ? 'red' : undefined}
        hint={progress.abnormal_scans > 0 ? 'Periksa catatan petugas' : 'Tidak ada temuan'}
      />
    </SimpleGrid>
  );
}

function RecentScans({ onOpen }: { onOpen: (id: number) => void }) {
  const { unitId, showUnitColumn } = useUnitScope();
  const query = useQuery({
    queryKey: ['patrol-scans', 'list', { limit: 10, unit_id: unitId }],
    queryFn: () => patrolApi.scans({ limit: 10, unit_id: unitId }),
    refetchInterval: REFRESH_MS,
  });
  return (
    <Card withBorder radius="md" h="100%">
      <Group justify="space-between" mb="sm">
        <Title order={4}>Scan terbaru</Title>
        <Button component={Link} to="/scans" variant="subtle" size="xs">
          Lihat semua
        </Button>
      </Group>
      {query.isPending ? (
        <Stack gap="xs">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} h={42} />)}</Stack>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} compact />
      ) : query.data.items.length === 0 ? (
        <EmptyState title="Belum ada scan" />
      ) : (
        <Stack gap={4}>
          {query.data.items.map((scan) => (
            <UnstyledButton
              key={scan.id}
              onClick={() => onOpen(scan.id)}
              p="xs"
              style={{ borderRadius: 6 }}
              className="recent-scan"
              aria-label={`Detail scan ${scan.patrol_point.name}`}
            >
              <Group justify="space-between" wrap="nowrap">
                <div style={{ minWidth: 0 }}>
                  <Text size="sm" fw={600} truncate>{scan.patrol_point.name}</Text>
                  <Text size="xs" c="dimmed" truncate>
                    {formatDateTime(scan.scanned_at)} · {scan.scanned_by.name}
                    {showUnitColumn && ` · ${scan.group.unit_name}`}
                  </Text>
                </div>
                <ConditionBadge condition={scan.condition} />
              </Group>
            </UnstyledButton>
          ))}
        </Stack>
      )}
    </Card>
  );
}

function UnitDetail({ unitId }: { unitId: number | undefined }) {
  const canManageShifts = usePermission('manageShifts');
  const current = useQuery({
    queryKey: ['patrol-groups', 'current', unitId ?? 'own'],
    queryFn: () => patrolApi.currentGroup(unitId),
    // TanStack Query pauses the interval while the tab is hidden.
    refetchInterval: REFRESH_MS,
    retry: (count, error) => !isNoActiveShift(error) && count < 2 && isApiError(error) && (error.kind === 'network' || error.kind === 'server'),
  });

  if (current.isPending) {
    return (
      <>
        <CardsSkeleton />
        <Skeleton h={380} />
        <TableSkeleton />
      </>
    );
  }
  if (current.isError) {
    return isNoActiveShift(current.error) ? (
      <Paper withBorder p="xl" radius="md">
        <EmptyState
          title="Tidak ada shift aktif saat ini"
          description="Periksa pengaturan shift jika seharusnya ada patroli yang berjalan."
          action={canManageShifts ? <Button component={Link} to="/shifts" variant="light" size="xs">Pengaturan Shift</Button> : undefined}
        />
      </Paper>
    ) : (
      <ErrorState error={current.error} onRetry={() => void current.refetch()} />
    );
  }
  const group = current.data;
  return (
    <>
      <Summary group={group} />
      {group.progress.abnormal_scans > 0 && (
        <Badge color="red" size="lg" variant="light" leftSection={<IconAlertTriangle size={14} />}>
          {group.progress.abnormal_scans} temuan tidak normal di shift ini
        </Badge>
      )}
      <Card withBorder radius="md">
        <Group justify="space-between" mb="sm">
          <Title order={4}>Peta titik</Title>
          <Group gap="md">
            <Legend color="#868e96" label="Belum di-scan" />
            <Legend color="#2f9e44" label="Normal" />
            <Legend color="#e03131" label="Tidak Normal" />
          </Group>
        </Group>
        <Suspense fallback={<Skeleton h={380} />}>
          <PointsStatusMap items={group.items} />
        </Suspense>
      </Card>
      <Card withBorder radius="md">
        <Group justify="space-between" mb="sm">
          <Title order={4}>Status titik</Title>
          <Button component={Link} to={`/monitoring/${group.id}`} variant="subtle" size="xs">
            Detail group
          </Button>
        </Group>
        <GroupItemsTable items={group.items} />
      </Card>
    </>
  );
}

// Head office overview: at most 5 unit requests in flight at once.
const unitLimiter = createLimiter(5);

function UnitCard({ unit, query, onSelect }: { unit: Unit; query: UseQueryResult<PatrolGroupDetail>; onSelect: () => void }) {
  const group = query.data;
  return (
    <UnstyledButton onClick={onSelect} aria-label={`Buka dashboard ${unit.name}`} style={{ display: 'block', height: '100%' }}>
      <Paper withBorder radius="md" p="md" h="100%" className="unit-card" style={group && group.progress.abnormal_scans > 0 ? { borderColor: 'var(--mantine-color-red-4)' } : undefined}>
        <Group justify="space-between" wrap="nowrap" mb="xs">
          <div style={{ minWidth: 0 }}>
            <Text fw={700} truncate>{unit.name}</Text>
            <Text size="xs" c="dimmed" ff="monospace">{unit.code}</Text>
          </div>
          {group && <GroupStatusBadge status={group.status} />}
        </Group>
        {query.isPending ? (
          <Stack gap={6}>
            <Skeleton h={14} w="60%" />
            <Skeleton h={10} />
          </Stack>
        ) : query.isError ? (
          <Text size="sm" c={isNoActiveShift(query.error) ? 'dimmed' : 'red'}>
            {isNoActiveShift(query.error) ? 'Tidak ada shift aktif' : describeError(query.error)}
          </Text>
        ) : group ? (
          <Stack gap={8}>
            <Text size="sm">
              {group.shift.name} · {formatTime(group.start_at)}–{formatTime(group.end_at)}
            </Text>
            <ProgressCell progress={group.progress} />
            <Group gap={6}>
              {group.progress.abnormal_scans > 0 ? (
                <Badge color="red" leftSection={<IconAlertTriangle size={12} />}>{group.progress.abnormal_scans} tidak normal</Badge>
              ) : (
                <Text size="xs" c="dimmed">Tidak ada temuan</Text>
              )}
              <Text size="xs" c="dimmed">· {group.progress.total_scans} scan</Text>
            </Group>
          </Stack>
        ) : null}
      </Paper>
    </UnstyledButton>
  );
}

function UnitOverview() {
  const { units, setUnitId } = useUnitScope();
  const canViewUnits = usePermission('viewUnits');
  const active = units.filter((u) => u.is_active);
  const queries = useQueries({
    queries: active.map((unit) => ({
      queryKey: ['patrol-groups', 'current', unit.id],
      queryFn: () => unitLimiter(() => patrolApi.currentGroup(unit.id)),
      refetchInterval: REFRESH_MS,
      retry: (count: number, error: Error) => !isNoActiveShift(error) && count < 2 && isApiError(error) && (error.kind === 'network' || error.kind === 'server'),
    })),
  });

  if (active.length === 0) {
    return (
      <Paper withBorder p="xl" radius="md">
        <EmptyState title="Belum ada unit aktif" action={canViewUnits ? <Button component={Link} to="/units" variant="light" size="xs">Kelola Unit</Button> : undefined} />
      </Paper>
    );
  }
  const abnormal = queries.reduce((sum, q) => sum + (q.data?.progress.abnormal_scans ?? 0), 0);
  return (
    <>
      <Text size="sm" c="dimmed">
        Ringkasan shift berjalan di {active.length} unit aktif{abnormal > 0 ? `, ${abnormal} temuan tidak normal` : ''}. Klik kartu untuk melihat detail unit.
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }}>
        {active.map((unit, i) => (
          <UnitCard key={unit.id} unit={unit} query={queries[i]!} onSelect={() => setUnitId(unit.id)} />
        ))}
      </SimpleGrid>
    </>
  );
}

function LastUpdated() {
  // Re-renders when a dashboard request starts or ends.
  useIsFetching({ queryKey: ['patrol-groups', 'current'] });
  const queryClient = useQueryClient();
  const updated = Math.max(0, ...queryClient.getQueryCache().findAll({ queryKey: ['patrol-groups', 'current'] }).map((q) => q.state.dataUpdatedAt));
  if (!updated) return null;
  return (
    <Text size="xs" c="dimmed">
      <IconClock size={12} style={{ verticalAlign: -1 }} /> {formatTime(new Date(updated).toISOString())}
    </Text>
  );
}

export default function DashboardPage() {
  const [scanId, setScanId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { isHeadOffice, unitId, unitName } = useUnitScope();
  const overview = isHeadOffice && !unitId;
  const fetching = useIsFetching({ queryKey: ['patrol-groups', 'current'] }) > 0;

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['patrol-groups', 'current'] });
    void queryClient.invalidateQueries({ queryKey: ['patrol-scans', 'list'] });
  };

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          overview
            ? 'Semua unit. Diperbarui otomatis setiap 30 detik.'
            : `${isHeadOffice && unitId ? `${unitName(unitId)} · ` : ''}Pantauan shift yang sedang berjalan. Diperbarui otomatis setiap 30 detik.`
        }
        actions={
          <Group gap="xs">
            <LastUpdated />
            <Tooltip label="Muat ulang">
              <ActionIcon variant="light" size="lg" onClick={refreshAll} loading={fetching} aria-label="Muat ulang dashboard">
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        }
      />

      <Grid>
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack>{overview ? <UnitOverview /> : <UnitDetail unitId={unitId} />}</Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <RecentScans onOpen={setScanId} />
        </Grid.Col>
      </Grid>

      <ScanDetailDrawer scanId={scanId} onClose={() => setScanId(null)} />
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Group gap={4}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} aria-hidden />
      <Text size="xs">{label}</Text>
    </Group>
  );
}
