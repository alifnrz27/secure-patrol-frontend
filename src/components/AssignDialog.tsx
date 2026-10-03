import { Alert, Button, Group, Modal, MultiSelect, Stack, Text } from '@mantine/core';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { patrolApi } from '@/api/patrol';
import { settingsApi } from '@/api/settings';
import { usersApi } from '@/api/users';
import { describeError } from '@/lib/api/errors';
import type { PatrolListItem } from '@/lib/api/types';
import { notifySuccess } from '@/lib/notify';

/** Roles the server accepts as assignees. */
const ASSIGNABLE_ROLES = ['security_admin', 'security_team'];

/** Whether point assignment is switched on for the user's own unit (setting patrol_point_assignment). */
export function useAssignmentEnabled(enabled = true) {
  return useQuery({
    queryKey: ['settings', 'own'],
    queryFn: () => settingsApi.list(),
    enabled,
    staleTime: 60_000,
    select: (settings) => settings.find((s) => s.key === 'patrol_point_assignment')?.value === true,
  });
}

/** Assign one or more officers to a point of the running shift (PUT /patrol-list-items/{id}/assignees). */
export function AssignDialog({ item, onClose }: { item: PatrolListItem | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const settingOn = useAssignmentEnabled(item !== null);
  // Unit managers only receive the users of their own unit.
  const users = useQuery({
    queryKey: ['users', 'assignable'],
    queryFn: () => usersApi.list({ limit: 100, is_active: true }),
    enabled: item !== null,
    staleTime: 60_000,
    select: (page) => page.items.filter((u) => ASSIGNABLE_ROLES.includes(u.role.code)),
  });

  useEffect(() => {
    if (!item) return;
    setSelected(item.assignees.map((a) => String(a.id)));
    setError(null);
  }, [item]);

  const save = useMutation({
    mutationFn: (userIds: number[]) => patrolApi.setAssignees(item!.id, userIds),
    onSuccess: (_updated, userIds) => {
      notifySuccess(userIds.length ? 'Petugas ditugaskan.' : 'Penugasan dihapus.');
      void queryClient.invalidateQueries({ queryKey: ['patrol-groups'] });
      void queryClient.invalidateQueries({ queryKey: ['patrol-list-items'] });
      void queryClient.invalidateQueries({ queryKey: ['recap'] });
      onClose();
    },
    onError: (e) => setError(describeError(e)),
  });

  // Keep current assignees selectable even if they are no longer in the list (e.g. deactivated).
  const options = [
    ...(users.data ?? []).map((u) => ({ value: String(u.id), label: `${u.name} — ${u.role.name}` })),
    ...(item?.assignees ?? [])
      .filter((a) => !(users.data ?? []).some((u) => u.id === a.id))
      .map((a) => ({ value: String(a.id), label: a.name })),
  ];

  return (
    <Modal opened={item !== null} onClose={onClose} title={item ? `Tugaskan petugas — ${item.name}` : ''} centered>
      <Stack>
        <MultiSelect
          label="Petugas"
          placeholder={selected.length ? undefined : 'Tanpa petugas (semua petugas)'}
          description="Admin Keamanan atau Tim Keamanan aktif di unit ini. Bisa lebih dari satu."
          data={options}
          value={selected}
          onChange={setSelected}
          searchable
          clearable
          nothingFoundMessage={users.isPending ? 'Memuat…' : 'Tidak ada petugas'}
          disabled={save.isPending}
        />
        <Alert variant="light" color="blue" icon={<IconInfoCircle size={18} />}>
          Titik tanpa petugas terlihat oleh semua petugas. Penugasan hanya berlaku untuk shift ini.
        </Alert>
        {settingOn.data === false && (
          <Alert variant="light" color="orange" icon={<IconAlertTriangle size={18} />}>
            Penugasan bisa diisi, tetapi belum berlaku di aplikasi mobile karena setting{' '}
            <Text span fw={600} size="sm">Penugasan titik per petugas</Text> masih OFF. Nyalakan di{' '}
            <Link to="/settings">Pengaturan Sistem</Link>.
          </Alert>
        )}
        {error && (
          <Alert color="red" icon={<IconAlertTriangle size={18} />} role="alert">
            {error}
          </Alert>
        )}
        <Group justify="space-between">
          <Button variant="subtle" color="red" disabled={!item?.assignees.length || save.isPending} onClick={() => save.mutate([])}>
            Hapus penugasan
          </Button>
          <Group gap="xs">
            <Button variant="default" onClick={onClose}>Batal</Button>
            <Button loading={save.isPending} onClick={() => save.mutate(selected.map(Number))}>Simpan</Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
