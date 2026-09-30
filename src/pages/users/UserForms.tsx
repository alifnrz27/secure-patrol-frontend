import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Group, Modal, PasswordInput, Select, Stack, Switch, TextInput } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { usersApi } from '@/api/users';
import { PhotoDropzone } from '@/components/PhotoDropzone';
import { useUnits } from '@/hooks/useUnitScope';
import type { Role, User } from '@/lib/api/types';
import { applyServerErrors } from '@/lib/formErrors';
import { notifyError, notifySuccess } from '@/lib/notify';
import { isHeadOfficeRole } from '@/lib/permissions';
import { passwordSchema } from '@/lib/validation';

const baseShape = {
  name: z.string().trim().min(1, 'Nama wajib diisi.').max(150, 'Maksimal 150 karakter.'),
  email: z.string().trim().min(1, 'Email wajib diisi.').max(150, 'Maksimal 150 karakter.').email('Format email tidak valid.'),
  role_id: z.string().min(1, 'Role wajib dipilih.'),
  /** Only used for unit roles picked by the Super-Admin; checked on submit. */
  unit_id: z.string(),
  is_active: z.boolean(),
  face_photo: z.instanceof(File).nullable(),
};

const createSchema = z
  .object({
    ...baseShape,
    password: passwordSchema,
    password_confirmation: z.string().min(1, 'Konfirmasi wajib diisi.'),
  })
  .refine((v) => v.password === v.password_confirmation, { path: ['password_confirmation'], message: 'Konfirmasi password tidak sama.' })
  .refine((v) => v.face_photo !== null, { path: ['face_photo'], message: 'Foto wajah wajib diunggah.' });

const updateSchema = z.object(baseShape);

type FormValues = z.infer<typeof createSchema>;
const FIELDS = ['name', 'email', 'role_id', 'unit_id', 'is_active', 'face_photo', 'password', 'password_confirmation'] as const;
const MESSAGE_FIELDS = {
  'email is already registered': 'email',
  // Covers "face photo is required" and the reference photo checks (no face, one face, too small, not frontal).
  face: 'face_photo',
  'file size': 'face_photo',
  'file must be': 'face_photo',
  'role not found': 'role_id',
  'unit_id is required': 'unit_id',
  'unit not found': 'unit_id',
} as const;

interface UserFormProps {
  user: User | null;
  roles: Role[];
  currentUserId: number;
  isSuperAdmin: boolean;
  /** Unit picked in the header; preselected for new unit users. */
  defaultUnitId?: number;
  onDone: () => void;
}

export function UserForm({ user, roles, currentUserId, isSuperAdmin, defaultUnitId, onDone }: UserFormProps) {
  const queryClient = useQueryClient();
  const isSelf = user?.id === currentUserId;
  const units = useUnits();
  const { register, control, handleSubmit, setError, clearErrors, watch, formState } = useForm<FormValues>({
    resolver: zodResolver((user ? updateSchema : createSchema) as typeof createSchema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      role_id: user ? String(user.role.id) : '',
      unit_id: user?.unit_id ? String(user.unit_id) : defaultUnitId ? String(defaultUnitId) : '',
      is_active: user?.is_active ?? true,
      face_photo: null,
      password: '',
      password_confirmation: '',
    },
  });

  const selectedRole = roles.find((r) => String(r.id) === watch('role_id'));
  // Only the Super-Admin picks a unit, and only for unit roles; head office
  // roles have no unit and unit managers always create users in their unit.
  const needsUnit = isSuperAdmin && Boolean(selectedRole) && !isHeadOfficeRole(selectedRole?.code);
  const movedUnit = Boolean(user?.unit_id) && needsUnit && watch('unit_id') !== String(user?.unit_id ?? '');

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      // On update an unchanged unit is not sent ("empty = stays in the current unit").
      const unitId = needsUnit && (!user || values.unit_id !== String(user.unit_id ?? '')) ? Number(values.unit_id) : undefined;
      const base = {
        name: values.name,
        email: values.email,
        role_id: Number(values.role_id),
        unit_id: unitId,
        is_active: values.is_active,
        face_photo: values.face_photo,
      };
      return user
        ? usersApi.update(user.id, base)
        : usersApi.create({ ...base, password: values.password, password_confirmation: values.password_confirmation });
    },
    onSuccess: () => {
      notifySuccess(user ? 'Pengguna diperbarui.' : 'Pengguna ditambahkan.');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['secure-image'] });
      onDone();
    },
    onError: (error) => {
      const rest = applyServerErrors(error, setError, FIELDS, MESSAGE_FIELDS);
      if (rest.length) notifyError(error, rest);
    },
  });

  // Head office roles (Super-Admin, Manager Keamanan) are assigned only by the
  // Super-Admin. Inactive roles are rejected, except the one the user already has.
  const roleOptions = roles
    .filter((r) => (isSuperAdmin || !isHeadOfficeRole(r.code)) && (r.is_active || r.id === user?.role.id))
    .map((r) => ({ value: String(r.id), label: r.is_active ? r.name : `${r.name} (nonaktif)` }));

  const roleChanged = user && watch('role_id') !== String(user.role.id);
  const deactivated = user && user.is_active && !watch('is_active');
  const unitOptions = (units.data ?? [])
    .filter((u) => u.is_active || String(u.id) === watch('unit_id'))
    .map((u) => ({ value: String(u.id), label: u.is_active ? `${u.name} (${u.code})` : `${u.name} (${u.code}) — Nonaktif` }));

  return (
    <form
      onSubmit={handleSubmit((values) => {
        if (needsUnit && !values.unit_id) {
          setError('unit_id', { type: 'client', message: 'Unit wajib dipilih untuk role ini.' });
          return;
        }
        mutation.mutate(values);
      })}
      noValidate
    >
      <Stack>
        <TextInput label="Nama" withAsterisk {...register('name')} error={formState.errors.name?.message} />
        <TextInput label="Email" type="email" withAsterisk autoComplete="off" {...register('email')} error={formState.errors.email?.message} />
        <Controller
          control={control}
          name="role_id"
          render={({ field, fieldState }) => (
            <Select
              label="Role"
              withAsterisk
              data={roleOptions}
              value={field.value || null}
              onChange={(v) => field.onChange(v ?? '')}
              error={fieldState.error?.message}
              disabled={isSelf}
              description={isSelf ? 'Anda tidak bisa mengganti role akun sendiri.' : undefined}
              allowDeselect={false}
            />
          )}
        />
        {needsUnit && (
          <Controller
            control={control}
            name="unit_id"
            render={({ field, fieldState }) => (
              <Select
                label="Unit"
                withAsterisk
                searchable
                data={unitOptions}
                value={field.value || null}
                onChange={(v) => field.onChange(v ?? '')}
                error={fieldState.error?.message}
                disabled={isSelf}
                description={isSelf ? 'Anda tidak bisa memindahkan unit akun sendiri.' : 'Role unit wajib punya unit.'}
                allowDeselect={false}
              />
            )}
          />
        )}
        {!user && (
          <Group grow align="flex-start">
            <PasswordInput label="Password" withAsterisk autoComplete="new-password" description="8–72 karakter, huruf dan angka" {...register('password')} error={formState.errors.password?.message} />
            <PasswordInput label="Konfirmasi password" withAsterisk autoComplete="new-password" {...register('password_confirmation')} error={formState.errors.password_confirmation?.message} />
          </Group>
        )}
        <Controller
          control={control}
          name="face_photo"
          render={({ field, fieldState }) => (
            <PhotoDropzone
              label={user ? 'Foto wajah (opsional, mengganti foto lama)' : 'Foto wajah'}
              required={!user}
              value={field.value}
              onChange={field.onChange}
              onValidation={(message) => (message ? setError('face_photo', { type: 'client', message }) : clearErrors('face_photo'))}
              error={fieldState.error?.message}
              existingPath={user?.face_photo_url ? usersApi.facePhotoPath(user.id) : null}
              existingVersion={user?.face_photo_updated_at}
            />
          )}
        />
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <Switch
              label="Aktif"
              checked={field.value}
              disabled={isSelf}
              description={isSelf ? 'Anda tidak bisa menonaktifkan akun sendiri.' : undefined}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />
        {user && (roleChanged || deactivated) && (
          <Alert color="orange" icon={<IconAlertTriangle size={18} />}>
            {deactivated ? 'Menonaktifkan' : 'Mengganti role'} pengguna ini langsung mengakhiri semua sesi login-nya.
          </Alert>
        )}
        {movedUnit && !deactivated && (
          <Alert color="orange" icon={<IconAlertTriangle size={18} />}>
            Pengguna akan dipindah ke unit lain dan keluar dari semua perangkat.
          </Alert>
        )}
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

const resetSchema = z
  .object({ password: passwordSchema, password_confirmation: z.string().min(1, 'Konfirmasi wajib diisi.') })
  .refine((v) => v.password === v.password_confirmation, { path: ['password_confirmation'], message: 'Konfirmasi password tidak sama.' });
type ResetValues = z.infer<typeof resetSchema>;

export function ResetPasswordModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  return (
    <Modal opened={user !== null} onClose={onClose} title={`Reset password: ${user?.name ?? ''}`} centered>
      {user && <ResetPasswordForm user={user} onDone={onClose} />}
    </Modal>
  );
}

function ResetPasswordForm({ user, onDone }: { user: User; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, setError, formState } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', password_confirmation: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: ResetValues) => usersApi.resetPassword(user.id, values),
    onSuccess: () => {
      notifySuccess('Password direset. Semua sesi pengguna diakhiri.');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      onDone();
    },
    onError: (error) => {
      const rest = applyServerErrors(error, setError, ['password', 'password_confirmation']);
      if (rest.length) notifyError(error, rest);
    },
  });
  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      <Stack>
        <Alert color="blue" variant="light">
          Reset password juga membuka kunci akun dan mengakhiri semua sesi login pengguna ini.
        </Alert>
        <PasswordInput label="Password baru" withAsterisk autoComplete="new-password" description="8–72 karakter, huruf dan angka" {...register('password')} error={formState.errors.password?.message} />
        <PasswordInput label="Konfirmasi password" withAsterisk autoComplete="new-password" {...register('password_confirmation')} error={formState.errors.password_confirmation?.message} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            Batal
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Reset password
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
