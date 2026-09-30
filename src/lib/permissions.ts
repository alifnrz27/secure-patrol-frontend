import type { RoleCode } from '@/lib/api/types';

// Mirrors the multi-unit access rules of the backend. The server still
// enforces every rule; this only decides which menus and buttons are shown.
//
// Head office (no unit): super_admin, security_manager — see every unit.
// Unit users: security_head, security_admin — see only their own unit.
// security_team (and custom roles) cannot use the web admin.
//
// | Fitur                                     | super_admin | security_manager | security_head / security_admin |
// | Dashboard, Monitoring, Titik per Shift,   |  semua unit |    semua unit    |          unit sendiri          |
// |   Riwayat Scan, Laporan, Export           |             |                  |                                |
// | Unit: lihat / kelola                      |    ✓ / ✓    |      ✓ / ✓       |             - / -              |
// | Titik Patroli, Shift: lihat / kelola      |    ✓ / -    |      ✓ / -       |             ✓ / ✓              |
// | Pengguna: lihat / kelola                  |    ✓ / ✓    |      ✓ / ✓       |   ✓ / ✓ (role unit saja)       |
// | Role (menu): lihat / kelola               |    ✓ / ✓    |                  |                                |
// | App Client                                |      ✓      |                  |                                |
// | Log Aktivitas                             |      ✓      |                  |                                |
// | Pengaturan: lihat / ubah                  | ✓ / global  |      ✓ / -       |       ✓ / unit sendiri         |
// | Help Desk: draft / kelola                 |    ✓ / ✓    |      ✓ / -       |             - / -              |

export const HEAD_OFFICE_ROLES: RoleCode[] = ['super_admin', 'security_manager'];
const WEB_USERS: RoleCode[] = ['super_admin', 'security_manager', 'security_admin', 'security_head'];
const UNIT_MANAGERS: RoleCode[] = ['security_head', 'security_admin'];
const SUPER_ADMIN: RoleCode[] = ['super_admin'];

export const PERMISSIONS = {
  webAccess: WEB_USERS,
  viewPatrol: WEB_USERS,
  viewUnits: HEAD_OFFICE_ROLES,
  // Both head office roles manage the unit master data; unit roles cannot even open it.
  manageUnits: HEAD_OFFICE_ROLES,
  viewPatrolPoints: WEB_USERS,
  managePatrolPoints: UNIT_MANAGERS,
  viewShifts: WEB_USERS,
  manageShifts: UNIT_MANAGERS,
  viewUsers: WEB_USERS,
  // The Manager manages users like the Super-Admin (head office users, any unit).
  manageUsers: [...HEAD_OFFICE_ROLES, ...UNIT_MANAGERS],
  /** Assign head office roles (super_admin, security_manager) and pick a user's unit. */
  manageHeadOfficeUsers: HEAD_OFFICE_ROLES,
  // Menu only: the user form still reads GET /roles for its role list.
  viewRoles: SUPER_ADMIN,
  manageRoles: SUPER_ADMIN,
  manageAppClients: SUPER_ADMIN,
  viewAuditLogs: SUPER_ADMIN,
  viewSettings: WEB_USERS,
  /** Super-Admin edits the global values, unit managers the values of their unit. */
  editSettings: [...SUPER_ADMIN, ...UNIT_MANAGERS],
  viewHelpDeskDrafts: HEAD_OFFICE_ROLES,
  manageHelpDesk: SUPER_ADMIN,
  // GET /users is scoped by the server, so every web role can filter by officer.
  filterScansByOfficer: WEB_USERS,
} as const satisfies Record<string, RoleCode[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(roleCode: string | null | undefined, permission: Permission): boolean {
  if (!roleCode) return false;
  const roles: readonly string[] = PERMISSIONS[permission];
  return roles.includes(roleCode);
}

export function isHeadOfficeRole(roleCode: string | null | undefined): boolean {
  return Boolean(roleCode) && (HEAD_OFFICE_ROLES as readonly string[]).includes(roleCode!);
}

export const SUPER_ADMIN_ROLE = 'super_admin';
