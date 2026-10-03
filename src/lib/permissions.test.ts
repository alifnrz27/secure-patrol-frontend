import { describe, expect, it } from 'vitest';
import { hasPermission, isHeadOfficeRole, type Permission } from './permissions';

const ALL: Permission[] = [
  'viewPatrol', 'viewUnits', 'manageUnits', 'viewAreas', 'manageAreas', 'viewPatrolPoints', 'managePatrolPoints', 'viewShifts', 'manageShifts',
  'viewUsers', 'manageUsers', 'manageHeadOfficeUsers', 'viewRoles', 'manageRoles', 'manageAppClients', 'viewAuditLogs',
  'viewSettings', 'editSettings', 'viewHelpDeskDrafts', 'manageHelpDesk', 'filterScansByOfficer', 'manageBranding', 'manageLicense',
];
const granted = (role: string) => ALL.filter((p) => hasPermission(role, p));

describe('multi-unit access', () => {
  it('super_admin manages the head office data but not patrol points and shifts', () => {
    expect(granted('super_admin')).toEqual(ALL.filter((p) => p !== 'manageAreas' && p !== 'managePatrolPoints' && p !== 'manageShifts'));
  });

  it('security_manager views units and manages users like the Super-Admin, without roles, app clients and audit log', () => {
    expect(granted('security_manager')).toEqual([
      'viewPatrol', 'viewUnits', 'viewAreas', 'viewPatrolPoints', 'viewShifts', 'viewUsers', 'manageUsers', 'manageHeadOfficeUsers',
      'viewSettings', 'viewHelpDeskDrafts', 'filterScansByOfficer',
    ]);
  });

  it.each(['security_head', 'security_admin'])('%s manages its own unit', (role) => {
    expect(granted(role)).toEqual([
      'viewPatrol', 'viewAreas', 'manageAreas', 'viewPatrolPoints', 'managePatrolPoints', 'viewShifts', 'manageShifts', 'viewUsers', 'manageUsers',
      'viewSettings', 'editSettings', 'filterScansByOfficer',
    ]);
  });

  it.each(['security_team', 'custom_role', ''])('%s has no web access', (role) => {
    expect(hasPermission(role, 'webAccess')).toBe(false);
    expect(granted(role)).toEqual([]);
  });

  it('knows head office roles', () => {
    expect(isHeadOfficeRole('super_admin')).toBe(true);
    expect(isHeadOfficeRole('security_manager')).toBe(true);
    expect(isHeadOfficeRole('security_head')).toBe(false);
  });
});
