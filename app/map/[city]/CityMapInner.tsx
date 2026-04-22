'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { SpotMapPin } from '@/lib/types';
import { TIPI_SPOT } from '@/lib/constants';
import 'leaflet/dist/leaflet.css';

let L: typeof import('leaflet') | null = null;

interface Props {
  spots:    SpotMapPin[];
  activeId: string | null;
  flyTarget?: { lat: number; lon: number; zoom?: number } | null;
  onPinClick: (pin: SpotMapPin) => void;
}

function pinSvg(type: SpotMapPin['type'], active: boolean): string {
  const info = TIPI_SPOT[type];
  const color = active ? '#fff' : info.color;
  const bg    = active ? info.color : '#0a0a0a';
  return `<div style="
    width:${active ? 32 : 24}px; height:${active ? 32 : 24}px;
    background:${bg};
    border:2.5px solid ${color};
    border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-size:${active ? 16 : 12}px;
    box-shadow:0 2px 8px rgba(0,0,0,0.6)${active ? ',0 0 0 3px ' + info.color : ''};
    transition:all 0.2s;
  ">${info.emoji}</div>`;
}

export default function CityMapInner({ spots, activeId, flyTarget, onPinClick }: Props) {
  const mapRef       = useRef<HTMLDivElement>(null);
  const mapInstance  = useRef<import('leaflet').Map | null>(null);
  const markersRef   = useRef<Map<string, import('leaflet').Marker>>(new Map());
  const onPinRef     = useRef(onPinClick);

  useEffect(() => { onPinRef.current = onPinClick; });

  /* ── Init ── */
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    import('leaflet').then((leaflet) => {
      L = leaflet;
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;

      const map = L.map(mapRef.current!, {
        center: [46.0, 11.0],
        zoom:   12,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19, className: 'osm-tiles',
      }).addTo(map);

      mapInstance.current = map;

      // Aggiungi i marker
      spots.forEach(pin => addMarker(pin, false));

      // Fit bounds sui pin
      if (spots.length > 0) {
        const latlngs = spots.map(s => [s.lat, s.lon] as [number, number]);
        map.fitBounds(L!.latLngBounds(latlngs), { padding: [32, 32], maxZoom: 15 });
      }
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markersRef.current.clear();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addMarker(pin: SpotMapPin, active: boolean) {
    if (!L || !mapInstance.current) return;
    const html = pinSvg(pin.type, active);
    const icon = L.divIcon({
      html, className: 'city-spot-pin',
      iconSize: active ? [32, 32] : [24, 24],
      iconAnchor: active ? [16, 16] : [12, 12],
    });
    const marker = L.marker([pin.lat, pin.lon], { icon, zIndexOffset: active ? 1000 : 0 });
    marker.bindTooltip(pin.name, { permanent: false, direction: 'top', offset: [0, active ? -18 : -14] });
    marker.on('click', () => onPinRef.current(pin));
    marker.addTo(mapInstance.current!);
    markersRef.current.set(pin.id, marker);
  }

  /* ── Aggiorna marker attivo ── */
  useEffect(() => {
    if (!L || !mapInstance.current) return;
    markersRef.current.forEach((marker, id) => {
      const pin    = spots.find(s => s.id === id);
      if (!pin) return;
      const active = id === activeId;
      const html   = pinSvg(pin.type, active);
      const icon   = L!.divIcon({
        html, className: 'city-spot-pin',
        iconSize: active ? [32, 32] : [24, 24],
        iconAnchor: active ? [16, 16] : [12, 12],
      });
      marker.setIcon(icon);
      marker.setZIndexOffset(active ? 1000 : 0);
    });
  }, [activeId, spots]);

  /* ── Fly to ── */
  useEffect(() => {
    if (!mapInstance.current || !flyTarget) return;
    mapInstance.current.flyTo(
      [flyTarget.lat, flyTarget.lon],
      flyTarget.zoom ?? 15,
      { duration: 0.8 }
    );
  }, [flyTarget]);

  return (
    <div
      ref={mapRef}
      style={{ width: '100%', height: '100%' }}
      aria-label={`Mappa spot city`}
      role="application"
    />
  );
}
