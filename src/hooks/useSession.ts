import { useSyncExternalStore } from 'react';
import { session, type SessionState } from '@/lib/auth/session';
import { hasPermission, type Permission } from '@/lib/permissions';

export function useSession(): SessionState {
  return useSyncExternalStore(session.subscribe, session.getState);
}

export function usePermission(permission: Permission): boolean {
  const { user } = useSession();
  return hasPermission(user?.role.code, permission);
}

export function useAppConfig() {
  return useSession().config;
}
