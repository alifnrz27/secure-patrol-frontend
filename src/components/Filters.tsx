import { Select } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { patrolPointsApi } from '@/api/patrolPoints';
import { patrolShiftsApi } from '@/api/patrolShifts';
import { usersApi } from '@/api/users';
import { dayjs } from '@/lib/format';

export function useShifts() {
  return useQuery({ queryKey: ['patrol-shifts'], queryFn: patrolShiftsApi.list, staleTime: 60_000 });
}

export function ShiftSelect({ value, onChange }: { value: string; onChange: (v: string | null) => void }) {
  const shifts = useShifts();
  return (
    <Select
      aria-label="Filter shift"
      placeholder="Semua shift"
      data={(shifts.data ?? []).map((s) => ({ value: String(s.id), label: `${s.name} (${s.start_time}–${s.end_time})` }))}
      value={value || null}
      onChange={onChange}
      clearable
      w={210}
    />
  );
}

export function PatrolPointSelect({ value, onChange }: { value: string; onChange: (v: string | null) => void }) {
  const points = useQuery({ queryKey: ['patrol-points', 'all'], queryFn: () => patrolPointsApi.list({ limit: 100 }), staleTime: 60_000 });
  return (
    <Select
      aria-label="Filter titik"
      placeholder="Semua titik"
      data={(points.data?.items ?? []).map((p) => ({ value: String(p.id), label: p.name }))}
      value={value || null}
      onChange={onChange}
      searchable
      clearable
      w={200}
    />
  );
}

/** Only for roles that may call GET /users. */
export function OfficerSelect({ value, onChange, label = 'petugas' }: { value: string; onChange: (v: string | null) => void; label?: string }) {
  const users = useQuery({ queryKey: ['users', 'all-officers'], queryFn: () => usersApi.list({ limit: 100 }), staleTime: 60_000 });
  return (
    <Select
      aria-label={`Filter ${label}`}
      placeholder={`Semua ${label}`}
      data={(users.data?.items ?? []).map((u) => ({ value: String(u.id), label: u.name }))}
      value={value || null}
      onChange={onChange}
      searchable
      clearable
      w={200}
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
