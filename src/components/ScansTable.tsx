import { Badge, Group, Table, Text, Tooltip } from '@mantine/core';
import { IconCloudOff, IconPhoto } from '@tabler/icons-react';
import type { PatrolScan } from '@/lib/api/types';
import { formatDate, formatDateTime, formatDistance, isSentOffline } from '@/lib/format';
import { ConditionBadge, YesNoBadge } from './Badges';

export function ScansTable({ scans, onOpen, showShift = true, showUnit = false }: { scans: PatrolScan[]; onOpen: (id: number) => void; showShift?: boolean; showUnit?: boolean }) {
  return (
    <Table.ScrollContainer minWidth={1100}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Waktu scan</Table.Th>
            {showUnit && <Table.Th>Unit</Table.Th>}
            {showShift && <Table.Th>Shift</Table.Th>}
            <Table.Th>Titik</Table.Th>
            <Table.Th>Kondisi</Table.Th>
            <Table.Th>Catatan</Table.Th>
            <Table.Th>Petugas</Table.Th>
            <Table.Th>Jarak</Table.Th>
            <Table.Th>Lokasi</Table.Th>
            <Table.Th>Wajah</Table.Th>
            <Table.Th>Foto</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {scans.map((scan) => (
            <Table.Tr
              key={scan.id}
              onClick={() => onOpen(scan.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(scan.id))}
              tabIndex={0}
              role="button"
              aria-label={`Detail scan ${scan.patrol_point.name} ${formatDateTime(scan.scanned_at)}`}
              style={{ cursor: 'pointer' }}
              className={scan.condition === 'abnormal' ? 'row-danger' : undefined}
            >
              <Table.Td>
                <Group gap={4} wrap="nowrap">
                  <Text size="sm">{formatDateTime(scan.scanned_at)}</Text>
                  {isSentOffline(scan.scanned_at, scan.received_at) && (
                    <Tooltip label={`Dikirim offline, diterima ${formatDateTime(scan.received_at)}`}>
                      <IconCloudOff size={14} color="var(--mantine-color-orange-6)" aria-label="Dikirim offline" />
                    </Tooltip>
                  )}
                </Group>
              </Table.Td>
              {showUnit && <Table.Td>{scan.group.unit_name}</Table.Td>}
              {showShift && (
                <Table.Td>
                  <Text size="sm">{scan.group.shift_name}</Text>
                  <Text size="xs" c="dimmed">{formatDate(scan.group.shift_date)}</Text>
                </Table.Td>
              )}
              <Table.Td>
                <Text size="sm" fw={600}>{scan.patrol_point.name}</Text>
                <Text size="xs" c="dimmed">{scan.patrol_point.location}</Text>
              </Table.Td>
              <Table.Td><ConditionBadge condition={scan.condition} /></Table.Td>
              <Table.Td maw={220}>
                <Text size="sm" lineClamp={2}>{scan.note || '-'}</Text>
              </Table.Td>
              <Table.Td>{scan.scanned_by.name}</Table.Td>
              <Table.Td>{formatDistance(scan.distance_meters)}</Table.Td>
              <Table.Td><YesNoBadge value={scan.is_location_valid} /></Table.Td>
              <Table.Td><YesNoBadge value={scan.is_face_verified} yes="Ya" no="Tidak" /></Table.Td>
              <Table.Td>
                {scan.photos.length > 0 ? (
                  <Badge variant="light" color="gray" leftSection={<IconPhoto size={12} />}>{scan.photos.length}</Badge>
                ) : (
                  <Text size="sm" c="dimmed">0</Text>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
