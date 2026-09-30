import { createBrowserRouter, Outlet } from 'react-router-dom';
import { AppLayout } from '@/app/AppLayout';
import { RequireAuth, RequirePermission } from '@/app/guards';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/ErrorPages';
import type { Permission } from '@/lib/permissions';
import type { ComponentType } from 'react';

type PageModule = Promise<{ default: ComponentType }>;

function page(load: () => PageModule, permission?: Permission) {
  return {
    lazy: async () => {
      const { default: Component } = await load();
      return {
        Component: permission
          ? () => (
              <RequirePermission permission={permission}>
                <Component />
              </RequirePermission>
            )
          : Component,
      };
    },
  };
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppLayout>
          <Outlet />
        </AppLayout>
      </RequireAuth>
    ),
    children: [
      { index: true, ...page(() => import('@/pages/dashboard/DashboardPage'), 'viewPatrol') },
      { path: 'monitoring', ...page(() => import('@/pages/monitoring/MonitoringPage'), 'viewPatrol') },
      { path: 'monitoring/:id', ...page(() => import('@/pages/monitoring/GroupDetailPage'), 'viewPatrol') },
      { path: 'checkpoints', ...page(() => import('@/pages/checkpoints/CheckpointsPage'), 'viewPatrol') },
      { path: 'scans', ...page(() => import('@/pages/scans/ScansPage'), 'viewPatrol') },
      { path: 'reports', ...page(() => import('@/pages/reports/ReportsPage'), 'viewPatrol') },
      { path: 'patrol-points', ...page(() => import('@/pages/patrol-points/PatrolPointsPage'), 'managePatrolPoints') },
      { path: 'shifts', ...page(() => import('@/pages/shifts/ShiftsPage'), 'manageShifts') },
      { path: 'users', ...page(() => import('@/pages/users/UsersPage'), 'manageUsers') },
      { path: 'roles', ...page(() => import('@/pages/roles/RolesPage'), 'viewRoles') },
      { path: 'app-clients', ...page(() => import('@/pages/app-clients/AppClientsPage'), 'manageAppClients') },
      { path: 'audit-logs', ...page(() => import('@/pages/audit-logs/AuditLogsPage'), 'viewAuditLogs') },
      { path: 'help-desk', ...page(() => import('@/pages/help-desk/HelpDeskPage'), 'viewPatrol') },
      { path: 'profile', ...page(() => import('@/pages/profile/ProfilePage'), 'webAccess') },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
