'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { SpotMapPin, SpotType } from '@/lib/types';
import { TIPI_SPOT, CONDIZIONI, APP_CONFIG, PALETTE } from '@/lib/constants';

// Leaflet viene importato dinamicamente (ssr:false nel parent)
let L: typeof import('leaflet') | null = null;

interface SpotMapProps {
  spots:       SpotMapPin[];
  filterType:  SpotType | null;
  searchQuery: string;
  onSpotClick: (pin: SpotMapPin) => void;
  onAddSpotAt: (lat: number, lon: number) => void;
}

function pinIcon(type: SpotType, condition: string): string {
  const info  = TIPI_SPOT[type];
  const color = condition === 'alive' ? info.color
              : condition === 'bustato' ? PALETTE.orange
              : PALETTE.gray600;
  const bustato = condition !== 'alive' ? `
    <line x1="4" y1="4" x2="20" y2="20" stroke="${PALETTE.orange}" stroke-width="2"/>
  ` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
    <path d="M16 0C7.2 0 0 7.2 0 16c0 8 16 24 16 24S32 24 32 16C32 7.2 24.8 0 16 0z"
          fill="${color}" stroke="#0a0a0a" stroke-width="1.5"/>
    <text x="16" y="22" text-anchor="middle" font-size="14">${info.emoji}</text>
    ${bustato}
  </svg>`;
}

export default function SpotMap({ spots, filterType, searchQuery, onSpotClick, onAddSpotAt }: SpotMapProps) {
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import('leaflet').Map | null>(null);
  const markersRef  = useRef<import('leaflet').LayerGroup | null>(null);
  const [locating, setLocating] = useState(false);
  const [addMode,  setAddMode]  = useState(false);

  // Filtra spots in base a tipo e ricerca
  const filtered = spots.filter((s) => {
    if (filterType && s.type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        (s.city ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Init mappa Leaflet
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    import('leaflet').then((leaflet) => {
      L = leaflet;

      // Fix icone di default di Leaflet in Next.js
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
        attributionControl: true,
      });

      // Tiles OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
        className: 'osm-tiles',
      }).addTo(map);

      // Zoom control in basso a destra
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Layer group per i marker
      markersRef.current = L.layerGroup().addTo(map);

      // Click su mappa in "add mode"
      map.on('click', (e) => {
        if (addMode) {
          onAddSpotAt(e.latlng.lat, e.latlng.lng);
          setAddMode(false);
        }
      });

      mapInstance.current = map;
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
      const svg  = pinIcon(pin.type, pin.condition);
      const icon = L!.divIcon({
        html:        svg,
        className:   'spot-pin',
        iconSize:    [32, 40],
        iconAnchor:  [16, 40],
        popupAnchor: [0, -42],
      });

      const marker = L!.marker([pin.lat, pin.lon], { icon });

      // Popup leggero al hover su desktop
      const popupContent = `
        <div style="font-family:'Barlow Condensed',sans-serif;min-width:140px;">
          <div style="font-family:'VT323',monospace;font-size:16px;color:#ff6a00;">${pin.name}</div>
          ${pin.city ? `<div style="font-size:12px;color:#888;">${pin.city}</div>` : ''}
          <div style="font-size:11px;color:#888;margin-top:4px;">${TIPI_SPOT[pin.type].emoji} ${TIPI_SPOT[pin.type].label}</div>
        </div>
      `;
      marker.bindPopup(popupContent, { maxWidth: 200, closeButton: false });

      marker.on('click', () => onSpotClick(pin));
      marker.on('mouseover', () => marker.openPopup());
      marker.on('mouseout',  () => marker.closePopup());

      markersRef.current!.addLayer(marker);
    });
  }, [filtered, onSpotClick]);

  // Geolocalizzazione "Near me"
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
      {/* Mappa */}
      <div
        ref={mapRef}
        style={{ width: '100%', height: '100%' }}
        aria-label="Mappa spot BMX Italia"
        role="application"
      />

      {/* Controlli floating */}
      <div style={{
        position: 'absolute',
        bottom: 'calc(var(--strip-height) + 16px + env(safe-area-inset-bottom))',
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 10,
      }}>
        {/* Near me */}
        <button
          onClick={locateMe}
          disabled={locating}
          title="Mostra spot vicino a me"
          aria-label="Cerca spot vicino a me"
          style={{
            width: 44, height: 44,
            background: 'var(--gray-800)',
            border: '1px solid var(--gray-600)',
            borderRadius: 4,
            color: locating ? 'var(--orange)' : 'var(--bone)',
            fontSize: 20,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--vhs-pin)',
            transition: 'color 0.2s',
            animation: locating ? 'spin-slow 1s linear infinite' : 'none',
          }}
        >
          {locating ? '⌛' : '📍'}
        </button>

        {/* Contatore filtrati */}
        <div style={{
          background: 'var(--gray-800)',
          border: '1px solid var(--gray-700)',
          borderRadius: 4,
          padding: '6px 10px',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--orange)',
          textAlign: 'center',
          boxShadow: 'var(--vhs-pin)',
        }}>
          {filtered.length}<br />
          <span style={{ color: 'var(--gray-400)', fontSize: 10 }}>SPOT</span>
        </div>
      </div>

      {/* Banner add mode */}
      {addMode && (
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255,106,0,0.95)',
          color: '#000',
          fontFamily: 'var(--font-mono)',
          fontSize: 16,
          padding: '10px 20px',
          borderRadius: 4,
          pointerEvents: 'none',
          zIndex: 20,
        }}>
          📍 TAP SULLA MAPPA per posizionare lo spot
        </div>
      )}
    </div>
  );
}
