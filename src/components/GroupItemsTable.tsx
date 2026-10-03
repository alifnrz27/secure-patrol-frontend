import { Group, Progress, Table, Text } from '@mantine/core';
import { Fragment } from 'react';
import { groupByArea } from '@/lib/areas';
import type { GroupProgress, PatrolListItem } from '@/lib/api/types';
import { formatDateTime, percent } from '@/lib/format';
import { ConditionBadge } from './Badges';
import { EmptyState } from './StateViews';

function ItemRow({ item }: { item: PatrolListItem }) {
  return (
    <Table.Tr className={item.last_condition === 'abnormal' ? 'row-danger' : undefined}>
      <Table.Td>
        <Text size="sm" fw={600}>{item.name}</Text>
        <Text size="xs" c="dimmed">{item.location}</Text>
      </Table.Td>
      <Table.Td><ConditionBadge condition={item.is_scanned ? item.last_condition : null} /></Table.Td>
      <Table.Td>{item.scan_count}</Table.Td>
      <Table.Td>{formatDateTime(item.last_scanned_at)}</Table.Td>
      <Table.Td>{item.last_scanned_by?.name ?? '-'}</Table.Td>
    </Table.Tr>
  );
}

/** Checklist of one group: last status per NFC point, grouped per area with a subtotal. */
export function GroupItemsTable({ items }: { items: PatrolListItem[] }) {
  if (items.length === 0) return <EmptyState title="Belum ada titik patroli di shift ini" />;
  const areas = groupByArea(items);
  return (
    <Table.ScrollContainer minWidth={640}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Titik</Table.Th>
            <Table.Th>Status terakhir</Table.Th>
            <Table.Th>Scan</Table.Th>
            <Table.Th>Waktu</Table.Th>
            <Table.Th>Petugas</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {areas
            ? areas.map((area) => {
                const scanned = area.items.filter((i) => i.is_scanned).length;
                const scans = area.items.reduce((sum, i) => sum + i.scan_count, 0);
                return (
                  <Fragment key={area.key}>
                    <Table.Tr className="area-row">
                      <Table.Td colSpan={5}>
                        <Group justify="space-between" gap="xs">
                          <Text size="sm" fw={700}>{area.name}</Text>
                          <Group gap="sm">
                            <Text size="xs" c="dimmed">{scanned}/{area.items.length} titik di-scan · {scans} scan</Text>
                            <Progress value={percent(scanned, area.items.length)} w={80} size="sm" color={scanned === area.items.length ? 'teal' : 'blue'} aria-hidden />
                          </Group>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                    {area.items.map((item) => <ItemRow key={item.id} item={item} />)}
                  </Fragment>
                );
              })
            : items.map((item) => <ItemRow key={item.id} item={item} />)}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

export function ProgressCell({ progress }: { progress: GroupProgress }) {
  const pct = percent(progress.scanned_points, progress.total_points);
  return (
    <div style={{ minWidth: 140 }}>
      <Group justify="space-between" gap={4} mb={2}>
        <Text size="xs">
          {progress.scanned_points}/{progress.total_points} titik
        </Text>
        <Text size="xs" fw={600}>{pct}%</Text>
      </Group>
      <Progress value={pct} color={pct === 100 ? 'teal' : 'blue'} size="sm" aria-label={`Progres ${pct} persen`} />
    </div>
  );
}
