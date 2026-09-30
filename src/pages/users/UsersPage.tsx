import { ActionIcon, Badge, Button, Card, Group, Modal, Select, Table, Text, Tooltip } from '@mantine/core';
import { IconKey, IconLock, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { rolesApi } from '@/api/roles';
import { usersApi } from '@/api/users';
import { ActiveBadge } from '@/components/Badges';
import { confirmDelete } from '@/components/confirm';
import { PageHeader } from '@/components/PageHeader';
import { PaginationBar } from '@/components/PaginationBar';
import { SearchInput } from '@/components/SearchInput';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/StateViews';
import { UserAvatar } from '@/components/UserAvatar';
import { usePermission, useSession } from '@/hooks/useSession';
import { toNumber, toPage, useUrlFilters } from '@/hooks/useUrlFilters';
import type { User } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import { notifyError, notifySuccess } from '@/lib/notify';
import { SUPER_ADMIN_ROLE } from '@/lib/permissions';
import { ResetPasswordModal, UserForm } from './UserForms';

const KEYS = ['search', 'role_id', 'is_active', 'page', 'limit'] as const;

export default function UsersPage() {
  const { user: me } = useSession();
  const isSuperAdmin = usePermission('manageSuperAdmins');
  const queryClient = useQueryClient();
  const { filters, setFilters } = useUrlFilters(KEYS, { limit: '10' });
  const [formUser, setFormUser] = useState<User | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);

  const params = {
    search: filters.search,
    role_id: toNumber(filters.role_id),
    is_active: filters.is_active === '' ? undefined : filters.is_active === 'true',
    page: toPage(filters.page),
    limit: Number(filters.limit) || 10,
  };
  const query = useQuery({ queryKey: ['users', 'list', params], queryFn: () => usersApi.list(params), placeholderData: keepPreviousData });
  const roles = useQuery({ queryKey: ['roles', 'all'], queryFn: () => rolesApi.list({ limit: 100 }), staleTime: 60_000 });

  const remove = useMutation({
    mutationFn: (id: number) => usersApi.remove(id),
    onSuccess: () => {
      notifySuccess('Pengguna dihapus.');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => notifyError(error),
  });

  const openForm = (user: User | null) => {
    setFormUser(user);
    setFormOpen(true);
  };

  const canTouch = (user: User) => isSuperAdmin || user.role.code !== SUPER_ADMIN_ROLE;
  const roleOptions = (roles.data?.items ?? []).map((r) => ({ value: String(r.id), label: r.name }));

  return (
    <>
      <PageHeader
        title="Pengguna"
        description="Akun petugas dan admin beserta foto wajah untuk validasi."
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={() => openForm(null)} disabled={!roles.data}>
            Tambah Pengguna
          </Button>
        }
      />
      <Card withBorder radius="md">
        <Group mb="md" gap="sm">
          <SearchInput value={filters.search} onChange={(search) => setFilters({ search })} placeholder="Cari nama atau email" />
          <Select
            aria-label="Filter role"
            placeholder="Semua role"
            data={roleOptions}
            value={filters.role_id || null}
            onChange={(v) => setFilters({ role_id: v })}
            clearable
            w={200}
          />
          <Select
            aria-label="Filter status"
            placeholder="Semua status"
            data={[
              { value: 'true', label: 'Aktif' },
              { value: 'false', label: 'Nonaktif' },
            ]}
            value={filters.is_active || null}
            onChange={(v) => setFilters({ is_active: v })}
            clearable
            w={160}
          />
        </Group>
        {query.isPending ? (
          <TableSkeleton cols={7} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <EmptyState title="Tidak ada pengguna" />
        ) : (
          <Table.ScrollContainer minWidth={900}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={56}>Foto</Table.Th>
                  <Table.Th>Nama</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Login terakhir</Table.Th>
                  <Table.Th w={130}>Aksi</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {query.data.items.map((user) => {
                  const isSelf = user.id === me?.id;
                  const editable = canTouch(user);
                  return (
                    <Table.Tr key={user.id}>
                      <Table.Td>
                        <UserAvatar name={user.name} path={user.face_photo_url ? usersApi.facePhotoPath(user.id) : null} version={user.face_photo_updated_at} radius="xl" />
                      </Table.Td>
                      <Table.Td>
                        <Text component="div" size="sm" fw={600}>
                          {user.name} {isSelf && <Badge size="xs" variant="outline">Anda</Badge>}
                        </Text>
                        <Text size="xs" c="dimmed">{user.email}</Text>
                      </Table.Td>
                      <Table.Td>{user.role.name}</Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          <ActiveBadge active={user.is_active} />
                          {user.is_locked && (
                            <Badge color="orange" variant="light" leftSection={<IconLock size={10} />}>
                              Terkunci
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>{formatDateTime(user.last_login_at)}</Table.Td>
                      <Table.Td>
                        {editable ? (
                          <Group gap={4} wrap="nowrap">
                            <Tooltip label="Ubah">
                              <ActionIcon variant="subtle" aria-label={`Ubah ${user.name}`} onClick={() => openForm(user)} disabled={!roles.data}>
                                <IconPencil size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Reset password">
                              <ActionIcon variant="subtle" color="orange" aria-label={`Reset password ${user.name}`} onClick={() => setResetUser(user)}>
                                <IconKey size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label={isSelf ? 'Tidak bisa menghapus akun sendiri' : 'Hapus'}>
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                aria-label={`Hapus ${user.name}`}
                                disabled={isSelf}
                                onClick={() => confirmDelete({ title: 'Hapus pengguna?', name: `${user.name} (${user.email})`, onConfirm: () => remove.mutate(user.id) })}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        ) : (
                          <Text size="xs" c="dimmed">Hanya Super-Admin</Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
        <PaginationBar pagination={query.data?.pagination} onPageChange={(page) => setFilters({ page })} onLimitChange={(limit) => setFilters({ limit })} />
      </Card>

      <Modal opened={formOpen} onClose={() => setFormOpen(false)} title={formUser ? 'Ubah Pengguna' : 'Tambah Pengguna'} size="lg" centered>
        {formOpen && roles.data && me && (
          <UserForm user={formUser} roles={roles.data.items} currentUserId={me.id} isSuperAdmin={isSuperAdmin} onDone={() => setFormOpen(false)} />
        )}
      </Modal>
      <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />
    </>
  );
}
