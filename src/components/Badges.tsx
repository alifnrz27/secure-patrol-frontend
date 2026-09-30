import { Badge } from '@mantine/core';
import type { GroupStatus, ScanCondition } from '@/lib/api/types';

export const CONDITION_LABEL: Record<ScanCondition, string> = { normal: 'Normal', abnormal: 'Tidak Normal' };
export const STATUS_COLORS = { unscanned: '#868e96', normal: '#2f9e44', abnormal: '#e03131' } as const;

// Status badges never shrink: a truncated "TIDAK NO…" hides the one word that matters.
const NO_SHRINK = { flexShrink: 0, minWidth: 'fit-content' } as const;

export function ConditionBadge({ condition }: { condition: ScanCondition | null | undefined }) {
  if (!condition) return <Badge color="gray" variant="light" style={NO_SHRINK}>Belum di-scan</Badge>;
  return (
    <Badge color={condition === 'abnormal' ? 'red' : 'green'} variant={condition === 'abnormal' ? 'filled' : 'light'} style={NO_SHRINK}>
      {CONDITION_LABEL[condition]}
    </Badge>
  );
}

const GROUP_STATUS: Record<GroupStatus, { label: string; color: string }> = {
  upcoming: { label: 'Akan datang', color: 'gray' },
  ongoing: { label: 'Berjalan', color: 'blue' },
  finished: { label: 'Selesai', color: 'teal' },
};

export function GroupStatusBadge({ status }: { status: GroupStatus }) {
  const s = GROUP_STATUS[status];
  return <Badge color={s.color} variant="light">{s.label}</Badge>;
}

export function ActiveBadge({ active, activeLabel = 'Aktif', inactiveLabel = 'Nonaktif' }: { active: boolean; activeLabel?: string; inactiveLabel?: string }) {
  return <Badge color={active ? 'green' : 'gray'} variant="light">{active ? activeLabel : inactiveLabel}</Badge>;
}

export function YesNoBadge({ value, yes = 'Valid', no = 'Tidak valid' }: { value: boolean; yes?: string; no?: string }) {
  return <Badge color={value ? 'green' : 'red'} variant="light">{value ? yes : no}</Badge>;
}
