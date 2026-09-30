import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Card, Grid, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconInfoCircle, IconRestore, IconX } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { brandingApi } from '@/api/branding';
import { BrandLogo } from '@/components/BrandLogo';
import { PageHeader } from '@/components/PageHeader';
import { PhotoDropzone } from '@/components/PhotoDropzone';
import { useBranding } from '@/hooks/useBranding';
import { branding, toBrandingState } from '@/lib/branding';
import { formatDateTime } from '@/lib/format';
import { applyServerErrors } from '@/lib/formErrors';
import { notifyError, notifySuccess } from '@/lib/notify';

const MAX_LOGO_BYTES = 1024 * 1024;

const schema = z.object({
  app_name: z.string().trim().min(1, 'Nama aplikasi wajib diisi.').max(100, 'Maksimal 100 karakter.'),
  logo: z.instanceof(File).nullable(),
});
type FormValues = z.infer<typeof schema>;

/** How the header and login page will look with the pending values. */
function Preview({ appName, logoUrl }: { appName: string; logoUrl: string | null }) {
  const name = appName.trim() || 'Nama aplikasi';
  return (
    <Stack gap="sm">
      <Text size="sm" fw={500}>Pratinjau</Text>
      <Paper withBorder radius="md" p="sm">
        <Text size="xs" c="dimmed" mb={6}>Header</Text>
        <Group gap="sm" wrap="nowrap">
          <BrandLogo size={28} logoUrl={logoUrl} />
          <Text fw={700} size="lg" truncate>{name}</Text>
        </Group>
      </Paper>
      <Paper withBorder radius="md" p="lg" bg="gray.0">
        <Text size="xs" c="dimmed" mb={6}>Halaman login</Text>
        <Stack gap={4} align="center">
          <BrandLogo size={56} logoUrl={logoUrl} />
          <Title order={3} ta="center">{name}</Title>
          <Text size="sm" c="dimmed">Masuk ke panel admin</Text>
        </Stack>
      </Paper>
      <Paper withBorder radius="md" p="sm">
        <Text size="xs" c="dimmed" mb={6}>Tab browser</Text>
        <Group gap={8} wrap="nowrap">
          <BrandLogo size={16} logoUrl={logoUrl} />
          <Text size="sm" truncate>Dashboard — {name}</Text>
        </Group>
      </Paper>
    </Stack>
  );
}

export default function BrandingPage() {
  const current = useBranding();
  const [removeLogo, setRemoveLogo] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const { register, control, handleSubmit, setError, clearErrors, watch, setValue, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { app_name: current.appName, logo: null },
  });

  const logo = watch('logo');
  useEffect(() => {
    if (!logo) {
      setFilePreview(null);
      return;
    }
    const url = URL.createObjectURL(logo);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      brandingApi.update({ app_name: values.app_name, logo: removeLogo ? null : values.logo, remove_logo: removeLogo }),
    onSuccess: (data) => {
      // Updates the header, login page, title and favicon right away (and the cache).
      branding.set(toBrandingState(data));
      reset({ app_name: data.app_name, logo: null });
      setRemoveLogo(false);
      notifySuccess('Tampilan aplikasi disimpan.');
    },
    onError: (error) => {
      const rest = applyServerErrors(error, setError, ['app_name', 'logo'], {
        app_name: 'app_name',
        logo: 'logo',
        'file must be': 'logo',
      });
      if (rest.length) notifyError(error, rest);
    },
  });

  const pendingLogo = removeLogo ? null : (filePreview ?? current.logoUrl);
  const dirty = formState.isDirty || removeLogo || Boolean(logo);

  return (
    <>
      <PageHeader title="Tampilan Aplikasi" description="Nama dan logo aplikasi untuk semua unit: halaman login, header, judul tab, dan favicon." />
      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card withBorder radius="md">
            <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
              <Stack>
                <TextInput
                  label="Nama aplikasi"
                  withAsterisk
                  maxLength={100}
                  description={`${watch('app_name').length}/100 karakter`}
                  {...register('app_name')}
                  error={formState.errors.app_name?.message}
                />
                <Controller
                  control={control}
                  name="logo"
                  render={({ field, fieldState }) => (
                    <PhotoDropzone
                      label="Logo"
                      value={field.value}
                      onChange={(file) => {
                        field.onChange(file);
                        if (file) setRemoveLogo(false);
                      }}
                      onValidation={(message) => (message ? setError('logo', { type: 'client', message }) : clearErrors('logo'))}
                      error={fieldState.error?.message}
                      existingUrl={removeLogo ? null : current.logoUrl}
                      maxBytes={MAX_LOGO_BYTES}
                      fit="contain"
                      description="JPEG/PNG, maksimal 1 MB. Disarankan gambar persegi dan PNG transparan. Tanpa file baru, logo lama tetap dipakai."
                    />
                  )}
                />
                <Group gap="xs">
                  {removeLogo ? (
                    <Button variant="subtle" color="gray" size="xs" leftSection={<IconX size={14} />} onClick={() => setRemoveLogo(false)}>
                      Batal pakai logo bawaan
                    </Button>
                  ) : (
                    <Button
                      variant="light"
                      color="gray"
                      size="xs"
                      leftSection={<IconRestore size={14} />}
                      disabled={!current.logoUrl && !logo}
                      onClick={() => {
                        setValue('logo', null);
                        clearErrors('logo');
                        setRemoveLogo(true);
                      }}
                    >
                      Pakai logo bawaan
                    </Button>
                  )}
                  {current.logoUpdatedAt && (
                    <Text size="xs" c="dimmed">Logo terakhir diganti {formatDateTime(current.logoUpdatedAt)}</Text>
                  )}
                </Group>
                {removeLogo && (
                  <Alert variant="light" color="orange" icon={<IconInfoCircle size={18} />}>
                    Logo kustom akan dihapus dan aplikasi kembali memakai logo bawaan setelah disimpan.
                  </Alert>
                )}
                <Group justify="flex-end">
                  <Button
                    variant="default"
                    disabled={!dirty || mutation.isPending}
                    onClick={() => {
                      reset({ app_name: current.appName, logo: null });
                      setRemoveLogo(false);
                    }}
                  >
                    Batal
                  </Button>
                  <Button type="submit" loading={mutation.isPending} disabled={!dirty}>
                    Simpan
                  </Button>
                </Group>
              </Stack>
            </form>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card withBorder radius="md">
            <Preview appName={watch('app_name')} logoUrl={pendingLogo} />
          </Card>
        </Grid.Col>
      </Grid>
    </>
  );
}
