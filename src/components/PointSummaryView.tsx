import { Badge, Button, Card, Group, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PointSummary, PointSummaryItem } from '@/lib/api/types';
import { downloadCsv } from '@/lib/csv';
import { formatDate, formatDateTime } from '@/lib/format';
import { BAR_SCALE_MAX, barValue, pointStatus, pointSummaryCsv } from './pointSummary';
import { EmptyState } from './StateViews';

interface Row extends PointSummaryItem {
  bar: number;
  label: string;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <Card withBorder shadow="sm" p="xs" radius="sm">
      <Text size="sm" fw={600}>{row.name}</Text>
      <Text size="xs" c="dimmed">{row.location}</Text>
      <Text size="sm" mt={4}>Total scan: {row.total_scans} ({row.normal_scans} normal, {row.abnormal_scans} tidak normal)</Text>
      <Text size="sm">Petugas: {row.officers}</Text>
      <Text size="sm">Shift ter-scan: {row.scanned_groups}/{row.groups}</Text>
    </Card>
  );
}

function StatusBadge({ item }: { item: PointSummaryItem }) {
  const status = pointStatus(item);
  if (status === 'unscanned') return <Badge color="red" variant="light">Belum di-scan</Badge>;
  if (status === 'partial') return <Badge color="orange" variant="light">Terlewat {item.groups - item.scanned_groups} shift</Badge>;
  return <Badge color="green" variant="light">Lengkap</Badge>;
}

/**
 * Total patrols per point for one shift: horizontal bars on a 0–10 scale
 * (10 or more scans = full bar, the real number is printed at the bar end),
 * plus a table that highlights points not scanned or missed in some shifts.
 */
export function PointSummaryView({ summary, fileName }: { summary: PointSummary; fileName: string }) {
  if (summary.items.length === 0) return <EmptyState title="Belum ada titik patroli di shift ini" />;

  const rows: Row[] = summary.items.map((item) => ({
    ...item,
    bar: barValue(item.total_scans),
    label: item.total_scans === 0 ? 'Belum di-scan' : String(item.total_scans),
  }));
  const { totals } = summary;
  const period = summary.date_from === summary.date_to ? formatDate(summary.date_from) : `${formatDate(summary.date_from)} – ${formatDate(summary.date_to)}`;

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <Text size="sm" c="dimmed">
          {summary.unit.name} · {summary.shift.name} · {period} · {summary.groups} shift
        </Text>
        <Button size="xs" variant="light" leftSection={<IconDownload size={14} />} onClick={() => downloadCsv(fileName, pointSummaryCsv(summary))}>
          Ekspor CSV
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Card withBorder radius="md" p="sm">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Titik di-scan</Text>
          <Text fz={22} fw={700}>{totals.scanned_points}/{totals.points}</Text>
        </Card>
        <Card withBorder radius="md" p="sm">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Belum di-scan</Text>
          <Text fz={22} fw={700} c={totals.unscanned_points ? 'red' : undefined}>{totals.unscanned_points}</Text>
        </Card>
        <Card withBorder radius="md" p="sm">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Total scan</Text>
          <Text fz={22} fw={700}>{totals.total_scans}</Text>
        </Card>
        <Card withBorder radius="md" p="sm">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Tidak normal</Text>
          <Text fz={22} fw={700} c={totals.abnormal_scans ? 'red' : undefined}>{totals.abnormal_scans}</Text>
        </Card>
      </SimpleGrid>

      <Card withBorder radius="md">
        <Title order={5}>Total scan per titik</Title>
        <Text size="xs" c="dimmed" mb="sm">
          Skala 0–{BAR_SCALE_MAX}: titik dengan {BAR_SCALE_MAX} scan atau lebih selalu bar penuh; angka di ujung bar adalah jumlah sebenarnya.
        </Text>
        <div
          style={{ height: rows.length * 34 + 40 }}
          role="img"
          aria-label={`Grafik total scan per titik. ${rows.map((r) => `${r.name}: ${r.total_scans}`).join(', ')}`}
        >
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 96, left: 8, bottom: 4 }} barCategoryGap={8}>
              <CartesianGrid horizontal={false} stroke="var(--mantine-color-gray-2)" />
              <XAxis type="number" domain={[0, BAR_SCALE_MAX]} ticks={[0, 2, 4, 6, 8, 10]} allowDataOverflow tickLine={false} axisLine={false} fontSize={12} />
              <YAxis type="category" dataKey="name" width={170} tickLine={false} axisLine={false} fontSize={12} interval={0} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--mantine-color-gray-1)' }} />
              {/* minPointSize gives 0-scan points an invisible bar so their "Belum di-scan" label still renders. */}
              <Bar dataKey="bar" fill="#1c7ed6" radius={[0, 4, 4, 0]} maxBarSize={18} minPointSize={2} isAnimationActive={false}>
                {rows.map((row) => (
                  <Cell key={row.patrol_point_id} fill={row.total_scans === 0 ? 'transparent' : '#1c7ed6'} />
                ))}
                <LabelList dataKey="label" position="right" fontSize={12} fill="var(--mantine-color-text)" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card withBorder radius="md">
        <Table.ScrollContainer minWidth={860}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Titik</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Total scan</Table.Th>
                <Table.Th>Normal / Tidak normal</Table.Th>
                <Table.Th>Petugas</Table.Th>
                <Table.Th>Shift ter-scan</Table.Th>
                <Table.Th>Scan pertama</Table.Th>
                <Table.Th>Scan terakhir</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {summary.items.map((item) => {
                const status = pointStatus(item);
                return (
                  <Table.Tr key={item.patrol_point_id} className={status === 'unscanned' ? 'row-danger' : status === 'partial' ? 'row-warning' : undefined}>
                    <Table.Td>
                      <Text size="sm" fw={600}>{item.name}</Text>
                      <Text size="xs" c="dimmed">{item.location}</Text>
                    </Table.Td>
                    <Table.Td><StatusBadge item={item} /></Table.Td>
                    <Table.Td fw={600}>{item.total_scans}</Table.Td>
                    <Table.Td>
                      {item.normal_scans} / <Text span size="sm" c={item.abnormal_scans ? 'red' : undefined} fw={item.abnormal_scans ? 600 : undefined}>{item.abnormal_scans}</Text>
                    </Table.Td>
                    <Table.Td>{item.officers}</Table.Td>
                    <Table.Td>{item.scanned_groups}/{item.groups}</Table.Td>
                    <Table.Td>{formatDateTime(item.first_scanned_at)}</Table.Td>
                    <Table.Td>{formatDateTime(item.last_scanned_at)}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    </Stack>
  );
}
