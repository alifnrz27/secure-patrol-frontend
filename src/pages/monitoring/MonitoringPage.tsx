import { Badge, Button, Card, Group, Table, Text } from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { patrolApi } from '@/api/patrol';
import { GroupStatusBadge } from '@/components/Badges';
import { DateRangeFilter, ShiftSelect } from '@/components/Filters';
import { ProgressCell } from '@/components/GroupItemsTable';
import { PageHeader } from '@/components/PageHeader';
import { PaginationBar } from '@/components/PaginationBar';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/StateViews';
import { useUnitScope } from '@/hooks/useUnitScope';
import { toNumber, toPage, useUrlFilters } from '@/hooks/useUrlFilters';
import { formatDate, formatTime } from '@/lib/format';

const KEYS = ['shift_id', 'date_from', 'date_to', 'page', 'limit'] as const;

export default function MonitoringPage() {
  const { filters, setFilters, resetFilters } = useUrlFilters(KEYS, { limit: '20' });
  const { unitId, showUnitColumn } = useUnitScope();
  const params = {
    unit_id: unitId,
    shift_id: toNumber(filters.shift_id),
    date_from: filters.date_from,
    date_to: filters.date_to,
    page: toPage(filters.page),
    limit: Number(filters.limit) || 20,
  };
  const query = useQuery({ queryKey: ['patrol-groups', 'list', params], queryFn: () => patrolApi.groups(params), placeholderData: keepPreviousData });
  const hasFilter = Boolean(filters.shift_id || filters.date_from);

  return (
    <>
      <PageHeader title="Monitoring Patroli" description="Group patroli per shift per tanggal, terbaru dulu." />
      <Card withBorder radius="md">
        <Group mb="md" gap="sm">
          <ShiftSelect value={filters.shift_id} onChange={(shift_id) => setFilters({ shift_id })} />
          <DateRangeFilter from={filters.date_from} to={filters.date_to} onChange={(date_from, date_to) => setFilters({ date_from, date_to })} />
          {hasFilter && (
            <Button variant="subtle" size="xs" onClick={resetFilters}>
              Reset filter
            </Button>
          )}
        </Group>
        {query.isPending ? (
          <TableSkeleton cols={7} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <EmptyState title="Tidak ada group patroli" description={hasFilter ? 'Coba ubah filter.' : 'Group dibuat otomatis saat shift dimulai.'} />
        ) : (
          <Table.ScrollContainer minWidth={860}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tanggal shift</Table.Th>
                  {showUnitColumn && <Table.Th>Unit</Table.Th>}
                  <Table.Th>Shift</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Progres</Table.Th>
                  <Table.Th>Scan</Table.Th>
                  <Table.Th>Temuan</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {query.data.items.map((group) => (
                  <Table.Tr key={group.id}>
                    <Table.Td>{formatDate(group.shift_date)}</Table.Td>
                    {showUnitColumn && <Table.Td>{group.unit.name}</Table.Td>}
                    <Table.Td>
                      <Text size="sm" fw={600}>{group.shift.name}</Text>
                      <Text size="xs" c="dimmed">{formatTime(group.start_at)}–{formatTime(group.end_at)}</Text>
                    </Table.Td>
                    <Table.Td><GroupStatusBadge status={group.status} /></Table.Td>
                    <Table.Td><ProgressCell progress={group.progress} /></Table.Td>
                    <Table.Td>{group.progress.total_scans}</Table.Td>
                    <Table.Td>
                      {group.progress.abnormal_scans > 0 ? (
                        <Badge color="red">{group.progress.abnormal_scans} tidak normal</Badge>
                      ) : (
                        <Text size="sm" c="dimmed">0</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Button component={Link} to={`/monitoring/${group.id}`} size="xs" variant="light">
                        Detail
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
        <PaginationBar pagination={query.data?.pagination} onPageChange={(page) => setFilters({ page })} onLimitChange={(limit) => setFilters({ limit })} />
      </Card>
    </>
  );
}
