import { Alert, Anchor, Badge, Button, Card, Group, Progress, SimpleGrid, Skeleton, Stack, Table, Text, Title } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { patrolApi } from '@/api/patrol';
import { GroupStatusBadge } from '@/components/Badges';
import { DateRangeFilter, ShiftSelect } from '@/components/Filters';
import { PageHeader } from '@/components/PageHeader';
import { CardsSkeleton, EmptyState, ErrorState, TableSkeleton } from '@/components/StateViews';
import { useUnitScope } from '@/hooks/useUnitScope';
import { toNumber, useUrlFilters } from '@/hooks/useUrlFilters';
import type { PatrolGroup } from '@/lib/api/types';
import { downloadCsv, toCsv } from '@/lib/csv';
import { dayjs, formatDate, formatTime, nowTz, percent } from '@/lib/format';
import { fetchAllPages, MAX_PAGE_SIZE } from '@/lib/pagination';

const MAX_DAYS = 31;
const KEYS = ['date_from', 'date_to', 'shift_id'] as const;

interface DailyRow {
  date: string;
  label: string;
  scanned: number;
  total: number;
  completion: number;
  abnormal: number;
}

function daily(groups: PatrolGroup[]): DailyRow[] {
  const byDate = new Map<string, DailyRow>();
  for (const g of groups) {
    // Upcoming groups have not started yet and would pull the rate down.
    if (g.status === 'upcoming') continue;
    const row = byDate.get(g.shift_date) ?? { date: g.shift_date, label: dayjs(g.shift_date).format('DD MMM'), scanned: 0, total: 0, completion: 0, abnormal: 0 };
    row.scanned += g.progress.scanned_points;
    row.total += g.progress.total_points;
    row.abnormal += g.progress.abnormal_scans;
    byDate.set(g.shift_date, row);
  }
  return [...byDate.values()]
    .map((r) => ({ ...r, completion: percent(r.scanned, r.total) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

interface UnitRow {
  id: number;
  name: string;
  scanned: number;
  total: number;
  scans: number;
  abnormal: number;
  missed: number;
}

function byUnit(groups: PatrolGroup[]): UnitRow[] {
  const rows = new Map<number, UnitRow>();
  for (const g of groups) {
    const row = rows.get(g.unit.id) ?? { id: g.unit.id, name: g.unit.name, scanned: 0, total: 0, scans: 0, abnormal: 0, missed: 0 };
    row.scans += g.progress.total_scans;
    row.abnormal += g.progress.abnormal_scans;
    if (g.status !== 'upcoming') {
      row.scanned += g.progress.scanned_points;
      row.total += g.progress.total_points;
    }
    if (g.status === 'finished') row.missed += g.progress.unscanned_points;
    rows.set(g.unit.id, row);
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function reportCsv(groups: PatrolGroup[]): string {
  return toCsv(
    ['Unit', 'Tanggal shift', 'Shift', 'Mulai', 'Selesai', 'Status', 'Titik di-scan', 'Total titik', 'Penyelesaian (%)', 'Total scan', 'Scan tidak normal'],
    groups.map((g) => [
      g.unit.name,
      g.shift_date,
      g.shift.name,
      formatTime(g.start_at),
      formatTime(g.end_at),
      g.status === 'finished' ? 'Selesai' : g.status === 'ongoing' ? 'Berjalan' : 'Akan datang',
      g.progress.scanned_points,
      g.progress.total_points,
      percent(g.progress.scanned_points, g.progress.total_points),
      g.progress.total_scans,
      g.progress.abnormal_scans,
    ]),
  );
}

function CompletionTooltip({ active, payload }: { active?: boolean; payload?: { payload: DailyRow }[] }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <Card withBorder shadow="sm" p="xs" radius="sm">
      <Text size="sm" fw={600}>{formatDate(row.date)}</Text>
      <Text size="sm">Penyelesaian: {row.completion}% ({row.scanned}/{row.total} titik)</Text>
      <Text size="sm">Scan tidak normal: {row.abnormal}</Text>
    </Card>
  );
}

export default function ReportsPage() {
  const [defaults] = useState(() => ({
    date_from: nowTz().subtract(6, 'day').format('YYYY-MM-DD'),
    date_to: nowTz().format('YYYY-MM-DD'),
  }));
  const { filters, setFilters } = useUrlFilters(KEYS, defaults);
  const [progress, setProgress] = useState(0);
  const { unitId, showUnitColumn } = useUnitScope();

  const days = dayjs(filters.date_to).diff(dayjs(filters.date_from), 'day') + 1;
  const rangeValid = Boolean(filters.date_from && filters.date_to) && days >= 1 && days <= MAX_DAYS;
  const shiftId = toNumber(filters.shift_id);

  const query = useQuery({
    queryKey: ['patrol-groups', 'report', unitId ?? 'all', filters.date_from, filters.date_to, shiftId],
    queryFn: ({ signal }) =>
      fetchAllPages(
        (page, s) => patrolApi.groups({ unit_id: unitId, date_from: filters.date_from, date_to: filters.date_to, shift_id: shiftId, page, limit: MAX_PAGE_SIZE }, s),
        { signal, onProgress: (loaded) => setProgress(loaded) },
      ),
    enabled: rangeValid,
  });

  // "Semua unit": grouped by unit, then date and shift.
  const groups = [...(query.data ?? [])].sort(
    (a, b) => (showUnitColumn ? a.unit.name.localeCompare(b.unit.name) : 0) || a.shift_date.localeCompare(b.shift_date) || a.start_at.localeCompare(b.start_at),
  );
  const perUnit = showUnitColumn ? byUnit(groups) : [];
  const rows = daily(groups);
  const started = groups.filter((g) => g.status !== 'upcoming');
  const totals = started.reduce(
    (acc, g) => ({
      scanned: acc.scanned + g.progress.scanned_points,
      total: acc.total + g.progress.total_points,
      scans: acc.scans + g.progress.total_scans,
      abnormal: acc.abnormal + g.progress.abnormal_scans,
      missed: acc.missed + (g.status === 'finished' ? g.progress.unscanned_points : 0),
    }),
    { scanned: 0, total: 0, scans: 0, abnormal: 0, missed: 0 },
  );

  return (
    <>
      <PageHeader
        title="Laporan"
        description={`Tingkat penyelesaian patroli per hari per shift (maksimal ${MAX_DAYS} hari).`}
        actions={
          <Button
            variant="light"
            leftSection={<IconDownload size={16} />}
            disabled={!groups.length}
            onClick={() => downloadCsv(`laporan-patroli-${filters.date_from}_${filters.date_to}.csv`, reportCsv(groups))}
          >
            Ekspor CSV
          </Button>
        }
      />
      <Group mb="md" gap="sm">
        <DateRangeFilter
          from={filters.date_from}
          to={filters.date_to}
          clearable={false}
          maxDays={MAX_DAYS}
          onChange={(date_from, date_to) => setFilters({ date_from, date_to })}
        />
        <ShiftSelect value={filters.shift_id} onChange={(shift_id) => setFilters({ shift_id })} />
      </Group>

      {!rangeValid ? (
        <Alert color="orange">Pilih rentang tanggal maksimal {MAX_DAYS} hari.</Alert>
      ) : query.isPending ? (
        <Stack>
          <CardsSkeleton />
          <Text size="sm" c="dimmed">Memuat data… {progress > 0 && `${progress} group`}</Text>
          <Skeleton h={260} />
          <TableSkeleton />
        </Stack>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : groups.length === 0 ? (
        <Card withBorder radius="md">
          <EmptyState title="Tidak ada group patroli pada rentang ini" />
        </Card>
      ) : (
        <Stack>
          <SimpleGrid cols={{ base: 2, lg: 4 }}>
            <Card withBorder radius="md">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">Penyelesaian</Text>
              <Text fz={26} fw={700}>{percent(totals.scanned, totals.total)}%</Text>
              <Text size="sm" c="dimmed">{totals.scanned}/{totals.total} titik</Text>
            </Card>
            <Card withBorder radius="md">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">Total scan</Text>
              <Text fz={26} fw={700}>{totals.scans}</Text>
              <Text size="sm" c="dimmed">{started.length} group</Text>
            </Card>
            <Card withBorder radius="md">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">Temuan tidak normal</Text>
              <Text fz={26} fw={700} c={totals.abnormal ? 'red' : undefined}>{totals.abnormal}</Text>
              {totals.abnormal > 0 && (
                <Button component={Link} to={`/scans?condition=abnormal&date_from=${filters.date_from}&date_to=${filters.date_to}`} size="compact-xs" variant="subtle" px={0}>
                  Lihat temuan
                </Button>
              )}
            </Card>
            <Card withBorder radius="md">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">Titik terlewat</Text>
              <Text fz={26} fw={700} c={totals.missed ? 'orange' : undefined}>{totals.missed}</Text>
              <Text size="sm" c="dimmed">pada shift yang sudah selesai</Text>
            </Card>
          </SimpleGrid>

          {perUnit.length > 0 && (
            <Card withBorder radius="md">
              <Title order={4} mb="sm">Per unit</Title>
              <Table.ScrollContainer minWidth={640}>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Unit</Table.Th>
                      <Table.Th>Penyelesaian</Table.Th>
                      <Table.Th>Total scan</Table.Th>
                      <Table.Th>Tidak normal</Table.Th>
                      <Table.Th>Titik terlewat</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {perUnit.map((u) => (
                      <Table.Tr key={u.id}>
                        <Table.Td fw={600}>{u.name}</Table.Td>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            <Progress value={percent(u.scanned, u.total)} w={90} size="sm" color={u.scanned === u.total && u.total ? 'teal' : 'blue'} aria-hidden />
                            <Text size="sm">{u.scanned}/{u.total} ({percent(u.scanned, u.total)}%)</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>{u.scans}</Table.Td>
                        <Table.Td>{u.abnormal > 0 ? <Badge color="red">{u.abnormal}</Badge> : 0}</Table.Td>
                        <Table.Td>{u.missed > 0 ? <Text c="orange" fw={600} size="sm">{u.missed}</Text> : 0}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Card>
          )}

          <Card withBorder radius="md">
            <Title order={4}>Penyelesaian harian (%)</Title>
            <Text size="xs" c="dimmed" mb="sm">Titik yang di-scan dibanding total titik, semua shift yang sudah dimulai pada tanggal tersebut.</Text>
            <div style={{ height: 260 }} role="img" aria-label={`Grafik penyelesaian harian. ${rows.map((r) => `${r.label}: ${r.completion}%`).join(', ')}`}>
              <ResponsiveContainer>
                <BarChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--mantine-color-gray-2)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} fontSize={12} unit="%" />
                  <Tooltip content={<CompletionTooltip />} cursor={{ fill: 'var(--mantine-color-gray-1)' }} />
                  <Bar dataKey="completion" fill="#1c7ed6" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card withBorder radius="md">
            <Title order={4} mb="sm">Per tanggal × shift</Title>
            <Table.ScrollContainer minWidth={760}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    {showUnitColumn && <Table.Th>Unit</Table.Th>}
                    <Table.Th>Tanggal</Table.Th>
                    <Table.Th>Shift</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Penyelesaian</Table.Th>
                    <Table.Th>Total scan</Table.Th>
                    <Table.Th>Tidak normal</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {groups.map((g) => {
                    const pct = percent(g.progress.scanned_points, g.progress.total_points);
                    return (
                      <Table.Tr key={g.id}>
                        {showUnitColumn && <Table.Td>{g.unit.name}</Table.Td>}
                        <Table.Td>{formatDate(g.shift_date)}</Table.Td>
                        <Table.Td>
                          <Anchor component={Link} to={`/monitoring/${g.id}`} size="sm">{g.shift.name}</Anchor>
                        </Table.Td>
                        <Table.Td><GroupStatusBadge status={g.status} /></Table.Td>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            <Progress value={pct} w={90} size="sm" color={pct === 100 ? 'teal' : 'blue'} aria-hidden />
                            <Text size="sm">
                              {g.progress.scanned_points}/{g.progress.total_points} ({pct}%)
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>{g.progress.total_scans}</Table.Td>
                        <Table.Td>{g.progress.abnormal_scans > 0 ? <Badge color="red">{g.progress.abnormal_scans}</Badge> : 0}</Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        </Stack>
      )}
    </>
  );
}
