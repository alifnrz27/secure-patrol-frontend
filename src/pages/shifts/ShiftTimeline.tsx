import type { ReactNode } from 'react';
import { Box, Group, Stack, Text, Tooltip } from '@mantine/core';
import { coverage, DAY_MINUTES, minutesToLabel, segmentsOf, type TimelineShift } from './timeline';

const COLORS = ['#1c7ed6', '#2f9e44', '#f08c00', '#7048e8', '#0c8599', '#e64980'];
const TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

function pct(minutes: number) {
  return `${(minutes / DAY_MINUTES) * 100}%`;
}

function Track({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Group gap="sm" wrap="nowrap" align="center">
      <Text size="xs" w={110} truncate fw={500} title={label}>
        {label}
      </Text>
      <Box pos="relative" h={22} style={{ flex: 1, background: 'var(--mantine-color-gray-1)', borderRadius: 4 }}>
        {children}
      </Box>
    </Group>
  );
}

export function ShiftTimeline({ shifts }: { shifts: TimelineShift[] }) {
  const ranges = coverage(shifts);
  const gaps = ranges.filter((r) => r.count === 0);
  const overlaps = ranges.filter((r) => r.count > 1);

  return (
    <Stack gap={6} role="img" aria-label={`Timeline 24 jam untuk ${shifts.length} shift aktif`}>
      <Group gap="sm" wrap="nowrap">
        <Box w={110} />
        <Box pos="relative" h={16} style={{ flex: 1 }}>
          {TICKS.map((h) => (
            <Text key={h} size="10px" c="dimmed" pos="absolute" left={pct(h * 60)} style={{ transform: h === 24 ? 'translateX(-100%)' : h === 0 ? undefined : 'translateX(-50%)' }}>
              {String(h).padStart(2, '0')}:00
            </Text>
          ))}
        </Box>
      </Group>
      {shifts.map((shift, index) => (
        <Track key={shift.id} label={shift.id === 'draft' ? `${shift.name || 'Shift baru'} (draf)` : shift.name}>
          {segmentsOf(shift).map(([from, to]) => (
            <Tooltip key={from} label={`${shift.name}: ${shift.start_time}–${shift.end_time}`}>
              <Box
                pos="absolute"
                top={0}
                bottom={0}
                left={pct(from)}
                w={pct(to - from)}
                style={{
                  background: shift.id === 'draft' ? 'repeating-linear-gradient(45deg,#1c7ed6,#1c7ed6 6px,#4dabf7 6px,#4dabf7 12px)' : COLORS[index % COLORS.length],
                  borderRadius: 4,
                }}
              />
            </Tooltip>
          ))}
        </Track>
      ))}
      <Track label="Cakupan">
        {ranges
          .filter((r) => r.count !== 1)
          .map((r) => (
            <Tooltip key={r.from} label={`${r.count === 0 ? 'Celah' : 'Tumpang tindih'} ${minutesToLabel(r.from)}–${minutesToLabel(r.to)}`}>
              <Box
                pos="absolute"
                top={0}
                bottom={0}
                left={pct(r.from)}
                w={pct(r.to - r.from)}
                style={{
                  background: r.count === 0 ? 'repeating-linear-gradient(45deg,#ced4da,#ced4da 4px,#f1f3f5 4px,#f1f3f5 8px)' : '#e03131',
                  borderRadius: 2,
                }}
              />
            </Tooltip>
          ))}
        {gaps.length === 0 && overlaps.length === 0 && shifts.length > 0 && (
          <Box pos="absolute" inset={0} style={{ background: '#b2f2bb', borderRadius: 4 }} />
        )}
      </Track>
      <Text size="xs" c="dimmed">
        {gaps.length === 0 ? 'Seluruh 24 jam tercakup.' : `Celah tanpa shift: ${gaps.map((g) => `${minutesToLabel(g.from)}–${minutesToLabel(g.to)}`).join(', ')}.`}{' '}
        {overlaps.length > 0 && (
          <Text span c="red" size="xs" fw={600}>
            Tumpang tindih: {overlaps.map((g) => `${minutesToLabel(g.from)}–${minutesToLabel(g.to)}`).join(', ')}.
          </Text>
        )}
      </Text>
    </Stack>
  );
}
