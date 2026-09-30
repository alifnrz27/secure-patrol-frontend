import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { unitsApi } from '@/api/units';
import type { Unit } from '@/lib/api/types';
import { isHeadOfficeRole } from '@/lib/permissions';
import { unitScope } from '@/lib/unitScope';
import { useSession } from './useSession';

/** Every unit the user can see (head office: all; unit users: their own). */
export function useUnits() {
  const { status } = useSession();
  return useQuery({
    queryKey: ['units', 'all'],
    queryFn: () => unitsApi.list({ limit: 100 }),
    select: (data) => data.items,
    staleTime: 60_000,
    enabled: status === 'authenticated',
  });
}

export interface UnitScope {
  /** Super-Admin or Manager Keamanan: sees every unit and has the unit picker. */
  isHeadOffice: boolean;
  /** unit_id to send: the picked unit for head office users, undefined otherwise. */
  unitId: number | undefined;
  setUnitId: (unitId: number | null) => void;
  /** Head office user with "Semua unit": lists mix units, so show a Unit column. */
  showUnitColumn: boolean;
  units: Unit[];
  unitName: (unitId: number | null | undefined) => string;
  /** Map center for new items: the user's unit, else the picked unit. */
  defaultCenter: [number, number] | undefined;
}

export function useUnitScope(): UnitScope {
  const { user } = useSession();
  const picked = useSyncExternalStore(unitScope.subscribe, unitScope.get);
  const units = useUnits();
  const isHeadOffice = isHeadOfficeRole(user?.role.code);
  const list = useMemo(() => units.data ?? [], [units.data]);
  // Ignore a stored unit that no longer exists (deleted or not visible).
  const unitId = isHeadOffice && picked && (!units.data || list.some((u) => u.id === picked)) ? picked : undefined;

  const unitName = useCallback(
    (id: number | null | undefined) => {
      if (id === null || id === undefined) return 'Pusat';
      return list.find((u) => u.id === id)?.name ?? (user?.unit?.id === id ? user.unit.name : `Unit #${id}`);
    },
    [list, user?.unit],
  );

  const own = user?.unit ?? list.find((u) => u.id === unitId);
  return {
    isHeadOffice,
    unitId,
    setUnitId: unitScope.set,
    showUnitColumn: isHeadOffice && !unitId,
    units: list,
    unitName,
    defaultCenter: own ? [own.latitude, own.longitude] : undefined,
  };
}
