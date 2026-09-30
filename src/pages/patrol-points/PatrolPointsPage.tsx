import { ActionIcon, Badge, Button, Card, Group, Table, Text, Tooltip } from '@mantine/core';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { patrolPointsApi } from '@/api/patrolPoints';
import { confirmDelete } from '@/components/confirm';
import { PageHeader } from '@/components/PageHeader';
import { PaginationBar } from '@/components/PaginationBar';
import { SearchInput } from '@/components/SearchInput';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/StateViews';
import { usePermission } from '@/hooks/useSession';
import { toPage, useUrlFilters } from '@/hooks/useUrlFilters';
import type { PatrolPoint } from '@/lib/api/types';
import { notifyError, notifySuccess } from '@/lib/notify';
import { PatrolPointFormModal } from './PatrolPointForm';

const KEYS = ['search', 'page', 'limit'] as const;

export default function PatrolPointsPage() {
  const canManage = usePermission('managePatrolPoints');
  const queryClient = useQueryClient();
  const { filters, setFilters } = useUrlFilters(KEYS, { limit: '10' });
  const [editing, setEditing] = useState<PatrolPoint | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const params = { search: filters.search, page: toPage(filters.page), limit: Number(filters.limit) || 10 };
  const query = useQuery({
    queryKey: ['patrol-points', 'list', params],
    queryFn: () => patrolPointsApi.list(params),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (id: number) => patrolPointsApi.remove(id),
    onSuccess: () => {
      notifySuccess('Titik patroli dihapus.');
      void queryClient.invalidateQueries({ queryKey: ['patrol-points'] });
    },
    onError: (error) => notifyError(error),
  });

  const openForm = (point: PatrolPoint | null) => {
    setEditing(point);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Titik Patroli"
        description="Titik yang dipindai petugas melalui tag NFC."
        actions={
          canManage && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => openForm(null)}>
              Tambah Titik
            </Button>
          )
        }
      />
      <Card withBorder radius="md">
        <Group mb="md">
          <SearchInput value={filters.search} onChange={(search) => setFilters({ search })} placeholder="Cari nama, lokasi, atau kode NFC" w={340} />
        </Group>
        {query.isPending ? (
          <TableSkeleton cols={6} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <EmptyState
            title={filters.search ? 'Tidak ada titik yang cocok' : 'Belum ada titik patroli'}
            action={canManage && !filters.search ? <Button size="xs" onClick={() => openForm(null)}>Tambah Titik</Button> : undefined}
          />
        ) : (
          <Table.ScrollContainer minWidth={820}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nama</Table.Th>
                  <Table.Th>Lokasi</Table.Th>
                  <Table.Th>Kode NFC</Table.Th>
                  <Table.Th>Koordinat</Table.Th>
                  <Table.Th>Validasi</Table.Th>
                  {canManage && <Table.Th w={100}>Aksi</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {query.data.items.map((point) => (
                  <Table.Tr key={point.id}>
                    <Table.Td fw={600}>{point.name}</Table.Td>
                    <Table.Td>{point.location}</Table.Td>
                    <Table.Td>
                      <Text ff="monospace" size="sm">{point.nfc_code}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" ff="monospace">
                        {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {point.is_location_match_required && <Badge variant="light" size="sm">Lokasi</Badge>}
                        {point.is_face_validation_required && <Badge variant="light" color="grape" size="sm">Wajah</Badge>}
                        {!point.is_location_match_required && !point.is_face_validation_required && <Text size="sm" c="dimmed">-</Text>}
                      </Group>
                    </Table.Td>
                    {canManage && (
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Tooltip label="Ubah">
                            <ActionIcon variant="subtle" aria-label={`Ubah ${point.name}`} onClick={() => openForm(point)}>
                              <IconPencil size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Hapus">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              aria-label={`Hapus ${point.name}`}
                              onClick={() => confirmDelete({ title: 'Hapus titik patroli?', name: point.name, onConfirm: () => remove.mutate(point.id) })}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
        <PaginationBar
          pagination={query.data?.pagination}
          onPageChange={(page) => setFilters({ page })}
          onLimitChange={(limit) => setFilters({ limit })}
        />
      </Card>
      <PatrolPointFormModal opened={formOpen} point={editing} onClose={() => setFormOpen(false)} />
    </>
  );
}
