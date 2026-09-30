import { Badge, Button, Card, Code, Drawer, Group, SegmentedControl, Select, Table, Text } from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { auditLogsApi } from '@/api/auditLogs';
import { DateRangeFilter, OfficerSelect } from '@/components/Filters';
import { PageHeader } from '@/components/PageHeader';
import { PaginationBar } from '@/components/PaginationBar';
import { SearchInput } from '@/components/SearchInput';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/StateViews';
import { toNumber, toPage, useUrlFilters } from '@/hooks/useUrlFilters';
import type { AuditAction, AuditLog } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';

const ACTIONS: Record<AuditAction, { label: string; color: string }> = {
  create: { label: 'Tambah', color: 'green' },
  update: { label: 'Ubah', color: 'blue' },
  delete: { label: 'Hapus', color: 'red' },
};

// `resource` is the first segment of the API path (backend middleware/audit.go).
const RESOURCES: Record<string, string> = {
  users: 'Pengguna',
  roles: 'Role',
  'app-clients': 'App Client',
  'patrol-points': 'Titik Patroli',
  'patrol-shifts': 'Shift',
  'patrol-scans': 'Scan Patroli',
  'help-desk-articles': 'Help Desk',
  auth: 'Akun',
};

const ROLES: Record<string, string> = {
  super_admin: 'Super-Admin',
  security_manager: 'Manager Keamanan',
  security_head: 'Kepala Keamanan',
  security_admin: 'Admin Keamanan',
  security_team: 'Tim Keamanan',
};

const resourceLabel = (resource: string) => RESOURCES[resource] ?? resource;

function ActionBadge({ action }: { action: AuditAction }) {
  const a = ACTIONS[action] ?? { label: action, color: 'gray' };
  return (
    <Badge color={a.color} variant="light" style={{ flexShrink: 0, minWidth: 'fit-content' }}>
      {a.label}
    </Badge>
  );
}

function Actor({ log }: { log: AuditLog }) {
  if (!log.user) {
    return (
      <Text size="sm" c="dimmed">
        {log.source === 'cli' ? 'Sistem (CLI)' : '-'}
      </Text>
    );
  }
  return (
    <>
      <Text size="sm" fw={600}>{log.user.name}</Text>
      <Text size="xs" c="dimmed">{ROLES[log.user.role_code] ?? log.user.role_code}</Text>
    </>
  );
}

function LogDetail({ log, onClose }: { log: AuditLog | null; onClose: () => void }) {
  const rows: [string, ReactNode][] = log
    ? [
        ['Waktu', formatDateTime(log.created_at)],
        ['Aksi', <ActionBadge action={log.action} />],
        ['Data', `${resourceLabel(log.resource)}${log.resource_id ? ` #${log.resource_id}` : ''}`],
        ['Pengguna', log.user ? `${log.user.name} (${log.user.email}) · ${ROLES[log.user.role_code] ?? log.user.role_code}` : log.source === 'cli' ? 'Sistem (CLI)' : '-'],
        ['Endpoint', <Code>{log.endpoint}</Code>],
        ['Path', <Code>{log.path}</Code>],
        ['Status', log.status_code],
        ['Sumber', log.source === 'cli' ? 'CLI' : 'API'],
        ['Platform', log.app_platform || '-'],
        ['Alamat IP', log.ip_address || '-'],
        ['User agent', <Text size="xs" style={{ wordBreak: 'break-all' }}>{log.user_agent || '-'}</Text>],
      ]
    : [];
  return (
    <Drawer opened={log !== null} onClose={onClose} position="right" size="md" title={<Text fw={700}>Detail Log #{log?.id}</Text>}>
      <Table withRowBorders={false} verticalSpacing={6}>
        <Table.Tbody>
          {rows.map(([label, value]) => (
            <Table.Tr key={label}>
              <Table.Th w={110} fw={500} c="dimmed" style={{ verticalAlign: 'top' }}>{label}</Table.Th>
              <Table.Td>{value}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Text size="xs" c="dimmed" mt="md">Isi request tidak disimpan oleh server; log hanya mencatat siapa, kapan, apa, dan dari mana.</Text>
    </Drawer>
  );
}

const KEYS = ['search', 'user_id', 'action', 'resource', 'date_from', 'date_to', 'page', 'limit'] as const;

export default function AuditLogsPage() {
  const { filters, setFilters, resetFilters } = useUrlFilters(KEYS, { limit: '20' });
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const params = {
    search: filters.search,
    user_id: toNumber(filters.user_id),
    action: (filters.action || undefined) as AuditAction | undefined,
    resource: filters.resource,
    date_from: filters.date_from,
    date_to: filters.date_to,
    page: toPage(filters.page),
    limit: Number(filters.limit) || 20,
  };
  const query = useQuery({ queryKey: ['audit-logs', params], queryFn: () => auditLogsApi.list(params), placeholderData: keepPreviousData });
  const hasFilter = KEYS.some((k) => k !== 'page' && k !== 'limit' && filters[k]);

  return (
    <>
      <PageHeader title="Log Aktivitas" description="Riwayat tambah, ubah, dan hapus data: siapa, kapan, dan dari mana. Terbaru dulu." />
      <Card withBorder radius="md">
        <Group mb="md" gap="sm">
          <SearchInput value={filters.search} onChange={(search) => setFilters({ search })} placeholder="Cari path, IP, atau ID data" />
          <OfficerSelect value={filters.user_id} onChange={(user_id) => setFilters({ user_id })} label="pengguna" />
          <Select
            aria-label="Filter data"
            placeholder="Semua data"
            data={Object.entries(RESOURCES).map(([value, label]) => ({ value, label }))}
            value={filters.resource || null}
            onChange={(resource) => setFilters({ resource })}
            clearable
            w={180}
          />
          <SegmentedControl
            aria-label="Filter aksi"
            value={filters.action}
            onChange={(action) => setFilters({ action })}
            data={[
              { value: '', label: 'Semua' },
              { value: 'create', label: 'Tambah' },
              { value: 'update', label: 'Ubah' },
              { value: 'delete', label: 'Hapus' },
            ]}
          />
          <DateRangeFilter placeholder="Tanggal log" from={filters.date_from} to={filters.date_to} onChange={(date_from, date_to) => setFilters({ date_from, date_to })} />
          {hasFilter && (
            <Button variant="subtle" size="xs" onClick={resetFilters}>
              Reset filter
            </Button>
          )}
        </Group>
        {query.isPending ? (
          <TableSkeleton cols={6} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <EmptyState title="Tidak ada log" description={hasFilter ? 'Coba ubah filter.' : 'Log tercatat otomatis setiap ada data yang ditambah, diubah, atau dihapus.'} />
        ) : (
          <Table.ScrollContainer minWidth={980}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Waktu</Table.Th>
                  <Table.Th>Pengguna</Table.Th>
                  <Table.Th>Aksi</Table.Th>
                  <Table.Th>Data</Table.Th>
                  <Table.Th>Endpoint</Table.Th>
                  <Table.Th>Platform</Table.Th>
                  <Table.Th>IP</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {query.data.items.map((log) => (
                  <Table.Tr
                    key={log.id}
                    onClick={() => setSelected(log)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSelected(log))}
                    tabIndex={0}
                    role="button"
                    aria-label={`Detail log ${log.id}`}
                    style={{ cursor: 'pointer' }}
                  >
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(log.created_at)}</Table.Td>
                    <Table.Td><Actor log={log} /></Table.Td>
                    <Table.Td><ActionBadge action={log.action} /></Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {resourceLabel(log.resource)}
                        {log.resource_id && <Text span c="dimmed"> #{log.resource_id}</Text>}
                      </Text>
                    </Table.Td>
                    <Table.Td><Text size="xs" ff="monospace">{log.endpoint}</Text></Table.Td>
                    <Table.Td>
                      {log.source === 'cli' ? <Badge variant="outline" color="gray">CLI</Badge> : <Text size="sm">{log.app_platform || '-'}</Text>}
                    </Table.Td>
                    <Table.Td><Text size="xs" ff="monospace">{log.ip_address || '-'}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
        <PaginationBar pagination={query.data?.pagination} onPageChange={(page) => setFilters({ page })} onLimitChange={(limit) => setFilters({ limit })} />
      </Card>
      <LogDetail log={selected} onClose={() => setSelected(null)} />
    </>
  );
}
