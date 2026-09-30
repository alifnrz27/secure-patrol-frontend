import { ActionIcon, Badge, Button, Card, Grid, Group, Paper, RingProgress, SimpleGrid, Skeleton, Stack, Text, Title, Tooltip, UnstyledButton } from '@mantine/core';
import { IconAlertTriangle, IconClock, IconRefresh } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { patrolApi } from '@/api/patrol';
import { ConditionBadge, GroupStatusBadge } from '@/components/Badges';
import { GroupItemsTable } from '@/components/GroupItemsTable';
import { PageHeader } from '@/components/PageHeader';
import { ScanDetailDrawer } from '@/components/ScanDetailDrawer';
import { CardsSkeleton, EmptyState, ErrorState, TableSkeleton } from '@/components/StateViews';
import { usePermission } from '@/hooks/useSession';
import { isApiError } from '@/lib/api/errors';
import type { PatrolGroupDetail } from '@/lib/api/types';
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
  const query = useQuery({
    queryKey: ['patrol-scans', 'list', { limit: 10 }],
    queryFn: () => patrolApi.scans({ limit: 10 }),
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

export default function DashboardPage() {
  const [scanId, setScanId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const canManageShifts = usePermission('manageShifts');
  const current = useQuery({
    queryKey: ['patrol-groups', 'current'],
    queryFn: patrolApi.currentGroup,
    // TanStack Query pauses the interval while the tab is hidden.
    refetchInterval: REFRESH_MS,
    retry: (count, error) => !isNoActiveShift(error) && count < 2 && isApiError(error) && (error.kind === 'network' || error.kind === 'server'),
  });

  const refreshAll = () => {
    void current.refetch();
    void queryClient.invalidateQueries({ queryKey: ['patrol-scans', 'list', { limit: 10 }] });
  };

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Pantauan shift yang sedang berjalan. Diperbarui otomatis setiap 30 detik."
        actions={
          <Group gap="xs">
            {current.dataUpdatedAt > 0 && (
              <Text size="xs" c="dimmed">
                <IconClock size={12} style={{ verticalAlign: -1 }} /> {formatTime(new Date(current.dataUpdatedAt).toISOString())}
              </Text>
            )}
            <Tooltip label="Muat ulang">
              <ActionIcon variant="light" size="lg" onClick={refreshAll} loading={current.isFetching} aria-label="Muat ulang dashboard">
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        }
      />

      <Grid>
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack>
            {current.isPending ? (
              <>
                <CardsSkeleton />
                <Skeleton h={380} />
                <TableSkeleton />
              </>
            ) : current.isError ? (
              isNoActiveShift(current.error) ? (
                <Paper withBorder p="xl" radius="md">
                  <EmptyState
                    title="Tidak ada shift aktif saat ini"
                    description="Periksa pengaturan shift jika seharusnya ada patroli yang berjalan."
                    action={canManageShifts ? <Button component={Link} to="/shifts" variant="light" size="xs">Pengaturan Shift</Button> : undefined}
                  />
                </Paper>
              ) : (
                <ErrorState error={current.error} onRetry={refreshAll} />
              )
            ) : (
              <>
                <Summary group={current.data} />
                {current.data.progress.abnormal_scans > 0 && (
                  <Badge color="red" size="lg" variant="light" leftSection={<IconAlertTriangle size={14} />}>
                    {current.data.progress.abnormal_scans} temuan tidak normal di shift ini
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
                    <PointsStatusMap items={current.data.items} />
                  </Suspense>
                </Card>
                <Card withBorder radius="md">
                  <Group justify="space-between" mb="sm">
                    <Title order={4}>Status titik</Title>
                    <Button component={Link} to={`/monitoring/${current.data.id}`} variant="subtle" size="xs">
                      Detail group
                    </Button>
                  </Group>
                  <GroupItemsTable items={current.data.items} />
                </Card>
              </>
            )}
          </Stack>
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
