import L, { type LatLngExpression } from 'leaflet';
import { useEffect, type ReactNode } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';

export const DEFAULT_CENTER: [number, number] = [-6.2, 106.816666]; // Jakarta

export function pinIcon(color: string, label?: string) {
  return L.divIcon({
    className: 'sp-pin',
    html: `<span class="sp-pin__dot" style="background:${color}">${label ?? ''}</span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

/** Fits the view to the given points whenever their key changes. */
export function FitBounds({ points, fitKey }: { points: [number, number][]; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      // Only pan when the point left the view, so dragging does not reset zoom.
      if (!map.getBounds().contains(points[0]!)) map.setView(points[0]!, Math.max(map.getZoom(), 16));
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 18 });
  }, [fitKey, map]);
  return null;
}

interface MapBaseProps {
  center?: LatLngExpression;
  zoom?: number;
  height?: number | string;
  children?: ReactNode;
  ariaLabel: string;
}

export function MapBase({ center = DEFAULT_CENTER, zoom = 16, height = 360, children, ariaLabel }: MapBaseProps) {
  return (
    // `isolation: isolate` keeps Leaflet's internal z-indexes (400–1000) inside
    // the map, so drawers, modals and menus are never covered by it.
    <div role="region" aria-label={ariaLabel} style={{ height, borderRadius: 8, overflow: 'hidden', position: 'relative', isolation: 'isolate', zIndex: 0 }}>
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        {children}
      </MapContainer>
    </div>
  );
}
