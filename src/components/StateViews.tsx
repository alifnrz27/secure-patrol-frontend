import { Alert, Button, Center, Group, Skeleton, Stack, Table, Text } from '@mantine/core';
import { IconAlertTriangle, IconInbox, IconLock, IconRefresh } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { describeError, isApiError } from '@/lib/api/errors';

export function ErrorState({ error, onRetry, compact }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  const forbidden = isApiError(error) && error.kind === 'forbidden';
  return (
    <Alert
      color={forbidden ? 'orange' : 'red'}
      variant="light"
      icon={forbidden ? <IconLock size={18} /> : <IconAlertTriangle size={18} />}
      title={forbidden ? 'Anda tidak memiliki akses' : 'Gagal memuat data'}
      my={compact ? 0 : 'md'}
    >
      <Stack gap="xs" align="flex-start">
        <Text size="sm">{describeError(error)}</Text>
        {onRetry && !forbidden && (
          <Button size="xs" variant="light" color="red" leftSection={<IconRefresh size={14} />} onClick={onRetry}>
            Coba lagi
          </Button>
        )}
      </Stack>
    </Alert>
  );
}

export function EmptyState({ title = 'Belum ada data', description, action }: { title?: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <Center py="xl">
      <Stack align="center" gap={6}>
        <IconInbox size={36} stroke={1.4} color="var(--mantine-color-dimmed)" />
        <Text fw={600}>{title}</Text>
        {description && (
          <Text size="sm" c="dimmed" ta="center" maw={420}>
            {description}
          </Text>
        )}
        {action}
      </Stack>
    </Center>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <Table aria-busy="true" aria-label="Memuat data">
      <Table.Tbody>
        {Array.from({ length: rows }, (_, r) => (
          <Table.Tr key={r}>
            {Array.from({ length: cols }, (_, c) => (
              <Table.Td key={c}>
                <Skeleton height={14} radius="sm" width={c === 0 ? '70%' : '90%'} />
              </Table.Td>
            ))}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

export function CardsSkeleton({ count = 4, height = 96 }: { count?: number; height?: number }) {
  return (
    <Group grow align="stretch" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height={height} radius="md" />
      ))}
    </Group>
  );
}
