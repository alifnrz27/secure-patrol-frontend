import { Anchor, Breadcrumbs, Button, Card, Group, Skeleton, SimpleGrid, Stack, Tabs, Text } from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { patrolApi } from '@/api/patrol';
import { GroupStatusBadge } from '@/components/Badges';
import { GroupItemsTable, ProgressCell } from '@/components/GroupItemsTable';
import { PageHeader } from '@/components/PageHeader';
import { PaginationBar } from '@/components/PaginationBar';
import { PointSummaryView } from '@/components/PointSummaryView';
import { ScanDetailDrawer } from '@/components/ScanDetailDrawer';
import { ScansTable } from '@/components/ScansTable';
import { CardsSkeleton, EmptyState, ErrorState, TableSkeleton } from '@/components/StateViews';
import { formatDate, formatDateTime } from '@/lib/format';

const PointsStatusMap = lazy(() => import('@/components/maps/PointsStatusMap').then((m) => ({ default: m.PointsStatusMap })));

function GroupPointSummary({ groupId }: { groupId: number }) {
  const query = useQuery({ queryKey: ['patrol-point-summary', { group_id: groupId }], queryFn: () => patrolApi.pointSummary({ group_id: groupId }) });
  if (query.isPending) return <TableSkeleton cols={6} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return <PointSummaryView summary={query.data} fileName={`rekap-titik-group-${groupId}.csv`} />;
}

function GroupScans({ groupId, onOpen }: { groupId: number; onOpen: (id: number) => void }) {
  const [page, setPage] = useState(1);
  const params = { group_id: groupId, page, limit: 20 };
  const query = useQuery({ queryKey: ['patrol-scans', 'list', params], queryFn: () => patrolApi.scans(params), placeholderData: keepPreviousData });
  if (query.isPending) return <TableSkeleton cols={8} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data.items.length === 0) return <EmptyState title="Belum ada scan di group ini" />;
  return (
    <>
      <ScansTable scans={query.data.items} onOpen={onOpen} showShift={false} />
      <PaginationBar pagination={query.data.pagination} onPageChange={setPage} />
    </>
  );
}

export default function GroupDetailPage() {
  const id = Number(useParams().id);
  const [scanId, setScanId] = useState<number | null>(null);
  const query = useQuery({ queryKey: ['patrol-groups', 'detail', id], queryFn: () => patrolApi.group(id), enabled: Number.isFinite(id) });

  const title = query.data ? `${query.data.unit.name} · ${query.data.shift.name} · ${formatDate(query.data.shift_date)}` : 'Detail Group';

  return (
    <>
      <Breadcrumbs mb="xs">
        <Anchor component={Link} to="/monitoring" size="sm">Monitoring Patroli</Anchor>
        <Text size="sm">{title}</Text>
      </Breadcrumbs>
      <PageHeader
        title={title}
        actions={
          query.data && (
            <Button component={Link} to={`/checkpoints?group_id=${id}`} variant="light" size="sm">
              Lihat di Titik per Shift
            </Button>
          )
        }
      />
      {query.isPending ? (
        <Stack>
          <CardsSkeleton count={3} />
          <TableSkeleton />
        </Stack>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <Stack>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            <Card withBorder radius="md">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">Status</Text>
              <Group mt={6}><GroupStatusBadge status={query.data.status} /></Group>
              <Text size="xs" c="dimmed" mt={6}>{formatDateTime(query.data.start_at)} – {formatDateTime(query.data.end_at)}</Text>
            </Card>
            <Card withBorder radius="md">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase" mb={6}>Progres</Text>
              <ProgressCell progress={query.data.progress} />
            </Card>
            <Card withBorder radius="md">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">Total scan</Text>
              <Text fz={24} fw={700}>{query.data.progress.total_scans}</Text>
            </Card>
            <Card withBorder radius="md">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">Temuan tidak normal</Text>
              <Text fz={24} fw={700} c={query.data.progress.abnormal_scans ? 'red' : undefined}>{query.data.progress.abnormal_scans}</Text>
            </Card>
          </SimpleGrid>
          <Card withBorder radius="md">
            <Tabs defaultValue="checklist" keepMounted={false}>
              <Tabs.List mb="md">
                <Tabs.Tab value="checklist">Checklist ({query.data.items.length})</Tabs.Tab>
                <Tabs.Tab value="map">Peta</Tabs.Tab>
                <Tabs.Tab value="scans">Scan ({query.data.progress.total_scans})</Tabs.Tab>
                <Tabs.Tab value="summary">Rekap per titik</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="checklist">
                <GroupItemsTable items={query.data.items} />
              </Tabs.Panel>
              <Tabs.Panel value="map">
                <Suspense fallback={<Skeleton h={380} />}>
                  <PointsStatusMap items={query.data.items} />
                </Suspense>
              </Tabs.Panel>
              <Tabs.Panel value="scans">
                <GroupScans groupId={id} onOpen={setScanId} />
              </Tabs.Panel>
              <Tabs.Panel value="summary">
                <GroupPointSummary groupId={id} />
              </Tabs.Panel>
            </Tabs>
          </Card>
        </Stack>
      )}
      <ScanDetailDrawer scanId={scanId} onClose={() => setScanId(null)} />
    </>
  );
}
