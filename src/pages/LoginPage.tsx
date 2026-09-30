import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Center, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconAlertTriangle, IconClock } from '@tabler/icons-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { BrandLogo } from '@/components/BrandLogo';
import { apiConfigProblem, isEnvConfigured } from '@/config/env';
import { useBranding, useDocumentTitle } from '@/hooks/useBranding';
import { useSession } from '@/hooks/useSession';
import { describeError, isApiError } from '@/lib/api/errors';
import { session } from '@/lib/auth/session';
import { applyServerErrors } from '@/lib/formErrors';

const schema = z.object({
  email: z.string().trim().min(1, 'Email wajib diisi.').email('Format email tidak valid.'),
  password: z.string().min(1, 'Password wajib diisi.'),
});
type FormValues = z.infer<typeof schema>;

/** Only same-app paths are allowed as redirect targets. */
function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/login')) return '/';
  return value;
}

export function LoginPage() {
  const { status, endReason } = useSession();
  const { appName } = useBranding();
  useDocumentTitle('Masuk');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const redirect = safeRedirect(params.get('redirect'));
  const expired = params.get('expired') === '1';

  const { register, handleSubmit, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  if (status === 'authenticated') return <Navigate to={redirect} replace />;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await session.login(values.email, values.password);
      navigate(redirect, { replace: true });
    } catch (error) {
      const rest = applyServerErrors(error, setError, ['email', 'password']);
      if (!isApiError(error) || error.kind !== 'validation' || rest.length) setFormError(describeError(error));
    }
  });

  return (
    <Center mih="100vh" p="md" bg="gray.0">
      <Paper withBorder shadow="sm" p="xl" radius="lg" w="100%" maw={400}>
        <form onSubmit={onSubmit} noValidate>
          <Stack>
            <Stack gap={4} align="center">
              <BrandLogo size={56} />
              <Title order={2} ta="center">{appName}</Title>
              <Text c="dimmed" size="sm">
                Masuk ke panel admin
              </Text>
            </Stack>

            {!isEnvConfigured && (
              <Alert color="red" icon={<IconAlertTriangle size={18} />}>
                Konfigurasi aplikasi belum lengkap (VITE_APP_ID, VITE_APP_KEY).
              </Alert>
            )}
            {apiConfigProblem() && (
              <Alert color="red" icon={<IconAlertTriangle size={18} />} title="Konfigurasi API">
                {apiConfigProblem()}
              </Alert>
            )}
            {endReason === 'unit_inactive' && !formError && (
              <Alert color="red" icon={<IconAlertTriangle size={18} />}>
                Unit Anda sedang dinonaktifkan, hubungi pusat.
              </Alert>
            )}
            {endReason === 'forbidden' && !formError && (
              <Alert color="red" icon={<IconAlertTriangle size={18} />}>
                Akun Anda tidak memiliki akses ke web admin. Gunakan aplikasi mobile.
              </Alert>
            )}
            {expired && !formError && (
              <Alert color="orange" icon={<IconClock size={18} />}>
                Sesi berakhir, silakan login kembali.
              </Alert>
            )}
            {formError && (
              <Alert color="red" icon={<IconAlertTriangle size={18} />} role="alert">
                {formError}
              </Alert>
            )}

            <TextInput
              label="Email"
              type="email"
              autoComplete="username"
              autoFocus
              {...register('email')}
              error={formState.errors.email?.message}
            />
            <PasswordInput
              label="Password"
              autoComplete="current-password"
              {...register('password')}
              error={formState.errors.password?.message}
            />
            <Button type="submit" loading={formState.isSubmitting} fullWidth mt="xs">
              Masuk
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
