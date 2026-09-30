import type { RoleCode } from '@/lib/api/types';

// Mirrors the access rules of the backend. The server still enforces every
// rule; this only decides which menus and buttons are shown.
//
// | Menu                                        | super_admin | security_manager | security_head / security_admin |
// | Dashboard, Monitoring, Titik per Shift,     |      ✓      |        ✓         |               ✓                |
// |   Riwayat Scan, Laporan, Help Desk, Profil  |             |                  |                                |
// | Titik Patroli, Pengaturan Shift, Pengguna,  |      ✓      |        ✓         |                                |
// |   Role                                      |             |                  |                                |
// | App Client, Log Aktivitas                   |      ✓      |                  |                                |
// security_team (and any custom role) cannot use the web admin at all.

const WEB_USERS: RoleCode[] = ['super_admin', 'security_manager', 'security_admin', 'security_head'];
const MANAGERS: RoleCode[] = ['super_admin', 'security_manager'];
const SUPER_ADMIN: RoleCode[] = ['super_admin'];

export const PERMISSIONS = {
  webAccess: WEB_USERS,
  viewPatrol: WEB_USERS,
  managePatrolPoints: MANAGERS,
  manageShifts: MANAGERS,
  manageUsers: MANAGERS,
  viewRoles: MANAGERS,
  // Creating, editing and deleting roles stays with the Super-Admin (backend rule).
  manageRoles: SUPER_ADMIN,
  manageSuperAdmins: SUPER_ADMIN,
  manageAppClients: SUPER_ADMIN,
  // The backend also allows security_manager; the menu is kept to the Super-Admin on purpose.
  viewAuditLogs: SUPER_ADMIN,
  viewHelpDeskDrafts: WEB_USERS,
  manageHelpDesk: WEB_USERS,
  // Needs GET /users, which only the roles with the Pengguna menu may call.
  filterScansByOfficer: MANAGERS,
} as const satisfies Record<string, RoleCode[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(roleCode: string | null | undefined, permission: Permission): boolean {
  if (!roleCode) return false;
  const roles: readonly string[] = PERMISSIONS[permission];
  return roles.includes(roleCode);
}

export const SUPER_ADMIN_ROLE = 'super_admin';
