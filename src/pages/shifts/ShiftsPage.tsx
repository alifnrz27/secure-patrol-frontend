import { zodResolver } from '@hookform/resolvers/zod';
import { ActionIcon, Alert, Button, Card, Group, List, Modal, Stack, Switch, Table, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { IconInfoCircle, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { patrolShiftsApi, type PatrolShiftBody } from '@/api/patrolShifts';
import { ActiveBadge } from '@/components/Badges';
import { confirmDelete } from '@/components/confirm';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/StateViews';
import { usePermission } from '@/hooks/useSession';
import { useUnitScope } from '@/hooks/useUnitScope';
import type { PatrolShift } from '@/lib/api/types';
import { formatDuration } from '@/lib/format';
import { applyServerErrors } from '@/lib/formErrors';
import { notifyError, notifySuccess } from '@/lib/notify';
import { ShiftTimeline } from './ShiftTimeline';

const START = /^([01]\d|2[0-3]):[0-5]\d$/;
const END = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;

const schema = z
  .object({
    name: z.string().trim().min(1, 'Nama wajib diisi.').max(100, 'Maksimal 100 karakter.'),
    start_time: z.string().trim().regex(START, 'Format HH:MM, 00:00–23:59.'),
    end_time: z.string().trim().regex(END, 'Format HH:MM, 00:00–24:00.'),
    is_active: z.boolean(),
  })
  .refine((v) => v.start_time !== v.end_time, { path: ['end_time'], message: 'Jam akhir tidak boleh sama dengan jam mulai.' });

type FormValues = z.infer<typeof schema>;
const FIELDS = ['name', 'start_time', 'end_time', 'is_active'] as const;

function ShiftForm({ shift, others, onDone }: { shift: PatrolShift | null; others: PatrolShift[]; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { register, control, handleSubmit, setError, watch, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: shift
      ? { name: shift.name, start_time: shift.start_time, end_time: shift.end_time, is_active: shift.is_active }
      : { name: '', start_time: '', end_time: '', is_active: true },
  });

  const mutation = useMutation({
    mutationFn: (body: PatrolShiftBody) => (shift ? patrolShiftsApi.update(shift.id, body) : patrolShiftsApi.create(body)),
    onSuccess: () => {
      notifySuccess(shift ? 'Shift diperbarui.' : 'Shift ditambahkan.');
      void queryClient.invalidateQueries({ queryKey: ['patrol-shifts'] });
      onDone();
    },
    onError: (error) => {
      // 409 "patrol shift overlaps with another active shift: ..." goes on the start time.
      const rest = applyServerErrors(error, setError, FIELDS, { overlaps: 'start_time' });
      if (rest.length) notifyError(error, rest);
    },
  });

  const draft = watch();
  const preview = [
    ...others.filter((s) => s.is_active && s.id !== shift?.id),
    ...(draft.is_active ? [{ id: 'draft' as const, name: draft.name, start_time: draft.start_time, end_time: draft.end_time }] : []),
  ];

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      noValidate
    >
      <Stack>
        <TextInput label="Nama shift" withAsterisk {...register('name')} error={formState.errors.name?.message} />
        <Group grow align="flex-start">
          <TextInput label="Jam mulai" placeholder="08:00" withAsterisk inputMode="numeric" {...register('start_time')} error={formState.errors.start_time?.message} />
          <TextInput
            label="Jam akhir (cut-off)"
            placeholder="16:00"
            description="Boleh 24:00"
            withAsterisk
            inputMode="numeric"
            {...register('end_time')}
            error={formState.errors.end_time?.message}
          />
        </Group>
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => <Switch label="Aktif" checked={field.value} onChange={(e) => field.onChange(e.currentTarget.checked)} />}
        />
        <Alert variant="light" color="blue" icon={<IconInfoCircle size={18} />}>
          Jam akhir yang lebih kecil dari jam mulai berarti shift melewati tengah malam (mis. 22:00–06:00). Scan tepat di jam akhir masuk ke
          shift berikutnya. Perubahan hanya berlaku untuk shift berikutnya.
        </Alert>
        <div>
          <Text size="sm" fw={500} mb={6}>
            Pratinjau shift aktif
          </Text>
          <ShiftTimeline shifts={preview} />
        </div>
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

export default function ShiftsPage() {
  const canManage = usePermission('manageShifts');
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<PatrolShift | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const { unitId, showUnitColumn, unitName } = useUnitScope();
  const query = useQuery({ queryKey: ['patrol-shifts', unitId ?? 'all'], queryFn: () => patrolShiftsApi.list(unitId) });

  const remove = useMutation({
    mutationFn: (id: number) => patrolShiftsApi.remove(id),
    onSuccess: () => {
      notifySuccess('Shift dihapus.');
      void queryClient.invalidateQueries({ queryKey: ['patrol-shifts'] });
    },
    onError: (error) => notifyError(error),
  });

  const openForm = (shift: PatrolShift | null) => {
    setEditing(shift);
    setFormOpen(true);
  };

  const shifts = query.data ?? [];
  const active = shifts.filter((s) => s.is_active);
  // Overlaps are checked per unit, so each unit gets its own timeline.
  const activeByUnit = [...new Set(active.map((s) => s.unit_id))].map((id) => ({ id, shifts: active.filter((s) => s.unit_id === id) }));

  return (
    <>
      <PageHeader
        title="Pengaturan Shift"
        description="Jam mulai dan batas akhir (cut-off) setiap shift patroli."
        actions={
          canManage && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => openForm(null)}>
              Tambah Shift
            </Button>
          )
        }
      />
      <Stack>
        <Card withBorder radius="md">
          <Title order={4} mb="sm">
            Timeline 24 jam (shift aktif)
          </Title>
          {query.isPending ? (
            <TableSkeleton rows={3} cols={1} />
          ) : !active.length ? (
            <Text c="dimmed" size="sm">Tidak ada shift aktif.</Text>
          ) : showUnitColumn ? (
            <Stack gap="lg">
              {activeByUnit.map((unit) => (
                <div key={unit.id}>
                  <Text size="sm" fw={600} mb={4}>{unitName(unit.id)}</Text>
                  <ShiftTimeline shifts={unit.shifts} />
                </div>
              ))}
            </Stack>
          ) : (
            <ShiftTimeline shifts={active} />
          )}
          <List size="xs" c="dimmed" mt="sm" spacing={2}>
            <List.Item>Jam akhir adalah batas (cut-off): scan tepat di jam akhir masuk ke shift berikutnya.</List.Item>
            <List.Item>Perubahan jam hanya berlaku untuk shift berikutnya; group yang sudah dibuat tetap memakai jam lamanya.</List.Item>
          </List>
        </Card>
        <Card withBorder radius="md">
          {query.isPending ? (
            <TableSkeleton cols={5} rows={3} />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : shifts.length === 0 ? (
            <EmptyState title="Belum ada shift" />
          ) : (
            <Table.ScrollContainer minWidth={600}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    {showUnitColumn && <Table.Th>Unit</Table.Th>}
                    <Table.Th>Nama</Table.Th>
                    <Table.Th>Jam</Table.Th>
                    <Table.Th>Durasi</Table.Th>
                    <Table.Th>Status</Table.Th>
                    {canManage && <Table.Th w={100}>Aksi</Table.Th>}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {shifts.map((shift) => (
                    <Table.Tr key={shift.id}>
                      {showUnitColumn && <Table.Td>{unitName(shift.unit_id)}</Table.Td>}
                      <Table.Td fw={600}>{shift.name}</Table.Td>
                      <Table.Td>
                        {shift.start_time} – {shift.end_time}
                        {shift.crosses_midnight && (
                          <Text span size="xs" c="dimmed">
                            {' '}
                            (melewati tengah malam)
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>{formatDuration(shift.duration_minutes)}</Table.Td>
                      <Table.Td>
                        <ActiveBadge active={shift.is_active} />
                      </Table.Td>
                      {canManage && (
                        <Table.Td>
                          <Group gap={4} wrap="nowrap">
                            <Tooltip label="Ubah">
                              <ActionIcon variant="subtle" aria-label={`Ubah ${shift.name}`} onClick={() => openForm(shift)}>
                                <IconPencil size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Hapus">
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                aria-label={`Hapus ${shift.name}`}
                                onClick={() => confirmDelete({ title: 'Hapus shift?', name: shift.name, onConfirm: () => remove.mutate(shift.id) })}
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
        </Card>
      </Stack>
      <Modal opened={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Ubah Shift' : 'Tambah Shift'} size="lg" centered>
        {formOpen && <ShiftForm shift={editing} others={shifts} onDone={() => setFormOpen(false)} />}
      </Modal>
    </>
  );
}
