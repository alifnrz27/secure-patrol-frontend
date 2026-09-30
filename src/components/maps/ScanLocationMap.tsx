import { useMemo } from 'react';
import { Circle, Marker, Polyline, Tooltip } from 'react-leaflet';
import { FitBounds, MapBase, pinIcon } from './MapBase';

interface Props {
  point: { latitude: number; longitude: number; name: string } | null;
  scan: { latitude: number; longitude: number };
  radiusMeters: number;
  locationValid: boolean;
}

export function ScanLocationMap({ point, scan, radiusMeters, locationValid }: Props) {
  const pointIcon = useMemo(() => pinIcon('#1c7ed6', 'T'), []);
  const scanIcon = useMemo(() => pinIcon(locationValid ? '#2f9e44' : '#e03131', 'S'), [locationValid]);
  const scanPos: [number, number] = [scan.latitude, scan.longitude];
  const pointPos: [number, number] | null = point ? [point.latitude, point.longitude] : null;
  const all = pointPos ? [pointPos, scanPos] : [scanPos];

  return (
    <MapBase ariaLabel="Peta posisi titik patroli dan posisi scan" height={300} center={scanPos}>
      <FitBounds points={all} fitKey={all.flat().join(',')} />
      {pointPos && (
        <>
          <Circle center={pointPos} radius={radiusMeters} pathOptions={{ color: '#1c7ed6', weight: 1, fillOpacity: 0.1 }} />
          <Marker position={pointPos} icon={pointIcon}>
            <Tooltip>Titik: {point!.name}</Tooltip>
          </Marker>
          <Polyline positions={[pointPos, scanPos]} pathOptions={{ color: '#495057', dashArray: '4 6', weight: 2 }} />
        </>
      )}
      <Marker position={scanPos} icon={scanIcon}>
        <Tooltip>Posisi scan</Tooltip>
      </Marker>
    </MapBase>
  );
}
