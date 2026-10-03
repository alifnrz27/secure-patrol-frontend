import { Badge, Tooltip } from '@mantine/core';
import { usePermission } from '@/hooks/useSession';
import { useLicense } from '@/pages/settings/LicensePage';

/** "3 dari 5 unit aktif" from GET /license (Super-Admin only). */
export function LicenseQuota({ kind }: { kind: 'units' | 'app_clients' }) {
  const canSee = usePermission('manageLicense');
  const license = useLicense(canSee);
  // Without an installed license there is no limit to show.
  if (!canSee || !license.data?.license) return null;
  const { used, max } = license.data.limits[kind];
  const over = license.data.over_limit[kind];
  const noun = kind === 'units' ? 'unit aktif' : 'App Client aktif';
  return (
    <Tooltip label={over ? `Melebihi license: ${noun} terbaru tidak berfungsi` : 'Batas dari license'}>
      <Badge size="lg" variant="light" color={over ? 'red' : used >= max ? 'orange' : 'gray'}>
        {used} dari {max} {noun}
      </Badge>
    </Tooltip>
  );
}
