import { Button, Center, Loader, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ErrorState } from '@/components/StateViews';
import { useSession } from '@/hooks/useSession';
import { session } from '@/lib/auth/session';
import { isLicenseLocked } from '@/lib/license';
import { hasPermission, SUPER_ADMIN_ROLE, type Permission } from '@/lib/permissions';
import { LicenseLockedLayout } from './LicenseScreens';
import { ForbiddenPage } from '@/pages/ErrorPages';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, endReason, bootError, user, license } = useSession();
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
    // Sessions ended by the server for a reason the login page explains.
    if (endReason === 'license_inactive' || endReason === 'unit_over_license' || endReason === 'unit_inactive') params.set('reason', endReason);
    const qs = params.toString();
    return <Navigate to={`/login${qs ? `?${qs}` : ''}`} replace />;
  }

  // A locked license leaves only the License page (the server lets only the Super-Admin in).
  if (isLicenseLocked(license?.status) && user?.role.code === SUPER_ADMIN_ROLE) return <LicenseLockedLayout />;

  return <>{children}</>;
}

export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { user } = useSession();
  if (!hasPermission(user?.role.code, permission)) return <ForbiddenPage />;
  return <>{children}</>;
}
