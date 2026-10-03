import { Affix, Badge, Button, Card, Group, NumberInput, Paper, Skeleton, Stack, Switch, Text, Title, Tooltip, Transition } from '@mantine/core';
import { IconArrowBackUp, IconRestore } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { settingsApi } from '@/api/settings';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/StateViews';
import { usePermission } from '@/hooks/useSession';
import { useUnitScope } from '@/hooks/useUnitScope';
import { isApiError, translateServerMessage } from '@/lib/api/errors';
import type { Setting, SettingValue } from '@/lib/api/types';
import { session } from '@/lib/auth/session';
import { formatDateTime } from '@/lib/format';
import { notifyError, notifySuccess } from '@/lib/notify';
import { formatSettingValue, GROUPS, settingDescription, settingLabel, unitLabel, validateSetting } from './settingsMeta';

/**
 * Pending edits: a value, or null. On the global level null restores the
 * default; on the unit level it makes the unit follow the head office again.
 */
type Draft = Record<string, SettingValue | null>;

function currentValue(setting: Setting, draft: Draft): SettingValue | undefined {
  if (!(setting.key in draft)) return setting.value;
  const value = draft[setting.key];
  if (value !== null) return value;
  return setting.level === 'unit' ? setting.global_value : setting.default_value;
}

/** Server messages look like "patrol_location_radius_meters must be between 1 and 10000". */
function errorsByKey(error: unknown, keys: string[]): Record<string, string> {
  if (!isApiError(error)) return {};
  const result: Record<string, string> = {};
  for (const message of error.details.length ? error.details : [error.serverMessage]) {
    const key = keys.find((k) => message.startsWith(`${k} `) || message.startsWith(`${k}:`));
    if (key) result[key] = translateServerMessage(message.slice(key.length).replace(/^:?\s*/, ''));
  }
  return result;
}

interface RowProps {
  setting: Setting;
  draft: Draft;
  readOnly: boolean;
  error?: string;
  onChange: (value: SettingValue | null | undefined) => void;
}

function StatusBadge({ setting, draft }: { setting: Setting; draft: Draft }) {
  if (setting.key in draft) return <Badge size="xs" color="orange" variant="light">Belum disimpan</Badge>;
  if (setting.level === 'unit') {
    return setting.is_inherited ? (
      <Badge size="xs" color="gray" variant="light">Mengikuti pusat</Badge>
    ) : (
      <Badge size="xs" color="blue" variant="light">Nilai unit</Badge>
    );
  }
  return setting.is_default ? <Badge size="xs" color="gray" variant="light">Default</Badge> : <Badge size="xs" color="blue" variant="light">Diubah</Badge>;
}

function SettingRow({ setting, draft, readOnly, error, onChange }: RowProps) {
  const value = currentValue(setting, draft);
  const unitLevel = setting.level === 'unit';
  const unit = unitLabel(setting.unit);
  const fraction = setting.type === 'number' && setting.max !== null && setting.max <= 1;
  // The "back" button: follow the head office (unit level) or restore the default (global level).
  const alreadyBack = setting.key in draft ? draft[setting.key] === null : unitLevel ? setting.is_inherited : setting.is_default;
  const backLabel = unitLevel ? 'Ikuti nilai pusat' : 'Kembalikan ke default';

  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" py="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Group gap={6}>
          <Text fw={600} size="sm">{settingLabel(setting)}</Text>
          <StatusBadge setting={setting} draft={draft} />
        </Group>
        <Text size="xs" c="dimmed" mt={2}>{settingDescription(setting)}</Text>
        <Text size="xs" c="dimmed" mt={2}>
          {unitLevel ? `Nilai pusat: ${formatSettingValue(setting, setting.global_value)}` : `Default: ${formatSettingValue(setting, setting.default_value)}`}
          {setting.min !== null && setting.max !== null && ` · Rentang ${setting.min.toLocaleString('id-ID')}–${setting.max.toLocaleString('id-ID')}${unit && unit !== '°' ? ` ${unit}` : unit}`}
          {setting.updated_at && !(unitLevel ? setting.is_inherited : setting.is_default) && ` · Diubah ${formatDateTime(setting.updated_at)}`}
        </Text>
      </div>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        {setting.type === 'boolean' ? (
          <Switch
            aria-label={settingLabel(setting)}
            checked={value === true}
            disabled={readOnly}
            onChange={(e) => onChange(e.currentTarget.checked === setting.value && !unitLevel ? undefined : e.currentTarget.checked)}
            mt={6}
          />
        ) : (
          <NumberInput
            aria-label={settingLabel(setting)}
            w={170}
            value={typeof value === 'number' ? value : ''}
            min={setting.min ?? undefined}
            max={setting.max ?? undefined}
            step={setting.type === 'integer' ? 1 : fraction ? 0.01 : 1}
            allowDecimal={setting.type !== 'integer'}
            decimalScale={setting.type === 'integer' ? 0 : 4}
            decimalSeparator=","
            thousandSeparator="."
            clampBehavior="none"
            readOnly={readOnly}
            variant={readOnly ? 'filled' : 'default'}
            rightSection={unit ? <Text size="xs" c="dimmed">{unit}</Text> : undefined}
            rightSectionWidth={unit.length > 2 ? 56 : 32}
            error={error}
            onChange={(v) => {
              const next = typeof v === 'number' ? v : v === '' ? Number.NaN : Number(String(v).replace(',', '.'));
              // On the unit level an explicit value equal to the head office value is still an own value.
              onChange(next === setting.value && !(unitLevel && setting.is_inherited) ? undefined : next);
            }}
          />
        )}
        {!readOnly && (
          <Tooltip label={backLabel}>
            <Button
              variant="subtle"
              color="gray"
              size="sm"
              px={8}
              aria-label={`${backLabel}: ${settingLabel(setting)}`}
              disabled={alreadyBack}
              onClick={() => onChange((unitLevel ? setting.is_inherited : setting.is_default) ? undefined : null)}
            >
              {unitLevel ? <IconArrowBackUp size={16} /> : <IconRestore size={16} />}
            </Button>
          </Tooltip>
        )}
      </Group>
    </Group>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const canEditSettings = usePermission('editSettings');
  const { isHeadOffice, unitId } = useUnitScope();
  // Head office: the global values, or one unit's values (read only) when a unit is picked.
  // Unit users: the values of their own unit.
  const query = useQuery({ queryKey: ['settings', unitId ?? 'own'], queryFn: () => settingsApi.list(unitId) });
  const [draft, setDraft] = useState<Draft>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const settings = query.data ?? [];
  const readOnly = !canEditSettings || (isHeadOffice && Boolean(unitId));

  // Switching units discards unsaved edits of the previous list.
  useEffect(() => {
    setDraft({});
    setServerErrors({});
  }, [unitId]);

  const clientErrors = Object.fromEntries(
    settings
      .filter((s) => s.key in draft && draft[s.key] !== null)
      .map((s) => [s.key, validateSetting(s, draft[s.key])] as const)
      .filter((entry): entry is [string, string] => entry[1] !== null),
  );
  const changedCount = Object.keys(draft).length;

  const save = useMutation({
    mutationFn: () => settingsApi.update(draft),
    onSuccess: (updated) => {
      queryClient.setQueryData(['settings', unitId ?? 'own'], updated);
      // Unit lists show the global values they follow.
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      setDraft({});
      setServerErrors({});
      notifySuccess('Pengaturan disimpan dan langsung berlaku.');
      // The location radius and other public settings are also part of the app config.
      void session.refreshConfig().catch(() => undefined);
    },
    onError: (error) => {
      const byKey = errorsByKey(error, settings.map((s) => s.key));
      setServerErrors(byKey);
      // All-or-nothing on the server: nothing was saved.
      notifyError(error, Object.keys(byKey).length ? ['Tidak ada yang disimpan. Perbaiki nilai yang ditandai.'] : []);
    },
  });

  const update = (key: string, value: SettingValue | null | undefined) => {
    setServerErrors((e) => {
      const { [key]: _removed, ...rest } = e;
      return rest;
    });
    setDraft((d) => {
      const { [key]: _old, ...rest } = d;
      return value === undefined ? rest : { ...rest, [key]: value };
    });
  };

  return (
    <>
      <PageHeader
        title="Pengaturan"
        description="Pengaturan sistem yang dipakai server dan aplikasi mobile. Perubahan langsung berlaku tanpa restart dan tercatat di Log Aktivitas."
      />
      {query.isPending ? (
        <Stack>{GROUPS.map((g) => <Skeleton key={g.key} h={220} radius="md" />)}</Stack>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <Stack pb={changedCount ? 80 : 0}>
          {[...GROUPS, { key: 'other', title: 'Lainnya', description: '' }].map((group) => {
            const known = GROUPS.map((g) => g.key as string);
            const items = settings.filter((s) => (group.key === 'other' ? !known.includes(s.group) : s.group === group.key));
            if (!items.length) return null;
            return (
              <Card key={group.key} withBorder radius="md">
                <Title order={4}>{group.title}</Title>
                {group.description && <Text size="sm" c="dimmed" mb="xs">{group.description}</Text>}
                {items.map((setting) => (
                  <SettingRow
                    key={setting.key}
                    setting={setting}
                    draft={draft}
                    readOnly={readOnly}
                    error={clientErrors[setting.key] ?? serverErrors[setting.key]}
                    onChange={(value) => update(setting.key, value)}
                  />
                ))}
              </Card>
            );
          })}
        </Stack>
      )}

      <Affix position={{ bottom: 20, right: 24 }}>
        <Transition transition="slide-up" mounted={changedCount > 0 && !readOnly}>
          {(styles) => (
            <Paper style={styles} shadow="lg" withBorder radius="md" p="sm">
              <Group gap="sm">
                <Text size="sm">{changedCount} perubahan belum disimpan</Text>
                <Button variant="default" size="sm" onClick={() => { setDraft({}); setServerErrors({}); }} disabled={save.isPending}>
                  Batal
                </Button>
                <Button size="sm" onClick={() => save.mutate()} loading={save.isPending} disabled={Object.keys(clientErrors).length > 0}>
                  Simpan
                </Button>
              </Group>
            </Paper>
          )}
        </Transition>
      </Affix>
    </>
  );
}
