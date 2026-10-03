import { Badge, Button, Card, Group, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PointSummary, PointSummaryItem } from '@/lib/api/types';
import { Fragment } from 'react';
import { groupByArea } from '@/lib/areas';
import { downloadCsv } from '@/lib/csv';
import { formatDate, formatDateTime } from '@/lib/format';
import { BAR_SCALE_MAX, barValue, pointStatus, pointSummaryCsv } from './pointSummary';
import { EmptyState } from './StateViews';

interface Row extends PointSummaryItem {
  bar: number;
  label: string;
}

const BATTERY_FILL = '#1c7ed6';
const BATTERY_OUTLINE = '#868e96';
const CAP_WIDTH = 4;
const PADDING = 2;

interface BatteryBarProps {
  y?: number;
  height?: number;
  payload?: Row;
  /** Full track of the row (the whole 0–10 scale), from the Bar `background` prop. */
  background?: { x?: number | null; y?: number | null; width?: number | null; height?: number | null };
}

/**
 * One row drawn as a battery: an outlined body over the full 0–10 scale, a
 * small cap at the end, and a fill for the scans (10 or more = full). The real
 * number (or "Belum di-scan") is written after the cap.
 */
function BatteryBar({ y = 0, height = 0, payload, background }: BatteryBarProps) {
  if (!payload || !background?.width) return null;
  const left = background.x ?? 0;
  const bodyWidth = Math.max(0, background.width - CAP_WIDTH - 2);
  const fillWidth = Math.max(0, (bodyWidth - PADDING * 2) * (payload.bar / BAR_SCALE_MAX));
  const empty = payload.total_scans === 0;
  return (
    <g>
      <rect x={left} y={y} width={bodyWidth} height={height} rx={4} fill="var(--mantine-color-body)" stroke={BATTERY_OUTLINE} strokeWidth={1.5} />
      <rect x={left + bodyWidth + 1} y={y + height * 0.25} width={CAP_WIDTH} height={height * 0.5} rx={1.5} fill={BATTERY_OUTLINE} />
      {fillWidth > 0 && <rect x={left + PADDING} y={y + PADDING} width={fillWidth} height={Math.max(0, height - PADDING * 2)} rx={2.5} fill={BATTERY_FILL} />}
      <text
        x={left + bodyWidth + CAP_WIDTH + 10}
        y={y + height / 2}
        dominantBaseline="central"
        fontSize={12}
        fontWeight={empty ? 400 : 600}
        fill={empty ? 'var(--mantine-color-red-7)' : 'var(--mantine-color-text)'}
      >
        {payload.label}
      </text>
    </g>
  );
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
    </Card>
  );
}

function StatusBadge({ item }: { item: PointSummaryItem }) {
  const status = pointStatus(item);
  if (status === 'unscanned') return <Badge color="red" variant="light">Belum di-scan</Badge>;
  if (status === 'partial') return <Badge color="orange" variant="light">Terlewat {item.groups - item.scanned_groups} shift</Badge>;
  return <Badge color="green" variant="light">Lengkap</Badge>;
}

function SummaryRow({ item }: { item: PointSummaryItem }) {
  const status = pointStatus(item);
  return (
    <Table.Tr className={status === 'unscanned' ? 'row-danger' : status === 'partial' ? 'row-warning' : undefined}>
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
      <Table.Td>{formatDateTime(item.first_scanned_at)}</Table.Td>
      <Table.Td>{formatDateTime(item.last_scanned_at)}</Table.Td>
    </Table.Tr>
  );
}

/** Area name with its subtotal: points scanned, scans and abnormal scans. */
function AreaHeading({ name, items }: { name: string; items: PointSummaryItem[] }) {
  const scanned = items.filter((i) => i.total_scans > 0).length;
  const scans = items.reduce((sum, i) => sum + i.total_scans, 0);
  const abnormal = items.reduce((sum, i) => sum + i.abnormal_scans, 0);
  return (
    <Group justify="space-between" gap="xs" mb={4}>
      <Text size="sm" fw={700}>{name}</Text>
      <Text size="xs" c="dimmed">
        {scanned}/{items.length} titik di-scan · {scans} scan
        {abnormal > 0 && <Text span size="xs" c="red" fw={600}> · {abnormal} tidak normal</Text>}
      </Text>
    </Group>
  );
}

/** `showAxis` = false hides the 0–10 scale, so stacked per-area charts show it only once (under the last). */
function BatteryChart({ rows, showAxis = true }: { rows: Row[]; showAxis?: boolean }) {
  return (
    <div style={{ height: rows.length * 40 + (showAxis ? 40 : 12) }} role="img" aria-label={`Grafik total scan per titik. ${rows.map((r) => `${r.name}: ${r.total_scans}`).join(', ')}`}>
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 96, left: 8, bottom: 4 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke="var(--mantine-color-gray-2)" />
          <XAxis type="number" domain={[0, BAR_SCALE_MAX]} ticks={[0, 2, 4, 6, 8, 10]} tickLine={false} axisLine={false} fontSize={12} hide={!showAxis} />
          <YAxis type="category" dataKey="name" width={170} tickLine={false} axisLine={false} fontSize={12} interval={0} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--mantine-color-gray-1)' }} />
          {/* `background` gives each row its full 0–10 track, drawn by BatteryBar as the battery outline. */}
          <Bar dataKey="bar" maxBarSize={22} minPointSize={1} background={{ fill: 'transparent' }} shape={BatteryBar} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
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
  const areaRows = groupByArea(rows);
  const areaItems = groupByArea(summary.items);
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
          Setiap titik ditampilkan seperti baterai berskala 0–{BAR_SCALE_MAX}: {BAR_SCALE_MAX} scan atau lebih = penuh; angka di kanan adalah jumlah sebenarnya.
        </Text>
        {areaRows ? (
          <Stack gap="lg">
            {areaRows.map((area, index) => (
              <div key={area.key}>
                <AreaHeading name={area.name} items={area.items} />
                <BatteryChart rows={area.items} showAxis={index === areaRows.length - 1} />
              </div>
            ))}
          </Stack>
        ) : (
          <BatteryChart rows={rows} />
        )}
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
                <Table.Th>Scan pertama</Table.Th>
                <Table.Th>Scan terakhir</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {areaItems
                ? areaItems.map((area) => (
                    <Fragment key={area.key}>
                      <Table.Tr className="area-row">
                        <Table.Td colSpan={7}>
                          <AreaHeading name={area.name} items={area.items} />
                        </Table.Td>
                      </Table.Tr>
                      {area.items.map((item) => <SummaryRow key={item.patrol_point_id} item={item} />)}
                    </Fragment>
                  ))
                : summary.items.map((item) => <SummaryRow key={item.patrol_point_id} item={item} />)}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    </Stack>
  );
}
