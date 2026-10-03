import { zodResolver } from '@hookform/resolvers/zod';
import { ActionIcon, Anchor, Button, Card, Group, Modal, Stack, Table, Text, Textarea, TextInput, Tooltip } from '@mantine/core';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { patrolAreasApi, type PatrolAreaBody } from '@/api/patrolAreas';
import { confirmDelete } from '@/components/confirm';
import { PageHeader } from '@/components/PageHeader';
import { PaginationBar } from '@/components/PaginationBar';
import { SearchInput } from '@/components/SearchInput';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/StateViews';
import { usePermission } from '@/hooks/useSession';
import { useUnitScope } from '@/hooks/useUnitScope';
import { toPage, useUrlFilters } from '@/hooks/useUrlFilters';
import { isApiError } from '@/lib/api/errors';
import type { PatrolArea } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import { applyServerErrors } from '@/lib/formErrors';
import { notifyError, notifySuccess } from '@/lib/notify';

const schema = z.object({
  name: z.string().trim().min(1, 'Nama area wajib diisi.').max(100, 'Maksimal 100 karakter.'),
  description: z.string().trim().max(255, 'Maksimal 255 karakter.'),
});
type FormValues = z.infer<typeof schema>;

function AreaForm({ area, onDone }: { area: PatrolArea | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: area?.name ?? '', description: area?.description ?? '' },
  });
  const mutation = useMutation({
    mutationFn: (body: PatrolAreaBody) => (area ? patrolAreasApi.update(area.id, body) : patrolAreasApi.create(body)),
    onSuccess: () => {
      notifySuccess(area ? 'Area diperbarui.' : 'Area ditambahkan.');
      void queryClient.invalidateQueries({ queryKey: ['patrol-areas'] });
      // Point lists show the area name.
      void queryClient.invalidateQueries({ queryKey: ['patrol-points'] });
      onDone();
    },
    onError: (error) => {
      const rest = applyServerErrors(error, setError, ['name', 'description'], { 'area with this name': 'name' });
      if (rest.length) notifyError(error, rest);
    },
  });
  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      <Stack>
        <TextInput label="Nama area" withAsterisk description="Mis. Gedung A, Lantai 2, Parkir Basement. Unik dalam unit." {...register('name')} error={formState.errors.name?.message} />
        <Textarea label="Deskripsi" autosize minRows={2} {...register('description')} error={formState.errors.description?.message} />
        {area && <Text size="xs" c="dimmed">Riwayat patroli tetap memakai nama area saat shift berjalan.</Text>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>Batal</Button>
          <Button type="submit" loading={mutation.isPending}>Simpan</Button>
        </Group>
      </Stack>
    </form>
  );
}

const KEYS = ['search', 'page', 'limit'] as const;

export default function AreasPage() {
  const canManage = usePermission('manageAreas');
  const { unitId, showUnitColumn, unitName } = useUnitScope();
  const queryClient = useQueryClient();
  const { filters, setFilters } = useUrlFilters(KEYS, { limit: '20' });
  const [editing, setEditing] = useState<PatrolArea | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const params = { unit_id: unitId, search: filters.search, page: toPage(filters.page), limit: Number(filters.limit) || 20 };
  const query = useQuery({ queryKey: ['patrol-areas', 'list', params], queryFn: () => patrolAreasApi.list(params), placeholderData: keepPreviousData });

  const remove = useMutation({
    mutationFn: (id: number) => patrolAreasApi.remove(id),
    onSuccess: () => {
      notifySuccess('Area dihapus.');
      void queryClient.invalidateQueries({ queryKey: ['patrol-areas'] });
    },
    // 409 "area still has patrol points": the row already links to those points.
    onError: (error) => notifyError(error),
  });

  const openForm = (area: PatrolArea | null) => {
    setEditing(area);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Area"
        description="Kelompok titik patroli dalam satu unit, misalnya gedung, lantai, atau parkir."
        actions={canManage && <Button leftSection={<IconPlus size={16} />} onClick={() => openForm(null)}>Tambah Area</Button>}
      />
      <Card withBorder radius="md">
        <Group mb="md">
          <SearchInput value={filters.search} onChange={(search) => setFilters({ search })} placeholder="Cari area" />
        </Group>
        {query.isPending ? (
          <TableSkeleton cols={5} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <EmptyState
            title={filters.search ? 'Tidak ada area yang cocok' : 'Belum ada area'}
            description={canManage ? 'Buat area lalu pilih area di form titik patroli.' : undefined}
            action={canManage && !filters.search ? <Button size="xs" onClick={() => openForm(null)}>Tambah Area</Button> : undefined}
          />
        ) : (
          <Table.ScrollContainer minWidth={640}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  {showUnitColumn && <Table.Th>Unit</Table.Th>}
                  <Table.Th>Nama</Table.Th>
                  <Table.Th>Deskripsi</Table.Th>
                  <Table.Th>Titik patroli</Table.Th>
                  <Table.Th>Diperbarui</Table.Th>
                  {canManage && <Table.Th w={100}>Aksi</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {query.data.items.map((area) => (
                  <Table.Tr key={area.id}>
                    {showUnitColumn && <Table.Td>{unitName(area.unit_id)}</Table.Td>}
                    <Table.Td fw={600}>{area.name}</Table.Td>
                    <Table.Td><Text size="sm" c="dimmed" lineClamp={2}>{area.description || '-'}</Text></Table.Td>
                    <Table.Td>
                      <Anchor component={Link} to={`/patrol-points?area_id=${area.id}`} size="sm">
                        {area.patrol_points_count} titik
                      </Anchor>
                    </Table.Td>
                    <Table.Td>{formatDateTime(area.updated_at)}</Table.Td>
                    {canManage && (
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Tooltip label="Ubah">
                            <ActionIcon variant="subtle" aria-label={`Ubah ${area.name}`} onClick={() => openForm(area)}>
                              <IconPencil size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={area.patrol_points_count ? 'Pindahkan titiknya dulu' : 'Hapus'}>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              aria-label={`Hapus ${area.name}`}
                              disabled={area.patrol_points_count > 0}
                              onClick={() => confirmDelete({ title: 'Hapus area?', name: area.name, onConfirm: () => remove.mutate(area.id) })}
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
        <PaginationBar pagination={query.data?.pagination} onPageChange={(page) => setFilters({ page })} onLimitChange={(limit) => setFilters({ limit })} />
        {remove.isError && isApiError(remove.error) && remove.error.kind === 'conflict' && (
          <Text size="xs" c="dimmed" mt="xs">Buka jumlah titik pada area tersebut untuk memindahkan titiknya ke area lain.</Text>
        )}
      </Card>
      <Modal opened={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Ubah Area' : 'Tambah Area'} centered>
        {formOpen && <AreaForm area={editing} onDone={() => setFormOpen(false)} />}
      </Modal>
    </>
  );
}
