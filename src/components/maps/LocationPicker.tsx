import type { LeafletEvent, Marker as LeafletMarker } from 'leaflet';
import { useMemo } from 'react';
import { Circle, Marker, useMapEvents } from 'react-leaflet';
import { FitBounds, MapBase, pinIcon } from './MapBase';

interface Props {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  onChange: (lat: number, lng: number) => void;
}

function round(value: number) {
  return Math.round(value * 1e7) / 1e7;
}

function ClickToPlace({ onChange }: { onChange: Props['onChange'] }) {
  useMapEvents({
    click: (e) => onChange(round(e.latlng.lat), round(e.latlng.lng)),
  });
  return null;
}

export function LocationPicker({ latitude, longitude, radiusMeters, onChange }: Props) {
  const valid =
    latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
  const position: [number, number] | null = valid ? [latitude, longitude] : null;
  const icon = useMemo(() => pinIcon('#1c7ed6'), []);

  return (
    <MapBase ariaLabel="Pemilih lokasi titik patroli. Klik peta atau geser penanda untuk memilih lokasi." height={340} center={position ?? undefined}>
      <ClickToPlace onChange={onChange} />
      {position && (
        <>
          {/* Pans to coordinates typed outside the current view. */}
          <FitBounds points={[position]} fitKey={`${position[0].toFixed(4)},${position[1].toFixed(4)}`} />
          <Circle center={position} radius={radiusMeters} pathOptions={{ color: '#1c7ed6', weight: 1, fillOpacity: 0.12 }} />
          <Marker
            position={position}
            draggable
            icon={icon}
            keyboard
            title="Geser untuk memindahkan lokasi"
            eventHandlers={{
              dragend: (e: LeafletEvent) => {
                const ll = (e.target as LeafletMarker).getLatLng();
                onChange(round(ll.lat), round(ll.lng));
              },
            }}
          />
        </>
      )}
    </MapBase>
  );
}
