import { zodResolver } from '@hookform/resolvers/zod';
import { ActionIcon, Badge, Button, Card, Group, Modal, Stack, Switch, Table, Text, Textarea, TextInput, Tooltip } from '@mantine/core';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { rolesApi } from '@/api/roles';
import { ActiveBadge } from '@/components/Badges';
import { confirmDelete } from '@/components/confirm';
import { PageHeader } from '@/components/PageHeader';
import { PaginationBar } from '@/components/PaginationBar';
import { SearchInput } from '@/components/SearchInput';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/StateViews';
import { usePermission } from '@/hooks/useSession';
import { toPage, useUrlFilters } from '@/hooks/useUrlFilters';
import type { Role } from '@/lib/api/types';
import { applyServerErrors } from '@/lib/formErrors';
import { notifyError, notifySuccess } from '@/lib/notify';

const schema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{2,49}$/, '3–50 karakter: huruf kecil, angka, atau underscore; diawali huruf.'),
  name: z.string().trim().min(1, 'Nama wajib diisi.').max(100, 'Maksimal 100 karakter.'),
  description: z.string().trim().max(255, 'Maksimal 255 karakter.'),
  is_active: z.boolean(),
});
type FormValues = z.infer<typeof schema>;
const FIELDS = ['code', 'name', 'description', 'is_active'] as const;

function RoleForm({ role, onDone }: { role: Role | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { register, control, handleSubmit, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: role
      ? { code: role.code, name: role.name, description: role.description ?? '', is_active: role.is_active }
      : { code: '', name: '', description: '', is_active: true },
  });
  const mutation = useMutation({
    mutationFn: ({ code, ...rest }: FormValues) => (role ? rolesApi.update(role.id, rest) : rolesApi.create({ code, ...rest })),
    onSuccess: () => {
      notifySuccess(role ? 'Role diperbarui.' : 'Role ditambahkan.');
      void queryClient.invalidateQueries({ queryKey: ['roles'] });
      onDone();
    },
    onError: (error) => {
      const rest = applyServerErrors(error, setError, FIELDS, { 'role code': 'code', 'system role': 'is_active' });
      if (rest.length) notifyError(error, rest);
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      <Stack>
        <TextInput
          label="Kode"
          withAsterisk
          disabled={Boolean(role)}
          description={role ? 'Kode role tidak bisa diubah.' : 'Contoh: supervisor_shift. Tidak bisa diubah setelah dibuat.'}
          styles={{ input: { fontFamily: 'monospace' } }}
          {...register('code')}
          error={formState.errors.code?.message}
        />
        <TextInput label="Nama" withAsterisk {...register('name')} error={formState.errors.name?.message} />
        <Textarea label="Deskripsi" autosize minRows={2} {...register('description')} error={formState.errors.description?.message} />
        <Controller
          control={control}
          name="is_active"
          render={({ field, fieldState }) => (
            <Switch
              label="Aktif"
              checked={field.value}
              disabled={role?.is_system}
              description={role?.is_system ? 'Role sistem tidak bisa dinonaktifkan.' : undefined}
              error={fieldState.error?.message}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            Batal
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Simpan
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

const KEYS = ['search', 'page', 'limit'] as const;

export default function RolesPage() {
  const canManage = usePermission('manageRoles');
  const queryClient = useQueryClient();
  const { filters, setFilters } = useUrlFilters(KEYS, { limit: '10' });
  const [editing, setEditing] = useState<Role | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const params = { search: filters.search, page: toPage(filters.page), limit: Number(filters.limit) || 10 };
  const query = useQuery({ queryKey: ['roles', 'list', params], queryFn: () => rolesApi.list(params), placeholderData: keepPreviousData });

  const remove = useMutation({
    mutationFn: (id: number) => rolesApi.remove(id),
    onSuccess: () => {
      notifySuccess('Role dihapus.');
      void queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (error) => notifyError(error),
  });

  const openForm = (role: Role | null) => {
    setEditing(role);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Role"
        description="Role menentukan hak akses pengguna."
        actions={
          canManage && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => openForm(null)}>
              Tambah Role
            </Button>
          )
        }
      />
      <Card withBorder radius="md">
        <Group mb="md">
          <SearchInput value={filters.search} onChange={(search) => setFilters({ search })} placeholder="Cari role" />
        </Group>
        {query.isPending ? (
          <TableSkeleton cols={5} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <EmptyState title="Tidak ada role" />
        ) : (
          <Table.ScrollContainer minWidth={700}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nama</Table.Th>
                  <Table.Th>Kode</Table.Th>
                  <Table.Th>Deskripsi</Table.Th>
                  <Table.Th>Status</Table.Th>
                  {canManage && <Table.Th w={100}>Aksi</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {query.data.items.map((role) => (
                  <Table.Tr key={role.id}>
                    <Table.Td fw={600}>
                      {role.name} {role.is_system && <Badge size="xs" variant="outline" color="gray">Sistem</Badge>}
                    </Table.Td>
                    <Table.Td>
                      <Text ff="monospace" size="sm">{role.code}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed" lineClamp={2}>{role.description || '-'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <ActiveBadge active={role.is_active} />
                    </Table.Td>
                    {canManage && (
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Tooltip label="Ubah">
                            <ActionIcon variant="subtle" aria-label={`Ubah ${role.name}`} onClick={() => openForm(role)}>
                              <IconPencil size={16} />
                            </ActionIcon>
                          </Tooltip>
                          {!role.is_system && (
                            <Tooltip label="Hapus">
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                aria-label={`Hapus ${role.name}`}
                                onClick={() => confirmDelete({ title: 'Hapus role?', name: role.name, onConfirm: () => remove.mutate(role.id) })}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
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
      </Card>
      <Modal opened={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Ubah Role' : 'Tambah Role'} centered>
        {formOpen && <RoleForm role={editing} onDone={() => setFormOpen(false)} />}
      </Modal>
    </>
  );
}
