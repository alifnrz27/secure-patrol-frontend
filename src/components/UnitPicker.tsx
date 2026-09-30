import { Badge, Group, Select, Text } from '@mantine/core';
import { IconBuilding } from '@tabler/icons-react';
import { useSession } from '@/hooks/useSession';
import { useUnitScope } from '@/hooks/useUnitScope';

/** Header control: unit picker for head office users, unit badge for unit users. */
export function UnitPicker() {
  const { user } = useSession();
  const { isHeadOffice, unitId, setUnitId, units } = useUnitScope();

  if (!isHeadOffice) {
    if (!user?.unit) return null;
    return (
      <Group gap={6} visibleFrom="sm" aria-label="Unit Anda">
        <IconBuilding size={16} color="var(--mantine-color-dimmed)" aria-hidden />
        <Text size="sm" fw={600}>{user.unit.name}</Text>
        <Badge variant="outline" color="gray" size="sm">{user.unit.code}</Badge>
      </Group>
    );
  }

  return (
    <Select
      aria-label="Pilih unit"
      leftSection={<IconBuilding size={16} />}
      w={240}
      size="sm"
      allowDeselect={false}
      searchable
      value={unitId ? String(unitId) : 'all'}
      onChange={(v) => setUnitId(!v || v === 'all' ? null : Number(v))}
      data={[
        { value: 'all', label: 'Semua unit' },
        ...units.map((u) => ({ value: String(u.id), label: u.is_active ? `${u.name} (${u.code})` : `${u.name} (${u.code}) — Nonaktif` })),
      ]}
      comboboxProps={{ withinPortal: true }}
    />
  );
}
