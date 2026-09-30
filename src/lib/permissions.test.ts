import { describe, expect, it } from 'vitest';
import { hasPermission, type Permission } from './permissions';

const MENUS: [string, Permission][] = [
  ['Dashboard/Monitoring/Titik per Shift/Riwayat Scan/Laporan', 'viewPatrol'],
  ['Help Desk', 'manageHelpDesk'],
  ['Titik Patroli', 'managePatrolPoints'],
  ['Pengaturan Shift', 'manageShifts'],
  ['Pengguna', 'manageUsers'],
  ['Role', 'viewRoles'],
  ['App Client', 'manageAppClients'],
  ['Log Aktivitas', 'viewAuditLogs'],
];

function menusOf(role: string) {
  return MENUS.filter(([, p]) => hasPermission(role, p)).map(([name]) => name);
}

describe('menu access per role', () => {
  it('super_admin sees everything', () => {
    expect(menusOf('super_admin')).toEqual(MENUS.map(([n]) => n));
  });

  it('security_manager sees everything except App Client and Log Aktivitas', () => {
    expect(menusOf('security_manager')).toEqual(MENUS.map(([n]) => n).filter((n) => n !== 'App Client' && n !== 'Log Aktivitas'));
  });

  it.each(['security_head', 'security_admin'])('%s sees only the monitoring menus and Help Desk', (role) => {
    expect(menusOf(role)).toEqual(['Dashboard/Monitoring/Titik per Shift/Riwayat Scan/Laporan', 'Help Desk']);
  });

  it.each(['security_team', 'custom_role', ''])('%s has no web access', (role) => {
    expect(hasPermission(role, 'webAccess')).toBe(false);
    expect(menusOf(role)).toEqual([]);
  });
});
