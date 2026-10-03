import { zodResolver } from '@hookform/resolvers/zod';
import { ActionIcon, Alert, Button, Card, Grid, Group, Modal, NumberInput, Select, Skeleton, Stack, Switch, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconInfoCircle, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { unitsApi, type UnitBody } from '@/api/units';
import { ActiveBadge } from '@/components/Badges';
import { confirmDelete } from '@/components/confirm';
import { LicenseQuota } from '@/components/LicenseQuota';
import { PageHeader } from '@/components/PageHeader';
import { PaginationBar } from '@/components/PaginationBar';
import { SearchInput } from '@/components/SearchInput';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/StateViews';
import { usePermission } from '@/hooks/useSession';
import { useUnitScope } from '@/hooks/useUnitScope';
import { toPage, useUrlFilters } from '@/hooks/useUrlFilters';
import type { Unit } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import { applyServerErrors } from '@/lib/formErrors';
import { notifyError, notifySuccess } from '@/lib/notify';

const LocationPicker = lazy(() => import('@/components/maps/LocationPicker').then((m) => ({ default: m.LocationPicker })));

const coordinate = (min: number, max: number, label: string) =>
  z.number({ error: `${label} wajib diisi.` }).min(min, `${label} minimal ${min}.`).max(max, `${label} maksimal ${max}.`);

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Kode wajib diisi.')
    .max(20, 'Maksimal 20 karakter.')
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(1, 'Nama wajib diisi.').max(150, 'Maksimal 150 karakter.'),
  latitude: coordinate(-90, 90, 'Latitude'),
  longitude: coordinate(-180, 180, 'Longitude'),
  is_active: z.boolean(),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;
const FIELDS = ['code', 'name', 'latitude', 'longitude', 'is_active'] as const;

function UnitForm({ unit, onDone }: { unit: Unit | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { register, control, handleSubmit, setError, setValue, watch, formState } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: unit
      ? { code: unit.code, name: unit.name, latitude: unit.latitude, longitude: unit.longitude, is_active: unit.is_active }
      : { code: '', name: '', latitude: undefined as unknown as number, longitude: undefined as unknown as number, is_active: true },
  });

  const mutation = useMutation({
    mutationFn: (body: UnitBody) => (unit ? unitsApi.update(unit.id, body) : unitsApi.create(body)),
    onSuccess: () => {
      notifySuccess(unit ? 'Unit diperbarui.' : 'Unit ditambahkan beserta 3 shift default.');
      // Unit names and status appear in the picker and in every list.
      void queryClient.invalidateQueries({ queryKey: ['units'] });
      onDone();
    },
    onError: (error) => {
      const rest = applyServerErrors(error, setError, FIELDS, { 'unit code': 'code' });
      if (rest.length) notifyError(error, rest);
    },
  });

  const submit = handleSubmit((values) => {
    // Deactivating signs every user of the unit out, so it is confirmed first.
    if (unit?.is_active && !values.is_active) {
      modals.openConfirmModal({
        title: `Nonaktifkan ${unit.name}?`,
        centered: true,
        children: <Text size="sm">Semua pengguna unit ini akan langsung keluar dan tidak bisa login sampai unit diaktifkan kembali.</Text>,
        labels: { confirm: 'Nonaktifkan', cancel: 'Batal' },
        confirmProps: { color: 'red' },
        onConfirm: () => mutation.mutate(values),
      });
      return;
    }
    mutation.mutate(values);
  });

  const lat = watch('latitude');
  const lng = watch('longitude');
  const setPosition = (la: number, lo: number) => {
    setValue('latitude', la, { shouldValidate: true, shouldDirty: true });
    setValue('longitude', lo, { shouldValidate: true, shouldDirty: true });
  };
  const numberField = (name: 'latitude' | 'longitude', label: string, min: number, max: number) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <NumberInput
          label={label}
          withAsterisk
          decimalScale={7}
          min={min}
          max={max}
          hideControls
          value={field.value ?? ''}
          onChange={(v) => field.onChange(typeof v === 'number' ? v : v === '' ? undefined : Number(v))}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
        />
      )}
    />
  );

  return (
    <form onSubmit={submit} noValidate>
      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack>
            <TextInput
              label="Kode"
              withAsterisk
              description="Maksimal 20 karakter, disimpan dalam huruf besar. Contoh: JKT-01"
              styles={{ input: { fontFamily: 'monospace', textTransform: 'uppercase' } }}
              {...register('code')}
              error={formState.errors.code?.message}
            />
            <TextInput label="Nama" withAsterisk {...register('name')} error={formState.errors.name?.message} />
            <Group grow align="flex-start">
              {numberField('latitude', 'Latitude', -90, 90)}
              {numberField('longitude', 'Longitude', -180, 180)}
            </Group>
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => (
                <Switch
                  label="Aktif"
                  description="Unit nonaktif: semua penggunanya tidak bisa login."
                  checked={field.value}
                  onChange={(e) => field.onChange(e.currentTarget.checked)}
                />
              )}
            />
            {!unit && (
              <Alert variant="light" color="blue" icon={<IconInfoCircle size={18} />}>
                Unit baru otomatis mendapat 3 shift default (08:00–16:00, 16:00–24:00, 00:00–08:00).
              </Alert>
            )}
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Text size="sm" fw={500} mb={6}>Lokasi unit</Text>
          <Suspense fallback={<Skeleton h={340} />}>
            <LocationPicker latitude={typeof lat === 'number' ? lat : null} longitude={typeof lng === 'number' ? lng : null} radiusMeters={0} onChange={setPosition} />
          </Suspense>
          <Text size="xs" c="dimmed" mt={6}>Klik peta atau geser penanda. Dipakai sebagai posisi awal peta untuk titik patroli baru di unit ini.</Text>
        </Grid.Col>
      </Grid>
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={onDone}>Batal</Button>
        <Button type="submit" loading={mutation.isPending}>Simpan</Button>
      </Group>
    </form>
  );
}

const KEYS = ['search', 'is_active', 'page', 'limit'] as const;

export default function UnitsPage() {
  const canManage = usePermission('manageUnits');
  const { setUnitId } = useUnitScope();
  const queryClient = useQueryClient();
  const { filters, setFilters } = useUrlFilters(KEYS, { limit: '10' });
  const [editing, setEditing] = useState<Unit | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const params = {
    search: filters.search,
    is_active: filters.is_active === '' ? undefined : filters.is_active === 'true',
    page: toPage(filters.page),
    limit: Number(filters.limit) || 10,
  };
  const query = useQuery({ queryKey: ['units', 'list', params], queryFn: () => unitsApi.list(params), placeholderData: keepPreviousData });

  const remove = useMutation({
    mutationFn: (id: number) => unitsApi.remove(id),
    onSuccess: () => {
      notifySuccess('Unit dihapus.');
      void queryClient.invalidateQueries({ queryKey: ['units'] });
    },
    // 409 "unit still has users or patrol points": the message suggests deactivating instead.
    onError: (error) => notifyError(error),
  });

  const openForm = (unit: Unit | null) => {
    setEditing(unit);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Unit"
        description="Master data unit. Setiap unit punya titik patroli, shift, pengguna, dan pengaturannya sendiri."
        actions={
          <>
            <LicenseQuota kind="units" />
            {canManage && <Button leftSection={<IconPlus size={16} />} onClick={() => openForm(null)}>Tambah Unit</Button>}
          </>
        }
      />
      <Card withBorder radius="md">
        <Group mb="md" gap="sm">
          <SearchInput value={filters.search} onChange={(search) => setFilters({ search })} placeholder="Cari kode atau nama unit" />
          <Select
            aria-label="Filter status"
            placeholder="Semua status"
            data={[{ value: 'true', label: 'Aktif' }, { value: 'false', label: 'Nonaktif' }]}
            value={filters.is_active || null}
            onChange={(v) => setFilters({ is_active: v })}
            clearable
            w={160}
          />
        </Group>
        {query.isPending ? (
          <TableSkeleton cols={6} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <EmptyState title="Tidak ada unit" />
        ) : (
          <Table.ScrollContainer minWidth={760}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Kode</Table.Th>
                  <Table.Th>Nama</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Pengguna</Table.Th>
                  <Table.Th>Titik patroli</Table.Th>
                  <Table.Th>Diperbarui</Table.Th>
                  <Table.Th w={140} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {query.data.items.map((unit) => (
                  <Table.Tr key={unit.id}>
                    <Table.Td><Text ff="monospace" size="sm">{unit.code}</Text></Table.Td>
                    <Table.Td fw={600}>{unit.name}</Table.Td>
                    <Table.Td><ActiveBadge active={unit.is_active} /></Table.Td>
                    <Table.Td>{unit.users_count}</Table.Td>
                    <Table.Td>{unit.patrol_points_count}</Table.Td>
                    <Table.Td>{formatDateTime(unit.updated_at)}</Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap" justify="flex-end">
                        <Button size="compact-xs" variant="subtle" onClick={() => setUnitId(unit.id)}>Pilih</Button>
                        {canManage && (
                          <>
                            <Tooltip label="Ubah">
                              <ActionIcon variant="subtle" aria-label={`Ubah ${unit.name}`} onClick={() => openForm(unit)}>
                                <IconPencil size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label={unit.users_count || unit.patrol_points_count ? 'Unit masih berisi data; nonaktifkan saja' : 'Hapus'}>
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                aria-label={`Hapus ${unit.name}`}
                                onClick={() => confirmDelete({ title: 'Hapus unit?', name: `${unit.name} (${unit.code})`, onConfirm: () => remove.mutate(unit.id) })}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
        <PaginationBar pagination={query.data?.pagination} onPageChange={(page) => setFilters({ page })} onLimitChange={(limit) => setFilters({ limit })} />
      </Card>
      <Modal opened={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Ubah Unit' : 'Tambah Unit'} size="xl" centered>
        {formOpen && <UnitForm unit={editing} onDone={() => setFormOpen(false)} />}
      </Modal>
    </>
  );
}
