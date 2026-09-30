import { Group, Pagination, Select, Text } from '@mantine/core';
import type { Pagination as PaginationInfo } from '@/lib/api/types';

interface Props {
  pagination: PaginationInfo | undefined;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
}

export function PaginationBar({ pagination, onPageChange, onLimitChange }: Props) {
  if (!pagination || pagination.total === 0) return null;
  const from = (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.page * pagination.limit, pagination.total);
  return (
    <Group justify="space-between" mt="md" wrap="wrap">
      <Group gap="xs">
        <Text size="sm" c="dimmed">
          {from}–{to} dari {pagination.total} data
        </Text>
        {onLimitChange && (
          <Select
            aria-label="Jumlah per halaman"
            size="xs"
            w={80}
            data={['10', '20', '50', '100']}
            value={String(pagination.limit)}
            onChange={(v) => v && onLimitChange(Number(v))}
            allowDeselect={false}
          />
        )}
      </Group>
      {pagination.total_pages > 1 && (
        <Pagination
          size="sm"
          total={pagination.total_pages}
          value={pagination.page}
          onChange={onPageChange}
          getControlProps={(control) => ({ 'aria-label': control === 'next' ? 'Halaman berikutnya' : control === 'previous' ? 'Halaman sebelumnya' : control })}
        />
      )}
    </Group>
  );
}
