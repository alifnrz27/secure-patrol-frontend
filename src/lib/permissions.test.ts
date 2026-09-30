import { describe, expect, it } from 'vitest';
import { hasPermission, isHeadOfficeRole, type Permission } from './permissions';

const ALL: Permission[] = [
  'viewPatrol', 'viewUnits', 'manageUnits', 'viewPatrolPoints', 'managePatrolPoints', 'viewShifts', 'manageShifts',
  'viewUsers', 'manageUsers', 'manageHeadOfficeUsers', 'viewRoles', 'manageRoles', 'manageAppClients', 'viewAuditLogs',
  'viewSettings', 'editSettings', 'viewHelpDeskDrafts', 'manageHelpDesk', 'filterScansByOfficer',
];
const granted = (role: string) => ALL.filter((p) => hasPermission(role, p));

describe('multi-unit access', () => {
  it('super_admin manages the head office data but not patrol points and shifts', () => {
    expect(granted('super_admin')).toEqual(ALL.filter((p) => p !== 'managePatrolPoints' && p !== 'manageShifts'));
  });

  it('security_manager only reads', () => {
    expect(granted('security_manager')).toEqual([
      'viewPatrol', 'viewUnits', 'viewPatrolPoints', 'viewShifts', 'viewUsers', 'viewRoles', 'viewAuditLogs', 'viewSettings',
      'viewHelpDeskDrafts', 'filterScansByOfficer',
    ]);
  });

  it.each(['security_head', 'security_admin'])('%s manages its own unit', (role) => {
    expect(granted(role)).toEqual([
      'viewPatrol', 'viewPatrolPoints', 'managePatrolPoints', 'viewShifts', 'manageShifts', 'viewUsers', 'manageUsers',
      'viewRoles', 'viewSettings', 'editSettings', 'filterScansByOfficer',
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
