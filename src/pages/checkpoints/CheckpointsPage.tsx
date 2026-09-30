import { Badge, Button, Card, CloseButton, Group, SegmentedControl, Table, Text, Tooltip } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { patrolApi } from '@/api/patrol';
import { ConditionBadge } from '@/components/Badges';
import { DateRangeFilter, ShiftSelect } from '@/components/Filters';
import { PageHeader } from '@/components/PageHeader';
import { PaginationBar } from '@/components/PaginationBar';
import { SearchInput } from '@/components/SearchInput';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/StateViews';
import { toNumber, toPage, useUrlFilters } from '@/hooks/useUrlFilters';
import { serverNow } from '@/lib/api/clock';
import type { PatrolListItem } from '@/lib/api/types';
import { formatDate, formatDateTime, formatTime } from '@/lib/format';

const KEYS = ['group_id', 'shift_id', 'date_from', 'date_to', 'status', 'search', 'page', 'limit'] as const;

/** Unscanned point of a group whose shift already ended. */
function isMissed(item: PatrolListItem): boolean {
  return !item.is_scanned && Boolean(item.group) && Date.parse(item.group!.end_at) <= serverNow();
}

export default function CheckpointsPage() {
  const { filters, setFilters, resetFilters } = useUrlFilters(KEYS, { limit: '20' });
  const params = {
    group_id: toNumber(filters.group_id),
    shift_id: toNumber(filters.shift_id),
    date_from: filters.date_from,
    date_to: filters.date_to,
    status: (filters.status || undefined) as 'scanned' | 'unscanned' | undefined,
    search: filters.search,
    page: toPage(filters.page),
    limit: Number(filters.limit) || 20,
  };
  const query = useQuery({ queryKey: ['patrol-list-items', params], queryFn: () => patrolApi.listItems(params), placeholderData: keepPreviousData });
  const group = params.group_id
    ? query.data?.items[0]?.group
    : undefined;
  const hasFilter = KEYS.some((k) => k !== 'page' && k !== 'limit' && filters[k]);

  return (
    <>
      <PageHeader title="Titik per Shift/Periode" description="Status scan setiap titik pada group patroli yang dipilih." />
      <Card withBorder radius="md">
        <Group mb="md" gap="sm">
          {params.group_id && (
            <Badge size="lg" variant="light" rightSection={<CloseButton size="xs" aria-label="Hapus filter group" onClick={() => setFilters({ group_id: null })} />}>
              Group: {group ? `${group.shift_name} · ${formatDate(group.shift_date)}` : `#${params.group_id}`}
            </Badge>
          )}
          <ShiftSelect value={filters.shift_id} onChange={(shift_id) => setFilters({ shift_id })} />
          <DateRangeFilter from={filters.date_from} to={filters.date_to} onChange={(date_from, date_to) => setFilters({ date_from, date_to })} />
          <SegmentedControl
            aria-label="Filter status scan"
            value={filters.status}
            onChange={(status) => setFilters({ status })}
            data={[
              { value: '', label: 'Semua' },
              { value: 'scanned', label: 'Sudah' },
              { value: 'unscanned', label: 'Belum' },
            ]}
          />
          <SearchInput value={filters.search} onChange={(search) => setFilters({ search })} placeholder="Cari titik" w={200} />
          {hasFilter && (
            <Button variant="subtle" size="xs" onClick={resetFilters}>
              Reset filter
            </Button>
          )}
        </Group>
        {query.isPending ? (
          <TableSkeleton cols={6} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <EmptyState title="Tidak ada titik" description={hasFilter ? 'Coba ubah filter.' : undefined} />
        ) : (
          <Table.ScrollContainer minWidth={900}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Shift</Table.Th>
                  <Table.Th>Titik</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Scan</Table.Th>
                  <Table.Th>Terakhir di-scan</Table.Th>
                  <Table.Th>Petugas</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {query.data.items.map((item) => {
                  const missed = isMissed(item);
                  return (
                    <Table.Tr key={item.id} className={missed ? 'row-warning' : item.last_condition === 'abnormal' ? 'row-danger' : undefined}>
                      <Table.Td>
                        {item.group ? (
                          <>
                            <Text size="sm">{item.group.shift_name}</Text>
                            <Text size="xs" c="dimmed">
                              {formatDate(item.group.shift_date)} · {formatTime(item.group.start_at)}–{formatTime(item.group.end_at)}
                            </Text>
                          </>
                        ) : (
                          '-'
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={600}>{item.name}</Text>
                        <Text size="xs" c="dimmed">{item.location} · <span style={{ fontFamily: 'monospace' }}>{item.nfc_code}</span></Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <ConditionBadge condition={item.is_scanned ? item.last_condition : null} />
                          {missed && (
                            <Tooltip label="Shift sudah selesai dan titik ini tidak di-scan">
                              <Badge color="orange" leftSection={<IconAlertTriangle size={12} />}>Terlewat</Badge>
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>{item.scan_count}</Table.Td>
                      <Table.Td>{formatDateTime(item.last_scanned_at)}</Table.Td>
                      <Table.Td>{item.last_scanned_by?.name ?? '-'}</Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
        <PaginationBar pagination={query.data?.pagination} onPageChange={(page) => setFilters({ page })} onLimitChange={(limit) => setFilters({ limit })} />
      </Card>
    </>
  );
}
