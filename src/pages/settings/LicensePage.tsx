import { zodResolver } from '@hookform/resolvers/zod';
import { ActionIcon, Alert, Badge, Button, Card, Code, Grid, Group, Progress, Skeleton, Stack, Table, Text, Textarea, Title, Tooltip } from '@mantine/core';
import { IconAlertTriangle, IconCheck, IconCopy, IconLicense } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { licenseApi } from '@/api/license';
import { CopyAction } from '@/components/CopyAction';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/StateViews';
import { isApiError, translateServerMessage } from '@/lib/api/errors';
import type { License } from '@/lib/api/types';
import { session } from '@/lib/auth/session';
import { licenseGate } from '@/lib/licenseGate';
import { formatDateTime } from '@/lib/format';
import { applyServerErrors } from '@/lib/formErrors';
import { LICENSE_STATUS_LABEL } from '@/lib/license';
import { notifyError, notifySuccess } from '@/lib/notify';

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Kode license wajib diisi.')
    .refine((v) => v.startsWith('SPL1.'), 'Kode license diawali "SPL1."'),
});
type FormValues = z.infer<typeof schema>;

export function useLicense(enabled = true) {
  return useQuery({ queryKey: ['license'], queryFn: licenseApi.get, enabled, staleTime: 30_000 });
}

function Usage({ label, used, max, over, hasLicense }: { label: string; used: number; max: number; over: boolean; hasLicense: boolean }) {
  // No license installed yet: there is no limit to compare with.
  if (!hasLicense) {
    return (
      <Group justify="space-between">
        <Text size="sm" fw={500}>{label}</Text>
        <Text size="sm">{used} <Text span c="dimmed" size="xs">(batas mengikuti license)</Text></Text>
      </Group>
    );
  }
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 100;
  return (
    <div>
      <Group justify="space-between" mb={4}>
        <Text size="sm" fw={500}>{label}</Text>
        <Text size="sm" c={over ? 'red' : undefined} fw={over ? 700 : undefined}>
          {used}/{max}
        </Text>
      </Group>
      <Progress value={pct} color={over ? 'red' : pct >= 100 ? 'orange' : 'blue'} aria-label={`${label} ${used} dari ${max}`} />
      {over && (
        <Text size="xs" c="red" mt={4}>
          Melebihi license: {label.toLowerCase()} terbaru tidak berfungsi.
        </Text>
      )}
    </div>
  );
}

function InstallForm() {
  const queryClient = useQueryClient();
  const { register, handleSubmit, setError, reset, formState } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { code: '' } });
  const mutation = useMutation({
    mutationFn: (values: FormValues) => licenseApi.install(values.code),
    onSuccess: async (data) => {
      queryClient.setQueryData(['license'], data);
      reset({ code: '' });
      notifySuccess('License terpasang.');
      // The banner and the locked mode follow the license summary of the session.
      await session.refreshProfile().catch(() => undefined);
      void licenseGate.load();
      void queryClient.invalidateQueries();
    },
    onError: (error) => {
      const rest = applyServerErrors(error, setError, ['code'], { 'license code': 'code', 'this license': 'code' });
      if (rest.length) notifyError(error, rest);
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      <Stack>
        <Textarea
          label="Kode license"
          description='Tempel kode dari vendor (diawali "SPL1."). Kode baru menggantikan license yang terpasang.'
          placeholder="SPL1.…"
          autosize
          minRows={3}
          maxRows={8}
          styles={{ input: { fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' } }}
          {...register('code')}
          error={formState.errors.code?.message}
        />
        <Group justify="flex-end">
          <Button type="submit" loading={mutation.isPending} leftSection={<IconLicense size={16} />}>
            Pasang license
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

function LicenseDetail({ data }: { data: License }) {
  const status = LICENSE_STATUS_LABEL[data.status] ?? { label: data.status, color: 'gray' };
  const info = data.license;
  const rows: [string, string][] = info
    ? [
        ['ID license', info.license_id],
        ['Pelanggan', info.customer],
        ['Diterbitkan', formatDateTime(info.issued_at)],
        ['Berakhir', formatDateTime(info.expires_at)],
        ['Masa tenggang', `${info.grace_days} hari (s.d. ${formatDateTime(info.grace_until)})`],
      ]
    : [];
  return (
    <Stack>
      <Group gap="sm">
        <Badge size="lg" color={status.color} variant="light">{status.label}</Badge>
        {data.days_left !== null && (
          <Text size="sm" c="dimmed">
            {data.status === 'grace' ? `Terkunci dalam ${data.days_left} hari` : `Berakhir dalam ${data.days_left} hari`}
          </Text>
        )}
      </Group>
      {data.reason && data.status !== 'active' && (
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />}>
          {translateServerMessage(data.reason)}
        </Alert>
      )}
      <div>
        <Text size="sm" fw={500} mb={4}>Install ID</Text>
        <Group gap="xs" wrap="nowrap">
          <Code fz="sm" style={{ flex: 1 }}>{data.install_id}</Code>
          <CopyAction value={data.install_id}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? 'Tersalin' : 'Salin'}>
                <ActionIcon variant="light" color={copied ? 'teal' : 'blue'} onClick={copy} aria-label="Salin Install ID">
                  {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyAction>
        </Group>
        <Text size="xs" c="dimmed" mt={4}>Kirim Install ID ini ke vendor untuk mendapatkan license.</Text>
      </div>
      {info ? (
        <Table withRowBorders={false} verticalSpacing={4}>
          <Table.Tbody>
            {rows.map(([label, value]) => (
              <Table.Tr key={label}>
                <Table.Th w={140} fw={500} c="dimmed">{label}</Table.Th>
                <Table.Td>{value}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">Belum ada license terpasang.</Text>
      )}
      <Text size="xs" c="dimmed">Diperiksa {formatDateTime(data.checked_at)}</Text>
    </Stack>
  );
}

/** License status, usage and install form. Also shown alone when the license is locked. */
export function LicensePanel() {
  const query = useLicense();
  if (query.isPending) return <Skeleton h={360} radius="md" />;
  if (query.isError) {
    // An older backend without the license module answers 404 "Cannot GET /api/v1/license".
    if (isApiError(query.error) && query.error.kind === 'not_found') {
      return (
        <Alert color="orange" icon={<IconAlertTriangle size={18} />} title="Fitur license belum tersedia di server">
          Backend yang terhubung belum mendukung license (versi lama). Perbarui dan build ulang backend ke versi terbaru,
          lalu muat ulang halaman ini.
        </Alert>
      );
    }
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  const data = query.data;
  return (
    <Grid gutter="lg">
      <Grid.Col span={{ base: 12, md: 7 }}>
        <Card withBorder radius="md">
          <Title order={4} mb="sm">Status</Title>
          <LicenseDetail data={data} />
        </Card>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 5 }}>
        <Stack>
          <Card withBorder radius="md">
            <Title order={4} mb="sm">Pemakaian</Title>
            <Stack>
              <Usage label="Unit aktif" used={data.limits.units.used} max={data.limits.units.max} over={data.over_limit.units} hasLicense={Boolean(data.license)} />
              <Usage label="App Client aktif" used={data.limits.app_clients.used} max={data.limits.app_clients.max} over={data.over_limit.app_clients} hasLicense={Boolean(data.license)} />
            </Stack>
          </Card>
          <Card withBorder radius="md">
            <Title order={4} mb="sm">Pasang license</Title>
            <InstallForm />
          </Card>
        </Stack>
      </Grid.Col>
    </Grid>
  );
}

export default function LicensePage() {
  return (
    <>
      <PageHeader title="License" description="Status license, batas unit dan App Client, serta pemasangan kode license dari vendor." />
      <LicensePanel />
    </>
  );
}
