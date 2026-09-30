import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Card, Grid, Group, PasswordInput, Stack, Table, Text, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconLogout } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { authApi } from '@/api/auth';
import { ActiveBadge } from '@/components/Badges';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState, TableSkeleton } from '@/components/StateViews';
import { UserAvatar } from '@/components/UserAvatar';
import { useSession } from '@/hooks/useSession';
import { session } from '@/lib/auth/session';
import { formatDateTime } from '@/lib/format';
import { applyServerErrors } from '@/lib/formErrors';
import { notifyError, notifySuccess } from '@/lib/notify';
import { passwordSchema } from '@/lib/validation';

const passwordFormSchema = z
  .object({
    old_password: z.string().min(1, 'Password lama wajib diisi.'),
    password: passwordSchema,
    password_confirmation: z.string().min(1, 'Konfirmasi wajib diisi.'),
  })
  .refine((v) => v.password === v.password_confirmation, { path: ['password_confirmation'], message: 'Konfirmasi password tidak sama.' })
  .refine((v) => v.password !== v.old_password, { path: ['password'], message: 'Password baru harus berbeda dari password lama.' });
type PasswordValues = z.infer<typeof passwordFormSchema>;

function ChangePasswordForm() {
  const { register, handleSubmit, setError, reset, formState } = useForm<PasswordValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { old_password: '', password: '', password_confirmation: '' },
  });
  const mutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      notifySuccess('Password diganti. Perangkat lain otomatis keluar.');
      reset();
    },
    onError: (error) => {
      const rest = applyServerErrors(error, setError, ['old_password', 'password', 'password_confirmation'], {
        'old password is incorrect': 'old_password',
        'must be different': 'password',
      });
      if (rest.length) notifyError(error, rest);
    },
  });
  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      <Stack>
        <PasswordInput label="Password lama" withAsterisk autoComplete="current-password" {...register('old_password')} error={formState.errors.old_password?.message} />
        <PasswordInput label="Password baru" withAsterisk autoComplete="new-password" description="8–72 karakter, huruf dan angka" {...register('password')} error={formState.errors.password?.message} />
        <PasswordInput label="Konfirmasi password baru" withAsterisk autoComplete="new-password" {...register('password_confirmation')} error={formState.errors.password_confirmation?.message} />
        <Text size="xs" c="dimmed">Setelah password diganti, semua perangkat lain otomatis keluar. Sesi ini tetap aktif.</Text>
        <Group justify="flex-end">
          <Button type="submit" loading={mutation.isPending}>
            Ganti password
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export default function ProfilePage() {
  const { avatarDataUrl } = useSession();
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ['auth', 'me'], queryFn: authApi.me });

  useEffect(() => {
    if (me.data) session.setUser(me.data);
  }, [me.data]);

  const logoutAll = useMutation({
    mutationFn: () => session.logout(true),
    onSuccess: () => navigate('/login', { replace: true }),
    onError: (error) => notifyError(error),
  });

  const confirmLogoutAll = () =>
    modals.openConfirmModal({
      title: 'Keluar dari semua perangkat?',
      centered: true,
      children: <Text size="sm">Semua sesi login akun Anda, termasuk di perangkat ini dan aplikasi mobile, akan diakhiri.</Text>,
      labels: { confirm: 'Keluar dari semua', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => logoutAll.mutate(),
    });

  const user = me.data;

  return (
    <>
      <PageHeader title="Profil" />
      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder radius="md">
            {me.isPending ? (
              <TableSkeleton rows={5} cols={2} />
            ) : me.isError ? (
              <ErrorState error={me.error} onRetry={() => void me.refetch()} />
            ) : (
              user && (
                <Stack>
                  <Group>
                    <UserAvatar
                      name={user.name}
                      dataUrl={avatarDataUrl}
                      path={user.face_photo_url ? '/api/v1/auth/me/face-photo' : null}
                      version={user.face_photo_updated_at}
                      size={96}
                      radius="md"
                    />
                    <div>
                      <Title order={3}>{user.name}</Title>
                      <Text c="dimmed">{user.email}</Text>
                    </div>
                  </Group>
                  <Table withRowBorders={false} verticalSpacing={6}>
                    <Table.Tbody>
                      <Table.Tr>
                        <Table.Th w={160} fw={500} c="dimmed">Role</Table.Th>
                        <Table.Td>{user.role.name}</Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Th fw={500} c="dimmed">Unit</Table.Th>
                        <Table.Td>{user.unit ? `${user.unit.name} (${user.unit.code})` : 'Pusat (semua unit)'}</Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Th fw={500} c="dimmed">Status</Table.Th>
                        <Table.Td><ActiveBadge active={user.is_active} /></Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Th fw={500} c="dimmed">Login terakhir</Table.Th>
                        <Table.Td>{formatDateTime(user.last_login_at)}</Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Th fw={500} c="dimmed">Foto diperbarui</Table.Th>
                        <Table.Td>{formatDateTime(user.face_photo_updated_at)}</Table.Td>
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>
                  <Text size="xs" c="dimmed">Nama, email, dan foto diubah oleh admin melalui menu Pengguna.</Text>
                </Stack>
              )
            )}
          </Card>
          <Card withBorder radius="md" mt="md">
            <Title order={4} mb="xs">Sesi</Title>
            <Alert variant="light" color="orange" mb="sm">
              Gunakan jika Anda curiga akun dipakai di perangkat lain.
            </Alert>
            <Button color="red" variant="light" leftSection={<IconLogout size={16} />} onClick={confirmLogoutAll} loading={logoutAll.isPending}>
              Keluar dari semua perangkat
            </Button>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder radius="md">
            <Title order={4} mb="md">Ganti password</Title>
            <ChangePasswordForm />
          </Card>
        </Grid.Col>
      </Grid>
    </>
  );
}
