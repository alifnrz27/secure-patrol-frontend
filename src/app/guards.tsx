import { Button, Center, Loader, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ErrorState } from '@/components/StateViews';
import { useSession } from '@/hooks/useSession';
import { session } from '@/lib/auth/session';
import { hasPermission, type Permission } from '@/lib/permissions';
import { ForbiddenPage } from '@/pages/ErrorPages';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, endReason, bootError } = useSession();
  const location = useLocation();

  if (status === 'loading') {
    if (bootError) {
      return (
        <Center h="100vh" p="md">
          <Stack maw={420}>
            <ErrorState error={bootError} />
            <Button onClick={() => void session.restore()}>Coba lagi</Button>
          </Stack>
        </Center>
      );
    }
    return (
      <Center h="100vh">
        <Stack align="center" gap="xs">
          <Loader />
          <Text size="sm" c="dimmed">Memuat sesi…</Text>
        </Stack>
      </Center>
    );
  }

  if (status === 'unauthenticated') {
    const params = new URLSearchParams();
    const target = location.pathname + location.search;
    if (target !== '/') params.set('redirect', target);
    if (endReason === 'expired') params.set('expired', '1');
    const qs = params.toString();
    return <Navigate to={`/login${qs ? `?${qs}` : ''}`} replace />;
  }

  return <>{children}</>;
}

export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { user } = useSession();
  if (!hasPermission(user?.role.code, permission)) return <ForbiddenPage />;
  return <>{children}</>;
}
