
// src/lib/leaflet-default-icon.ts
// Do NOT import L from 'leaflet' at the top level here.
// Pass it as an argument to the configure function.
import type LType from 'leaflet';

// The user will be instructed to copy marker-icon.png, marker-icon-2x.png, and marker-shadow.png
// to the public/leaflet/ directory.

export function configureLeafletDefaultIcon(L_instance: typeof LType): void {
  const DefaultIcon = L_instance.icon({
    iconUrl: '/leaflet/marker-icon.png',
    iconRetinaUrl: '/leaflet/marker-icon-2x.png',
    shadowUrl: '/leaflet/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41],
  });

  L_instance.Marker.prototype.options.icon = DefaultIcon;
}
