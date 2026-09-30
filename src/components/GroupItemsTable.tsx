import { Group, Progress, Table, Text } from '@mantine/core';
import type { GroupProgress, PatrolListItem } from '@/lib/api/types';
import { formatDateTime, percent } from '@/lib/format';
import { ConditionBadge } from './Badges';
import { EmptyState } from './StateViews';

/** Checklist of one group: last status per NFC point. */
export function GroupItemsTable({ items }: { items: PatrolListItem[] }) {
  if (items.length === 0) return <EmptyState title="Belum ada titik patroli di shift ini" />;
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
          {items.map((item) => (
            <Table.Tr key={item.id} className={item.last_condition === 'abnormal' ? 'row-danger' : undefined}>
              <Table.Td>
                <Text size="sm" fw={600}>{item.name}</Text>
                <Text size="xs" c="dimmed">{item.location}</Text>
              </Table.Td>
              <Table.Td><ConditionBadge condition={item.is_scanned ? item.last_condition : null} /></Table.Td>
              <Table.Td>{item.scan_count}</Table.Td>
              <Table.Td>{formatDateTime(item.last_scanned_at)}</Table.Td>
              <Table.Td>{item.last_scanned_by?.name ?? '-'}</Table.Td>
            </Table.Tr>
          ))}
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
