'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { SpotMapPin, SpotType } from '@/lib/types';
import { TIPI_SPOT, APP_CONFIG, PALETTE } from '@/lib/constants';
import 'leaflet/dist/leaflet.css';

let L: typeof import('leaflet') | null = null;

interface SpotMapProps {
  spots:       SpotMapPin[];
  filterType:  SpotType | null;
  searchQuery: string;
  onSpotClick: (pin: SpotMapPin) => void;
  onAddSpotAt: (lat: number, lon: number) => void;
  flyTarget?:  { lat: number; lon: number; zoom?: number } | null;
  // Radius search
  radiusMode?:   boolean;
  radiusCenter?: { lat: number; lon: number } | null;
  radiusKm?:     number;
  onMapClick?:   (lat: number, lon: number) => void;
}

function pinSvg(type: SpotType, condition: string): string {
  const info  = TIPI_SPOT[type];
  const color = condition === 'alive'    ? info.color
              : condition === 'bustato'  ? '#888'
              : '#444';

  const cross = condition !== 'alive' ? `
    <line x1="10" y1="10" x2="26" y2="26" stroke="${PALETTE.orange}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="26" y1="10" x2="10" y2="26" stroke="${PALETTE.orange}" stroke-width="2.5" stroke-linecap="round"/>
  ` : '';

  const glow = condition === 'alive' ? `<circle cx="20" cy="20" r="18" fill="${color}" opacity="0.12"/>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">
    ${glow}
    <path d="M20 0C8.95 0 0 8.95 0 20c0 11.05 20 30 20 30S40 31.05 40 20C40 8.95 31.05 0 20 0z"
          fill="${color}" stroke="#0a0a0a" stroke-width="2"/>
    <circle cx="20" cy="20" r="12" fill="rgba(0,0,0,0.25)"/>
    <text x="20" y="21" text-anchor="middle" font-size="16" dominant-baseline="middle">${info.emoji}</text>
    ${cross}
  </svg>`;
}

export default function SpotMap({
  spots, filterType, searchQuery, onSpotClick, onAddSpotAt, flyTarget,
  radiusMode, radiusCenter, radiusKm, onMapClick,
}: SpotMapProps) {
  const mapRef          = useRef<HTMLDivElement>(null);
  const mapInstance     = useRef<import('leaflet').Map | null>(null);
  const markersRef      = useRef<import('leaflet').LayerGroup | null>(null);
  const circleRef       = useRef<import('leaflet').Circle | null>(null);
  const centerMarkerRef = useRef<import('leaflet').Marker | null>(null);
  const onMapClickRef   = useRef(onMapClick);
  const [locating, setLocating] = useState(false);

  // Keep callback ref fresh
  useEffect(() => { onMapClickRef.current = onMapClick; });

  const filtered = spots.filter((s) => {
    if (filterType && s.type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) || (s.city ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  // Init mappa
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    import('leaflet').then((leaflet) => {
      L = leaflet;
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, {
        center: APP_CONFIG.mapCenter,
        zoom:   APP_CONFIG.mapZoom,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
        className: 'osm-tiles',
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      markersRef.current = L.layerGroup().addTo(map);
      mapInstance.current = map;

      // Radius mode: forward all map clicks
      map.on('click', (e) => {
        onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
      });
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markersRef.current  = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aggiorna marker quando cambiano i filtri
  useEffect(() => {
    if (!mapInstance.current || !markersRef.current || !L) return;
    markersRef.current.clearLayers();

    filtered.forEach((pin) => {
      const svg  = pinSvg(pin.type, pin.condition);
      const icon = L!.divIcon({
        html:        svg,
        className:   'spot-pin',
        iconSize:    [40, 50],
        iconAnchor:  [20, 50],
        popupAnchor: [0, -52],
      });

      const marker = L!.marker([pin.lat, pin.lon], { icon });

      const tipo = TIPI_SPOT[pin.type];
      const popupContent = `
        <div style="font-family:'Barlow Condensed',sans-serif;min-width:150px;padding:2px 0">
          <div style="font-family:'VT323',monospace;font-size:17px;color:#ff6a00;line-height:1.2">${pin.name}</div>
          ${pin.city ? `<div style="font-size:12px;color:#888;margin-top:2px">📍 ${pin.city}</div>` : ''}
          <div style="font-size:11px;color:#888;margin-top:4px">${tipo.emoji} ${tipo.label}</div>
          <div style="font-size:11px;color:#555;margin-top:2px">Tocca per dettagli</div>
        </div>
      `;
      marker.bindPopup(popupContent, { maxWidth: 220, closeButton: false });
      marker.on('click',     () => onSpotClick(pin));
      marker.on('mouseover', () => marker.openPopup());
      marker.on('mouseout',  () => marker.closePopup());

      markersRef.current!.addLayer(marker);
    });
  }, [filtered, onSpotClick]);

  // Fly-to quando cambia flyTarget
  useEffect(() => {
    if (!mapInstance.current || !flyTarget) return;
    mapInstance.current.flyTo(
      [flyTarget.lat, flyTarget.lon],
      flyTarget.zoom ?? APP_CONFIG.mapZoomCity,
      { duration: 1.4 }
    );
  }, [flyTarget]);

  // ── Radius: cursor crosshair quando in modalità raggio ──
  useEffect(() => {
    if (!mapInstance.current) return;
    const container = mapInstance.current.getContainer();
    container.style.cursor = radiusMode ? 'crosshair' : '';
  }, [radiusMode]);

  // ── Radius: cerchio + marker centro ──
  useEffect(() => {
    if (!L) return;

    const tryDraw = () => {
      if (!mapInstance.current || !L) return;

      // Rimuovi vecchi layer
      circleRef.current?.remove();
      circleRef.current = null;
      centerMarkerRef.current?.remove();
      centerMarkerRef.current = null;

      if (radiusCenter && radiusKm) {
        // Cerchio tratteggiato arancione
        circleRef.current = L!.circle(
          [radiusCenter.lat, radiusCenter.lon],
          {
            radius: radiusKm * 1000,
            color: '#ff6a00',
            fillColor: '#ff6a00',
            fillOpacity: 0.05,
            weight: 2,
            dashArray: '10 6',
          }
        ).addTo(mapInstance.current);

        // Marker centro
        const svg = `<div style="
          width:18px;height:18px;
          background:#ff6a00;
          border:3px solid #fff;
          border-radius:50%;
          box-shadow:0 0 0 2px #ff6a00, 0 2px 8px rgba(0,0,0,0.6);
        "></div>`;
        const icon = L!.divIcon({ html: svg, className: '', iconSize: [18, 18], iconAnchor: [9, 9] });
        centerMarkerRef.current = L!.marker([radiusCenter.lat, radiusCenter.lon], {
          icon, zIndexOffset: 1000,
        }).addTo(mapInstance.current);

        // Fly to fit the circle
        mapInstance.current.fitBounds(circleRef.current.getBounds(), { padding: [40, 40], maxZoom: 13 });
      }
    };

    // Map might not be ready yet
    if (mapInstance.current) {
      tryDraw();
    } else {
      const t = setTimeout(tryDraw, 300);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusCenter, radiusKm]);

  // ── Geolocalizzazione
  const locateMe = useCallback(() => {
    if (!mapInstance.current || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapInstance.current!.flyTo(
          [pos.coords.latitude, pos.coords.longitude],
          APP_CONFIG.mapZoomCity,
          { duration: 1.2 }
        );
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={mapRef}
        style={{ width: '100%', height: '100%' }}
        aria-label="Mappa spot BMX Italia"
        role="application"
      />

      {/* Controlli floating */}
      <div style={{
        position: 'absolute',
        bottom: 'calc(var(--strip-height, 48px) + 16px + env(safe-area-inset-bottom))',
        right: 16,
        display: 'flex', flexDirection: 'column', gap: 8,
        zIndex: 10,
      }}>
        <button
          onClick={locateMe} disabled={locating}
          title="Spot vicino a me" aria-label="Spot vicino a me"
          style={{
            width: 44, height: 44,
            background: 'var(--gray-800)',
            border: '1px solid var(--gray-600)',
            borderRadius: 4,
            color: locating ? 'var(--orange)' : 'var(--bone)',
            fontSize: 20, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
            animation: locating ? 'spin-slow 1s linear infinite' : 'none',
          }}
        >
          {locating ? '⌛' : '📍'}
        </button>

        <div style={{
          background: 'var(--gray-800)',
          border: '1px solid var(--gray-700)',
          borderRadius: 4, padding: '6px 10px',
          fontFamily: 'var(--font-mono)', fontSize: 14,
          color: 'var(--orange)', textAlign: 'center',
          boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
          minWidth: 44,
        }}>
          {filtered.length}
          <div style={{ color: 'var(--gray-400)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>SPOT</div>
        </div>
      </div>
    </div>
  );
}
