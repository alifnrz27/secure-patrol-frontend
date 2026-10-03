import { Select } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { patrolAreasApi } from '@/api/patrolAreas';
import { patrolPointsApi } from '@/api/patrolPoints';
import { patrolShiftsApi } from '@/api/patrolShifts';
import { usersApi } from '@/api/users';
import { useUnitScope } from '@/hooks/useUnitScope';
import { dayjs } from '@/lib/format';

/**
 * Unit whose options a select shows: the header picker by default, or an
 * explicit unit (null = every unit) such as the one picked in the export dialog.
 */
type Scope = { scopeUnitId?: number | null };

function useScopedUnit(scopeUnitId: number | null | undefined) {
  const scope = useUnitScope();
  const unitId = scopeUnitId === undefined ? scope.unitId : (scopeUnitId ?? undefined);
  return { ...scope, unitId, showUnitColumn: scope.isHeadOffice && !unitId };
}

/** Shifts of the picked unit (head office: every unit when none is picked). */
export function useShifts(scopeUnitId?: number | null) {
  const { unitId } = useScopedUnit(scopeUnitId);
  return useQuery({ queryKey: ['patrol-shifts', unitId ?? 'all'], queryFn: () => patrolShiftsApi.list(unitId), staleTime: 60_000 });
}

export function ShiftSelect({ value, onChange, scopeUnitId, label }: { value: string; onChange: (v: string | null) => void; label?: string } & Scope) {
  const shifts = useShifts(scopeUnitId);
  const { showUnitColumn, unitName } = useScopedUnit(scopeUnitId);
  return (
    <Select
      label={label}
      aria-label="Filter shift"
      placeholder="Semua shift"
      data={(shifts.data ?? []).map((s) => ({
        value: String(s.id),
        label: `${s.name} (${s.start_time}–${s.end_time})${showUnitColumn ? ` — ${unitName(s.unit_id)}` : ''}`,
      }))}
      value={value || null}
      onChange={onChange}
      searchable
      clearable
      w={showUnitColumn ? 280 : 210}
    />
  );
}

export function PatrolPointSelect({ value, onChange, scopeUnitId, label }: { value: string; onChange: (v: string | null) => void; label?: string } & Scope) {
  const { unitId, showUnitColumn, unitName } = useScopedUnit(scopeUnitId);
  const points = useQuery({
    queryKey: ['patrol-points', 'all', unitId ?? 'all'],
    queryFn: () => patrolPointsApi.list({ limit: 100, unit_id: unitId }),
    staleTime: 60_000,
  });
  return (
    <Select
      label={label}
      aria-label="Filter titik"
      placeholder="Semua titik"
      data={(points.data?.items ?? []).map((p) => ({ value: String(p.id), label: showUnitColumn ? `${p.name} — ${unitName(p.unit_id)}` : p.name }))}
      value={value || null}
      onChange={onChange}
      searchable
      clearable
      w={showUnitColumn ? 260 : 200}
    />
  );
}

/** Areas of the picked unit (head office without a unit: every unit, with the unit name). */
export function useAreas(scopeUnitId?: number | null) {
  const { unitId } = useScopedUnit(scopeUnitId);
  return useQuery({
    queryKey: ['patrol-areas', 'all', unitId ?? 'all'],
    queryFn: () => patrolAreasApi.list({ limit: 100, unit_id: unitId }),
    select: (data) => data.items,
    staleTime: 60_000,
  });
}

export function AreaSelect({ value, onChange, scopeUnitId, label }: { value: string; onChange: (v: string | null) => void; label?: string } & Scope) {
  const areas = useAreas(scopeUnitId);
  const { showUnitColumn, unitName } = useScopedUnit(scopeUnitId);
  return (
    <Select
      label={label}
      aria-label="Filter area"
      placeholder="Semua area"
      data={(areas.data ?? []).map((a) => ({ value: String(a.id), label: showUnitColumn ? `${a.name} — ${unitName(a.unit_id)}` : a.name }))}
      value={value || null}
      onChange={onChange}
      searchable
      clearable
      nothingFoundMessage="Belum ada area"
      w={showUnitColumn ? 240 : 180}
    />
  );
}

/** Users of the picked unit; unit users only get their own unit from the server. */
export function OfficerSelect({
  value,
  onChange,
  label = 'petugas',
  scopeUnitId,
  fieldLabel,
}: { value: string; onChange: (v: string | null) => void; label?: string; fieldLabel?: string } & Scope) {
  const { unitId, showUnitColumn } = useScopedUnit(scopeUnitId);
  const users = useQuery({
    queryKey: ['users', 'all-officers', unitId ?? 'all'],
    queryFn: () => usersApi.list({ limit: 100, unit_id: unitId }),
    staleTime: 60_000,
  });
  return (
    <Select
      label={fieldLabel}
      aria-label={`Filter ${label}`}
      placeholder={`Semua ${label}`}
      data={(users.data?.items ?? []).map((u) => ({ value: String(u.id), label: showUnitColumn ? `${u.name} — ${u.unit?.name ?? 'Pusat'}` : u.name }))}
      value={value || null}
      onChange={onChange}
      searchable
      clearable
      w={showUnitColumn ? 260 : 200}
    />
  );
}

const FORMAT = 'YYYY-MM-DD';

interface DateRangeProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  maxDays?: number;
  clearable?: boolean;
  label?: string;
  placeholder?: string;
}

/** Date range (YYYY-MM-DD, inclusive); on shift date unless the page says otherwise. */
export function DateRangeFilter({ from, to, onChange, maxDays, clearable = true, label, placeholder = 'Tanggal shift' }: DateRangeProps) {
  // Local state holds the half-picked range so maxDays can limit the second click.
  const [value, setValue] = useState<[Date | null, Date | null]>([null, null]);
  useEffect(() => {
    setValue([from ? dayjs(from, FORMAT).toDate() : null, to ? dayjs(to, FORMAT).toDate() : null]);
  }, [from, to]);
  return (
    <DatePickerInput
      type="range"
      label={label}
      aria-label={`Rentang ${placeholder.toLowerCase()}`}
      placeholder={placeholder}
      leftSection={<IconCalendar size={16} />}
      valueFormat="DD MMM YYYY"
      value={value}
      clearable={clearable}
      allowSingleDateInRange
      w={260}
      maxDate={maxDays && value[0] && !value[1] ? dayjs(value[0]).add(maxDays - 1, 'day').toDate() : undefined}
      onChange={([start, end]) => {
        setValue([start, end]);
        if (!start && !end) onChange('', '');
        else if (start && end) onChange(dayjs(start).format(FORMAT), dayjs(end).format(FORMAT));
      }}
    />
  );
}
