import { ActionIcon, Alert, Badge, Drawer, Group, Modal, SimpleGrid, Skeleton, Stack, Table, Text, Title } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconCloudOff } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { patrolApi } from '@/api/patrol';
import { patrolPointsApi } from '@/api/patrolPoints';
import { useAppConfig } from '@/hooks/useSession';
import { formatDate, formatDateTime, formatDistance, isSentOffline } from '@/lib/format';
import type { PatrolScan } from '@/lib/api/types';
import { ConditionBadge, YesNoBadge } from './Badges';
import { SecureImage } from './SecureImage';
import { ErrorState } from './StateViews';

const ScanLocationMap = lazy(() => import('./maps/ScanLocationMap').then((m) => ({ default: m.ScanLocationMap })));

function PhotoLightbox({ photos, index, onChange, onClose }: { photos: PatrolScan['photos']; index: number | null; onChange: (i: number) => void; onClose: () => void }) {
  const photo = index !== null ? photos[index] : undefined;
  return (
    <Modal opened={index !== null} onClose={onClose} size="xl" centered title={index !== null ? `Foto ${index + 1} dari ${photos.length}` : ''}>
      {photo && (
        <Group wrap="nowrap" align="center" gap="xs">
          <ActionIcon variant="light" aria-label="Foto sebelumnya" disabled={index === 0} onClick={() => onChange(index! - 1)}>
            <IconChevronLeft />
          </ActionIcon>
          <SecureImage path={photo.url} alt={`Foto scan ${index! + 1}`} fit="contain" mah="70vh" h="70vh" style={{ flex: 1 }} />
          <ActionIcon variant="light" aria-label="Foto berikutnya" disabled={index === photos.length - 1} onClick={() => onChange(index! + 1)}>
            <IconChevronRight />
          </ActionIcon>
        </Group>
      )}
    </Modal>
  );
}

function ScanDetail({ scan }: { scan: PatrolScan }) {
  const config = useAppConfig();
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const point = useQuery({
    queryKey: ['patrol-points', 'detail', scan.patrol_point.patrol_point_id],
    queryFn: () => patrolPointsApi.get(scan.patrol_point.patrol_point_id),
    retry: false,
  });
  const offline = isSentOffline(scan.scanned_at, scan.received_at);
  const radius = config?.location_radius_meters ?? 100;

  const rows: [string, ReactNode][] = [
    ['Titik', <><b>{scan.patrol_point.name}</b><br /><Text span size="xs" c="dimmed">{scan.patrol_point.location}</Text></>],
    ['Unit', scan.group.unit_name],
    ['Shift', `${scan.group.shift_name} · ${formatDate(scan.group.shift_date)}`],
    ['Petugas', `${scan.scanned_by.name} (${scan.scanned_by.email})`],
    ['Kondisi', <ConditionBadge condition={scan.condition} />],
    ['Catatan', scan.note || '-'],
    ['Waktu scan (HP)', formatDateTime(scan.scanned_at)],
    ['Diterima server', <Group gap={6}>{formatDateTime(scan.received_at)}{offline && <Badge color="orange" variant="light" leftSection={<IconCloudOff size={12} />}>Dikirim offline</Badge>}</Group>],
    ['Jarak ke titik', formatDistance(scan.distance_meters)],
    ['Validasi lokasi', <YesNoBadge value={scan.is_location_valid} />],
    ['Validasi wajah', <Group gap={6}><YesNoBadge value={scan.is_face_verified} yes="Terverifikasi" no="Tidak terverifikasi" />{scan.face_match_score !== null && <Text size="sm">skor {scan.face_match_score.toFixed(2)}</Text>}</Group>],
  ];

  return (
    <Stack>
      {scan.condition === 'abnormal' && (
        <Alert color="red" variant="light" title="Temuan tidak normal">
          {scan.note || 'Tanpa catatan.'}
        </Alert>
      )}
      <Table withRowBorders={false} verticalSpacing={6}>
        <Table.Tbody>
          {rows.map(([label, value]) => (
            <Table.Tr key={label}>
              <Table.Th w={150} fw={500} c="dimmed" style={{ verticalAlign: 'top' }}>{label}</Table.Th>
              <Table.Td>{value}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <div>
        <Title order={5} mb="xs">Foto ({scan.photos.length})</Title>
        {scan.photos.length === 0 ? (
          <Text size="sm" c="dimmed">Tidak ada foto.</Text>
        ) : (
          <SimpleGrid cols={3} spacing="xs">
            {scan.photos.map((photo, i) => (
              <SecureImage key={photo.id} path={photo.url} alt={`Foto scan ${i + 1}`} h={110} radius="sm" fit="cover" onClick={() => setPhotoIndex(i)} />
            ))}
          </SimpleGrid>
        )}
      </div>

      <div>
        <Title order={5} mb="xs">Lokasi</Title>
        <Text size="xs" c="dimmed" mb={6}>
          Biru (T) = titik patroli dengan radius {radius} m, {scan.is_location_valid ? 'hijau' : 'merah'} (S) = posisi scan.
          {point.isError && ' Posisi titik tidak tersedia (titik mungkin sudah dihapus).'}
        </Text>
        <Suspense fallback={<Skeleton h={300} />}>
          {point.isPending ? (
            <Skeleton h={300} />
          ) : (
            <ScanLocationMap
              point={point.data ? { latitude: point.data.latitude, longitude: point.data.longitude, name: point.data.name } : null}
              scan={{ latitude: scan.latitude, longitude: scan.longitude }}
              radiusMeters={radius}
              locationValid={scan.is_location_valid}
            />
          )}
        </Suspense>
      </div>

      <PhotoLightbox photos={scan.photos} index={photoIndex} onChange={setPhotoIndex} onClose={() => setPhotoIndex(null)} />
    </Stack>
  );
}

export function ScanDetailDrawer({ scanId, onClose }: { scanId: number | null; onClose: () => void }) {
  const query = useQuery({
    queryKey: ['patrol-scans', 'detail', scanId],
    queryFn: () => patrolApi.scan(scanId!),
    enabled: scanId !== null,
  });

  return (
    <Drawer opened={scanId !== null} onClose={onClose} position="right" size="lg" title={<Text fw={700}>Detail Scan</Text>}>
      {query.isPending ? (
        <Stack>
          <Skeleton h={24} />
          <Skeleton h={200} />
          <Skeleton h={300} />
        </Stack>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <ScanDetail scan={query.data} />
      )}
    </Drawer>
  );
}
