import { zodResolver } from '@hookform/resolvers/zod';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Code,
  
  Group,
  Menu,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { IconAlertTriangle, IconCheck, IconCopy, IconDots, IconKey, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { appClientsApi } from '@/api/appClients';
import { env } from '@/config/env';
import { ActiveBadge } from '@/components/Badges';
import { confirmDelete } from '@/components/confirm';
import { LicenseQuota } from '@/components/LicenseQuota';
import { CopyAction } from '@/components/CopyAction';
import { PageHeader } from '@/components/PageHeader';
import { PaginationBar } from '@/components/PaginationBar';
import { SearchInput } from '@/components/SearchInput';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/StateViews';
import { toPage, useUrlFilters } from '@/hooks/useUrlFilters';
import type { AppClient, AppClientCredential, Platform } from '@/lib/api/types';
import { dayjs, formatDateTime } from '@/lib/format';
import { applyServerErrors } from '@/lib/formErrors';
import { notifyError, notifySuccess } from '@/lib/notify';

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'web', label: 'Web' },
  { value: 'android', label: 'Android' },
  { value: 'ios', label: 'iOS' },
  { value: 'server', label: 'Server' },
];

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text size="sm" fw={500} mb={4}>{label}</Text>
      <Group gap="xs" wrap="nowrap">
        <Code block style={{ flex: 1, wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{value}</Code>
        <CopyAction value={value}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Tersalin' : 'Salin'}>
              <ActionIcon variant="light" color={copied ? 'teal' : 'blue'} onClick={copy} aria-label={`Salin ${label}`}>
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyAction>
      </Group>
    </div>
  );
}

/** Shows the App Key once; cannot be closed until the user confirms it was saved. */
function CredentialModal({ credential, onClose }: { credential: AppClientCredential | null; onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  const close = () => {
    setSaved(false);
    onClose();
  };
  return (
    <Modal
      opened={credential !== null}
      onClose={() => saved && close()}
      title="App Key baru"
      centered
      size="lg"
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
    >
      {credential && (
        <Stack>
          <Alert color="orange" icon={<IconAlertTriangle size={18} />}>
            App Key hanya ditampilkan <b>sekali</b>. Simpan sekarang di tempat yang aman; setelah jendela ini ditutup, App Key tidak bisa dilihat lagi.
          </Alert>
          <CopyField label="App ID" value={credential.app_id} />
          <CopyField label="App Key" value={credential.app_key} />
          <Checkbox label="Saya sudah menyimpan App Key" checked={saved} onChange={(e) => setSaved(e.currentTarget.checked)} />
          <Group justify="flex-end">
            <Button onClick={close} disabled={!saved}>
              Tutup
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

const formSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi.').max(100, 'Maksimal 100 karakter.'),
  platform: z.enum(['android', 'ios', 'web', 'server']),
  description: z.string().trim().max(255, 'Maksimal 255 karakter.'),
  is_active: z.boolean(),
  expires_at: z.date().nullable(),
});
type FormValues = z.infer<typeof formSchema>;
const FIELDS = ['name', 'platform', 'description', 'is_active', 'expires_at'] as const;

function AppClientForm({ client, onCreated, onDone }: { client: AppClient | null; onCreated: (c: AppClientCredential) => void; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const isCurrent = client?.app_id === env.appId;
  const { register, control, handleSubmit, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: client?.name ?? '',
      platform: client?.platform ?? 'android',
      description: client?.description ?? '',
      is_active: client?.is_active ?? true,
      expires_at: client?.expires_at ? new Date(client.expires_at) : null,
    },
  });

  // Called directly (not through useMutation) so the one-time App Key never
  // lands in the query/mutation cache.
  const submit = handleSubmit(async (values) => {
    setSubmitting(true);
    const expires_at = values.expires_at ? dayjs(values.expires_at).format() : null;
    try {
      if (client) {
        await appClientsApi.update(client.id, { name: values.name, description: values.description, is_active: values.is_active, expires_at });
        notifySuccess('App Client diperbarui.');
      } else {
        const credential = await appClientsApi.create({ name: values.name, platform: values.platform, description: values.description, expires_at });
        onCreated(credential);
      }
      void queryClient.invalidateQueries({ queryKey: ['app-clients'] });
      onDone();
    } catch (error) {
      const rest = applyServerErrors(error, setError, FIELDS);
      if (rest.length) notifyError(error, rest);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <Stack>
        <TextInput label="Nama" withAsterisk {...register('name')} error={formState.errors.name?.message} />
        <Controller
          control={control}
          name="platform"
          render={({ field }) => (
            <Select
              label="Platform"
              withAsterisk
              data={PLATFORMS}
              value={field.value}
              onChange={(v) => v && field.onChange(v)}
              disabled={Boolean(client)}
              description={client ? 'Platform tidak bisa diubah.' : 'Fitur manajemen hanya bisa diakses dari platform web; scan hanya dari android/ios.'}
              allowDeselect={false}
            />
          )}
        />
        <Textarea label="Deskripsi" autosize minRows={2} {...register('description')} error={formState.errors.description?.message} />
        <Controller
          control={control}
          name="expires_at"
          render={({ field, fieldState }) => (
            <DateTimePicker
              label="Masa berlaku sampai"
              description="Kosong = tidak kedaluwarsa"
              placeholder="Tanpa batas"
              valueFormat="DD MMM YYYY HH:mm"
              clearable
              minDate={new Date()}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
        {client && (
          <Controller
            control={control}
            name="is_active"
            render={({ field }) => (
              <Switch
                label="Aktif"
                checked={field.value}
                disabled={isCurrent}
                description={isCurrent ? 'App Client ini sedang dipakai web admin dan tidak bisa dinonaktifkan.' : undefined}
                onChange={(e) => field.onChange(e.currentTarget.checked)}
              />
            )}
          />
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            Batal
          </Button>
          <Button type="submit" loading={submitting}>
            {client ? 'Simpan' : 'Buat App Client'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

function RotateForm({ client, onRotated, onDone }: { client: AppClient; onRotated: (c: AppClientCredential) => void; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [hours, setHours] = useState<number>(24);
  const [submitting, setSubmitting] = useState(false);
  const isCurrent = client.app_id === env.appId;
  const valid = Number.isInteger(hours) && hours >= 0 && hours <= 168;

  const rotate = async () => {
    setSubmitting(true);
    try {
      const credential = await appClientsApi.rotateKey(client.id, hours);
      void queryClient.invalidateQueries({ queryKey: ['app-clients'] });
      onRotated(credential);
      onDone();
    } catch (error) {
      notifyError(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack>
      <Text size="sm">
        Membuat App Key baru untuk <b>{client.name}</b>. Selama masa tenggang, key lama masih diterima agar aplikasi versi lama tetap berjalan.
        Isi <b>0</b> untuk langsung mematikan key lama (misalnya jika key bocor).
      </Text>
      <NumberInput
        label="Masa tenggang (jam)"
        min={0}
        max={168}
        allowDecimal={false}
        value={hours}
        onChange={(v) => setHours(typeof v === 'number' ? v : Number(v))}
        error={!valid ? 'Isi 0 sampai 168 jam.' : undefined}
      />
      {isCurrent && (
        <Alert color="red" icon={<IconAlertTriangle size={18} />}>
          App Client ini dipakai web admin. Setelah rotasi, perbarui VITE_APP_KEY dan deploy ulang sebelum masa tenggang habis
          {hours === 0 ? '. Dengan masa tenggang 0, web admin langsung tidak bisa dipakai.' : '.'}
        </Alert>
      )}
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Batal
        </Button>
        <Button color="orange" onClick={() => void rotate()} loading={submitting} disabled={!valid}>
          Rotasi key
        </Button>
      </Group>
    </Stack>
  );
}

const KEYS = ['search', 'page', 'limit'] as const;

export default function AppClientsPage() {
  const queryClient = useQueryClient();
  const { filters, setFilters } = useUrlFilters(KEYS, { limit: '10' });
  const [formClient, setFormClient] = useState<AppClient | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [rotating, setRotating] = useState<AppClient | null>(null);
  const [credential, setCredential] = useState<AppClientCredential | null>(null);

  const params = { search: filters.search, page: toPage(filters.page), limit: Number(filters.limit) || 10 };
  const query = useQuery({ queryKey: ['app-clients', 'list', params], queryFn: () => appClientsApi.list(params), placeholderData: keepPreviousData });

  const remove = useMutation({
    mutationFn: (id: number) => appClientsApi.remove(id),
    onSuccess: () => {
      notifySuccess('App Client dihapus.');
      void queryClient.invalidateQueries({ queryKey: ['app-clients'] });
    },
    onError: (error) => notifyError(error),
  });

  const openForm = (client: AppClient | null) => {
    setFormClient(client);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="App Client"
        description="App ID dan App Key untuk aplikasi mobile, web, dan server."
        actions={
          <>
            <LicenseQuota kind="app_clients" />
            <Button leftSection={<IconPlus size={16} />} onClick={() => openForm(null)}>
              Buat App Client
            </Button>
          </>
        }
      />
      <Card withBorder radius="md">
        <Group mb="md">
          <SearchInput value={filters.search} onChange={(search) => setFilters({ search })} placeholder="Cari app client" />
        </Group>
        {query.isPending ? (
          <TableSkeleton cols={7} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <EmptyState title="Belum ada App Client" />
        ) : (
          <Table.ScrollContainer minWidth={1150}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nama</Table.Th>
                  <Table.Th>App ID</Table.Th>
                  <Table.Th>Key</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Berlaku sampai</Table.Th>
                  <Table.Th>Terakhir dipakai</Table.Th>
                  <Table.Th>Rotasi key</Table.Th>
                  <Table.Th w={60} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {query.data.items.map((client) => {
                  const isCurrent = client.app_id === env.appId;
                  const expired = client.expires_at && Date.parse(client.expires_at) < Date.now();
                  return (
                    <Table.Tr key={client.id}>
                      <Table.Td>
                        <Text size="sm" fw={600}>{client.name}</Text>
                        <Group gap={4} mt={2}>
                          <Badge size="xs" variant="outline" color="gray">{PLATFORMS.find((p) => p.value === client.platform)?.label ?? client.platform}</Badge>
                          {isCurrent && <Badge size="xs" color="blue">Dipakai web ini</Badge>}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Text size="xs" ff="monospace">{client.app_id}</Text>
                          <CopyAction value={client.app_id}>
                            {({ copied, copy }) => (
                              <ActionIcon size="sm" variant="subtle" color={copied ? 'teal' : 'gray'} onClick={copy} aria-label={`Salin App ID ${client.name}`}>
                                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                              </ActionIcon>
                            )}
                          </CopyAction>
                        </Group>
                      </Table.Td>
                      <Table.Td><Text size="xs" ff="monospace">{client.key_hint}</Text></Table.Td>
                      <Table.Td>
                        {expired ? <Badge color="red" variant="light">Kedaluwarsa</Badge> : <ActiveBadge active={client.is_active} />}
                      </Table.Td>
                      <Table.Td>{client.expires_at ? formatDateTime(client.expires_at) : 'Tanpa batas'}</Table.Td>
                      <Table.Td>{formatDateTime(client.last_used_at)}</Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatDateTime(client.key_rotated_at)}</Text>
                        {client.previous_key_expires_at && Date.parse(client.previous_key_expires_at) > Date.now() && (
                          <Text size="xs" c="orange">Key lama berlaku s.d. {formatDateTime(client.previous_key_expires_at)}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Menu position="bottom-end" withinPortal>
                          <Menu.Target>
                            <ActionIcon variant="subtle" aria-label={`Aksi ${client.name}`}>
                              <IconDots size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => openForm(client)}>Ubah</Menu.Item>
                            <Menu.Item leftSection={<IconKey size={14} />} onClick={() => setRotating(client)}>Rotasi key</Menu.Item>
                            <Menu.Divider />
                            <Tooltip label="Sedang dipakai web ini" disabled={!isCurrent} position="left">
                              <div>
                                <Menu.Item
                                  color="red"
                                  leftSection={<IconTrash size={14} />}
                                  disabled={isCurrent}
                                  onClick={() => confirmDelete({ title: 'Hapus App Client?', name: `${client.name} (${client.app_id})`, onConfirm: () => remove.mutate(client.id) })}
                                >
                                  Hapus
                                </Menu.Item>
                              </div>
                            </Tooltip>
                          </Menu.Dropdown>
                        </Menu>
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

      <Modal opened={formOpen} onClose={() => setFormOpen(false)} title={formClient ? 'Ubah App Client' : 'Buat App Client'} centered>
        {formOpen && <AppClientForm client={formClient} onCreated={setCredential} onDone={() => setFormOpen(false)} />}
      </Modal>
      <Modal opened={rotating !== null} onClose={() => setRotating(null)} title="Rotasi App Key" centered>
        {rotating && <RotateForm client={rotating} onRotated={setCredential} onDone={() => setRotating(null)} />}
      </Modal>
      <CredentialModal credential={credential} onClose={() => setCredential(null)} />
    </>
  );
}
