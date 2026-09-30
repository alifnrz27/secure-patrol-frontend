import { CircleMarker, Tooltip } from 'react-leaflet';
import { CONDITION_LABEL, STATUS_COLORS } from '@/components/Badges';
import type { PatrolListItem } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import { FitBounds, MapBase } from './MapBase';

function statusColor(item: PatrolListItem): string {
  if (!item.is_scanned || !item.last_condition) return STATUS_COLORS.unscanned;
  return STATUS_COLORS[item.last_condition];
}

export function PointsStatusMap({ items, height = 380 }: { items: PatrolListItem[]; height?: number }) {
  const points = items.map((i) => [i.latitude, i.longitude] as [number, number]);
  return (
    <MapBase ariaLabel="Peta status titik patroli" height={height} center={points[0]}>
      <FitBounds points={points} fitKey={items.map((i) => i.id).join(',')} />
      {items.map((item) => (
        <CircleMarker
          key={item.id}
          center={[item.latitude, item.longitude]}
          radius={10}
          pathOptions={{ color: '#fff', weight: 2, fillColor: statusColor(item), fillOpacity: 0.95 }}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            <strong>{item.name}</strong>
            <br />
            {item.location}
            <br />
            {item.is_scanned && item.last_condition
              ? `${CONDITION_LABEL[item.last_condition]} · ${formatDateTime(item.last_scanned_at)} · ${item.last_scanned_by?.name ?? '-'}`
              : 'Belum di-scan'}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapBase>
  );
}
