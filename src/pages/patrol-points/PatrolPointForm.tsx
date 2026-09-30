import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Grid, Group, Modal, NumberInput, Skeleton, Stack, Switch, Text, TextInput } from '@mantine/core';
import { IconCurrentLocation } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { patrolPointsApi, type PatrolPointBody } from '@/api/patrolPoints';
import { useAppConfig } from '@/hooks/useSession';
import { useUnitScope } from '@/hooks/useUnitScope';
import type { PatrolPoint } from '@/lib/api/types';
import { applyServerErrors } from '@/lib/formErrors';
import { notifyError, notifySuccess } from '@/lib/notify';

const LocationPicker = lazy(() => import('@/components/maps/LocationPicker').then((m) => ({ default: m.LocationPicker })));

const coordinate = (min: number, max: number, label: string) =>
  z
    .number({ error: `${label} wajib diisi.` })
    .min(min, `${label} minimal ${min}.`)
    .max(max, `${label} maksimal ${max}.`);

const schema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi.').max(150, 'Maksimal 150 karakter.'),
  location: z.string().trim().min(1, 'Lokasi wajib diisi.').max(255, 'Maksimal 255 karakter.'),
  nfc_code: z
    .string()
    .trim()
    .min(1, 'Kode NFC wajib diisi.')
    .max(100, 'Maksimal 100 karakter.')
    .transform((v) => v.toUpperCase()),
  latitude: coordinate(-90, 90, 'Latitude'),
  longitude: coordinate(-180, 180, 'Longitude'),
  is_location_match_required: z.boolean(),
  is_face_validation_required: z.boolean(),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;
const FIELDS = ['name', 'location', 'nfc_code', 'latitude', 'longitude', 'is_location_match_required', 'is_face_validation_required'] as const;

interface Props {
  opened: boolean;
  point: PatrolPoint | null;
  onClose: () => void;
}

export function PatrolPointFormModal({ opened, point, onClose }: Props) {
  return (
    <Modal opened={opened} onClose={onClose} title={point ? 'Ubah Titik Patroli' : 'Tambah Titik Patroli'} size="xl" centered>
      {opened && <PatrolPointForm point={point} onDone={onClose} />}
    </Modal>
  );
}

function PatrolPointForm({ point, onDone }: { point: PatrolPoint | null; onDone: () => void }) {
  const config = useAppConfig();
  // New points start on the user's unit; NFC codes stay unique across every unit.
  const { defaultCenter } = useUnitScope();
  const queryClient = useQueryClient();
  const [locating, setLocating] = useState(false);
  const { register, control, handleSubmit, setError, setValue, watch, formState } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: point
      ? { ...point }
      : {
          name: '',
          location: '',
          nfc_code: '',
          latitude: undefined as unknown as number,
          longitude: undefined as unknown as number,
          is_location_match_required: false,
          is_face_validation_required: false,
        },
  });

  const mutation = useMutation({
    mutationFn: (body: PatrolPointBody) => (point ? patrolPointsApi.update(point.id, body) : patrolPointsApi.create(body)),
    onSuccess: () => {
      notifySuccess(point ? 'Titik patroli diperbarui.' : 'Titik patroli ditambahkan.');
      void queryClient.invalidateQueries({ queryKey: ['patrol-points'] });
      onDone();
    },
    onError: (error) => {
      const rest = applyServerErrors(error, setError, FIELDS, { 'nfc code': 'nfc_code' });
      if (rest.length) notifyError(error, rest);
    },
  });

  const lat = watch('latitude');
  const lng = watch('longitude');
  const setPosition = (la: number, lo: number) => {
    setValue('latitude', la, { shouldValidate: true, shouldDirty: true });
    setValue('longitude', lo, { shouldValidate: true, shouldDirty: true });
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition(Math.round(pos.coords.latitude * 1e7) / 1e7, Math.round(pos.coords.longitude * 1e7) / 1e7);
        setLocating(false);
      },
      () => {
        setLocating(false);
        notifyError(null, ['Lokasi perangkat tidak bisa dibaca. Pilih lokasi di peta.']);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const radius = config?.location_radius_meters ?? 100;

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack>
            <TextInput label="Nama titik" withAsterisk {...register('name')} error={formState.errors.name?.message} />
            <TextInput
              label="Lokasi"
              description="Deskripsi lokasi, mis. Gedung A Lantai 2"
              withAsterisk
              {...register('location')}
              error={formState.errors.location?.message}
            />
            <TextInput
              label="Kode NFC"
              description="UID tag heksadesimal dipisah titik dua, mis. 04:A2:1F:9C. Disimpan dalam huruf besar."
              withAsterisk
              styles={{ input: { fontFamily: 'monospace', textTransform: 'uppercase' } }}
              {...register('nfc_code')}
              error={formState.errors.nfc_code?.message}
            />
            <Group grow align="flex-start">
              <Controller
                control={control}
                name="latitude"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Latitude"
                    withAsterisk
                    decimalScale={7}
                    min={-90}
                    max={90}
                    hideControls
                    value={field.value ?? ''}
                    onChange={(v) => field.onChange(typeof v === 'number' ? v : v === '' ? undefined : Number(v))}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="longitude"
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Longitude"
                    withAsterisk
                    decimalScale={7}
                    min={-180}
                    max={180}
                    hideControls
                    value={field.value ?? ''}
                    onChange={(v) => field.onChange(typeof v === 'number' ? v : v === '' ? undefined : Number(v))}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </Group>
            <Controller
              control={control}
              name="is_location_match_required"
              render={({ field }) => (
                <Switch
                  label="Wajib validasi lokasi"
                  description={`Scan ditolak jika petugas lebih dari ${radius} m dari titik.`}
                  checked={field.value}
                  onChange={(e) => field.onChange(e.currentTarget.checked)}
                />
              )}
            />
            <Controller
              control={control}
              name="is_face_validation_required"
              render={({ field }) => (
                <Switch
                  label="Wajib validasi wajah"
                  description="Petugas harus lolos pencocokan wajah di aplikasi."
                  checked={field.value}
                  onChange={(e) => field.onChange(e.currentTarget.checked)}
                />
              )}
            />
            {!point && (
              <Alert variant="light" color="blue">
                Titik baru otomatis masuk ke daftar patroli shift yang sedang berjalan.
              </Alert>
            )}
            {point && (
              <Alert variant="light" color="gray">
                Perubahan tidak mengubah riwayat shift yang sudah selesai.
              </Alert>
            )}
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Group justify="space-between" mb={6}>
            <Text size="sm" fw={500}>
              Pilih lokasi di peta
            </Text>
            <Button size="xs" variant="subtle" leftSection={<IconCurrentLocation size={14} />} onClick={useMyLocation} loading={locating}>
              Lokasi saya
            </Button>
          </Group>
          <Suspense fallback={<Skeleton h={340} />}>
            <LocationPicker
              latitude={typeof lat === 'number' ? lat : null}
              longitude={typeof lng === 'number' ? lng : null}
              radiusMeters={radius}
              fallbackCenter={defaultCenter}
              onChange={setPosition}
            />
          </Suspense>
          <Text size="xs" c="dimmed" mt={6}>
            Klik peta atau geser penanda. Lingkaran menunjukkan area scan yang diterima ({radius} m).
          </Text>
        </Grid.Col>
      </Grid>
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={onDone}>
          Batal
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          Simpan
        </Button>
      </Group>
    </form>
  );
}
