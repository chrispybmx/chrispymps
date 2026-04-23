'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { SpotMapPin, SpotType } from '@/lib/types';
import { TIPI_SPOT, APP_CONFIG, PALETTE } from '@/lib/constants';
import 'leaflet/dist/leaflet.css';

let L: typeof import('leaflet') | null = null;

/* Zoom sotto il quale mostriamo i cluster città invece dei pin individuali */
const CLUSTER_ZOOM = 10;

interface SpotMapProps {
  spots:              SpotMapPin[];
  filterType:         SpotType | null;
  filterRegionCities: string[] | null;
  searchQuery:        string;
  onSpotClick:        (pin: SpotMapPin) => void;
  onAddSpotAt:        (lat: number, lon: number) => void;
  flyTarget?:         { lat: number; lon: number; zoom?: number } | null;
  selectedPin?:       SpotMapPin | null;
  // Radius search
  radiusMode?:   boolean;
  radiusCenter?: { lat: number; lon: number } | null;
  radiusKm?:     number;
  onMapClick?:   (lat: number, lon: number) => void;
}

/* ── SVG pin individuale (più piccolo rispetto a prima) ── */
function pinSvg(type: SpotType, condition: string): string {
  const info  = TIPI_SPOT[type];
  const color = condition === 'alive'   ? info.color
              : condition === 'bustato' ? '#888'
              : '#444';
  const cross = condition !== 'alive' ? `
    <line x1="9" y1="9" x2="21" y2="21" stroke="${PALETTE.orange}" stroke-width="2" stroke-linecap="round"/>
    <line x1="21" y1="9" x2="9" y2="21" stroke="${PALETTE.orange}" stroke-width="2" stroke-linecap="round"/>
  ` : '';
  const glow = condition === 'alive' ? `<circle cx="15" cy="15" r="13" fill="${color}" opacity="0.12"/>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38">
    ${glow}
    <path d="M15 0C6.72 0 0 6.72 0 15c0 8.28 15 23 15 23S30 23.28 30 15C30 6.72 23.28 0 15 0z"
          fill="${color}" stroke="#0a0a0a" stroke-width="1.5"/>
    <circle cx="15" cy="15" r="9" fill="rgba(0,0,0,0.22)"/>
    <text x="15" y="15.5" text-anchor="middle" font-size="12" dominant-baseline="middle">${info.emoji}</text>
    ${cross}
  </svg>`;
}

/* ── Computa cluster per città ── */
function computeClusters(spots: SpotMapPin[]) {
  const cityMap = new Map<string, SpotMapPin[]>();
  for (const s of spots) {
    const key = s.city ?? `__${s.lat.toFixed(1)}_${s.lon.toFixed(1)}`;
    if (!cityMap.has(key)) cityMap.set(key, []);
    cityMap.get(key)!.push(s);
  }
  return Array.from(cityMap.entries()).map(([key, pins]) => ({
    key,
    city: pins[0].city ?? null,
    lat:  pins.reduce((s, p) => s + p.lat, 0) / pins.length,
    lon:  pins.reduce((s, p) => s + p.lon, 0) / pins.length,
    count: pins.length,
    spots: pins,
  }));
}

export default function SpotMap({
  spots, filterType, filterRegionCities, searchQuery, onSpotClick, onAddSpotAt, flyTarget,
  selectedPin, radiusMode, radiusCenter, radiusKm, onMapClick,
}: SpotMapProps) {
  const mapRef           = useRef<HTMLDivElement>(null);
  const mapInstance      = useRef<import('leaflet').Map | null>(null);
  const markersRef       = useRef<import('leaflet').LayerGroup | null>(null);
  const selectedLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const circleRef        = useRef<import('leaflet').Circle | null>(null);
  const centerMarkerRef  = useRef<import('leaflet').Marker | null>(null);
  const userMarkerRef    = useRef<import('leaflet').Marker | null>(null);
  const onMapClickRef    = useRef(onMapClick);
  const onSpotClickRef   = useRef(onSpotClick);
  const [locating, setLocating] = useState(false);
  const [zoom, setZoom]         = useState(APP_CONFIG.mapZoom ?? 6);

  useEffect(() => { onMapClickRef.current  = onMapClick; });
  useEffect(() => { onSpotClickRef.current = onSpotClick; });

  const filtered = useMemo(() => spots.filter((s) => {
    if (filterType && s.type !== filterType) return false;
    if (filterRegionCities && s.city && !filterRegionCities.includes(s.city)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) || (s.city ?? '').toLowerCase().includes(q);
    }
    return true;
  }), [spots, filterType, filterRegionCities, searchQuery]);

  const clusters = useMemo(() => computeClusters(filtered), [filtered]);

  /* ── Init mappa ── */
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
        maxZoom: 19, className: 'osm-tiles',
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      // selectedLayer PRIMA dei marker → rimane sotto i pin
      selectedLayerRef.current = L.layerGroup().addTo(map);
      markersRef.current  = L.layerGroup().addTo(map);
      mapInstance.current = map;

      /* Aggiorna stato zoom React */
      map.on('zoomend', () => setZoom(map.getZoom()));

      /* Click sulla mappa → radius mode */
      map.on('click', (e) => {
        onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
      });
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markersRef.current  = null;
        userMarkerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Render marker (cluster o pin) al cambio di zoom / filtri ── */
  useEffect(() => {
    if (!mapInstance.current || !markersRef.current || !L) return;
    markersRef.current.clearLayers();

    if (zoom < CLUSTER_ZOOM) {
      /* ── CLUSTER VIEW: un cerchio per città ── */
      clusters.forEach((c) => {
        if (!L || !markersRef.current) return;

        const isOne = c.count === 1;
        const radius = isOne ? 9 : Math.min(9 + Math.sqrt(c.count) * 3, 26);
        const label  = isOne
          ? TIPI_SPOT[c.spots[0].type].emoji
          : String(c.count);

        const html = `<div style="
          width:${radius * 2}px; height:${radius * 2}px;
          background: rgba(255,106,0,0.85);
          border: 2px solid #fff;
          border-radius: 50%;
          display:flex; align-items:center; justify-content:center;
          font-family:'VT323',monospace;
          font-size:${isOne ? 14 : Math.max(11, 16 - String(c.count).length * 1.5)}px;
          color:#000; font-weight:700;
          box-shadow: 0 2px 8px rgba(0,0,0,0.55);
          cursor: pointer;
        ">${label}</div>`;

        const icon = L!.divIcon({
          html,
          className: 'spot-cluster',
          iconSize:  [radius * 2, radius * 2],
          iconAnchor:[radius, radius],
        });

        const marker = L!.marker([c.lat, c.lon], { icon });
        const cityName = c.city
          ? c.city.charAt(0).toUpperCase() + c.city.slice(1)
          : 'Zona';

        marker.bindTooltip(
          `<span style="font-family:monospace;font-size:12px"><b>${cityName}</b> · ${c.count} spot</span>`,
          { permanent: false, direction: 'top', offset: [0, -radius - 2] }
        );

        marker.on('click', () => {
          if (!mapInstance.current) return;
          // Zoom diretto a livello street — senza secondo click
          const targetZoom = c.count === 1 ? 17 : 15;
          mapInstance.current.flyTo([c.lat, c.lon], targetZoom, { duration: 1.0 });
          // Se singolo spot → aprilo subito
          if (c.count === 1) onSpotClickRef.current(c.spots[0]);
        });

        markersRef.current!.addLayer(marker);
      });

    } else {
      /* ── PIN VIEW: pin individuali ── */
      filtered.forEach((pin) => {
        if (!L || !markersRef.current) return;

        const svg  = pinSvg(pin.type, pin.condition);
        const icon = L!.divIcon({
          html:        svg,
          className:   'spot-pin',
          iconSize:    [30, 38],
          iconAnchor:  [15, 38],
          popupAnchor: [0, -40],
        });

        const marker = L!.marker([pin.lat, pin.lon], { icon });
        const tipo   = TIPI_SPOT[pin.type];

        const popupContent = `
          <div style="font-family:'Barlow Condensed',sans-serif;min-width:130px;padding:2px 0">
            <div style="font-family:'VT323',monospace;font-size:16px;color:#ff6a00;line-height:1.2">${pin.name}</div>
            ${pin.city ? `<div style="font-size:11px;color:#888;margin-top:2px">📍 ${pin.city}</div>` : ''}
            <div style="font-size:11px;color:#888;margin-top:3px">${tipo.emoji} ${tipo.label}</div>
          </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 200, closeButton: false });
        marker.on('click',     () => onSpotClickRef.current(pin));
        marker.on('mouseover', () => marker.openPopup());
        marker.on('mouseout',  () => marker.closePopup());

        markersRef.current!.addLayer(marker);
      });
    }
  }, [filtered, clusters, zoom]);

  /* ── Fly-to ── */
  useEffect(() => {
    if (!mapInstance.current || !flyTarget) return;
    mapInstance.current.flyTo(
      [flyTarget.lat, flyTarget.lon],
      flyTarget.zoom ?? APP_CONFIG.mapZoomCity,
      { duration: 1.4 }
    );
  }, [flyTarget]);

  /* ── Marker selezionato — alone sotto il pin ── */
  useEffect(() => {
    if (!selectedLayerRef.current || !L) return;
    selectedLayerRef.current.clearLayers();
    if (!selectedPin) return;

    if (!document.getElementById('sel-glow-style')) {
      const style = document.createElement('style');
      style.id = 'sel-glow-style';
      style.textContent = `
        @keyframes selBreathe {
          0%,100% { opacity: 0.55; transform: translate(-50%,-100%) scale(1); }
          50%      { opacity: 0.85; transform: translate(-50%,-100%) scale(1.12); }
        }
        .sel-glow { animation: selBreathe 2.4s ease-in-out infinite; }
      `;
      document.head.appendChild(style);
    }

    const html = `
      <div class="sel-glow" style="
        width: 44px; height: 44px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255,106,0,0.35) 0%, rgba(255,106,0,0) 70%);
        border: 1.5px solid rgba(255,106,0,0.55);
        box-shadow: 0 0 16px rgba(255,106,0,0.3);
        pointer-events: none;
      "></div>
    `;

    const icon = L!.divIcon({
      html,
      className: '',
      iconSize:  [44, 44],
      iconAnchor:[22, 44], // allineato alla punta del pin sotto
    });

    L!.marker([selectedPin.lat, selectedPin.lon], { icon, interactive: false })
      .addTo(selectedLayerRef.current!);

  }, [selectedPin]);

  /* ── Radius cursor ── */
  useEffect(() => {
    if (!mapInstance.current) return;
    mapInstance.current.getContainer().style.cursor = radiusMode ? 'crosshair' : '';
  }, [radiusMode]);

  /* ── Radius circle ── */
  useEffect(() => {
    if (!L) return;
    const tryDraw = () => {
      if (!mapInstance.current || !L) return;
      circleRef.current?.remove(); circleRef.current = null;
      centerMarkerRef.current?.remove(); centerMarkerRef.current = null;

      if (radiusCenter && radiusKm) {
        circleRef.current = L!.circle(
          [radiusCenter.lat, radiusCenter.lon],
          { radius: radiusKm * 1000, color: '#ff6a00', fillColor: '#ff6a00', fillOpacity: 0.05, weight: 2, dashArray: '10 6' }
        ).addTo(mapInstance.current);

        const svg = `<div style="width:16px;height:16px;background:#ff6a00;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 2px #ff6a00,0 2px 8px rgba(0,0,0,0.6)"></div>`;
        const icon = L!.divIcon({ html: svg, className: '', iconSize: [16, 16], iconAnchor: [8, 8] });
        centerMarkerRef.current = L!.marker([radiusCenter.lat, radiusCenter.lon], { icon, zIndexOffset: 1000 }).addTo(mapInstance.current);

        mapInstance.current.fitBounds(circleRef.current.getBounds(), { padding: [40, 40], maxZoom: 13 });
      }
    };
    if (mapInstance.current) tryDraw();
    else { const t = setTimeout(tryDraw, 300); return () => clearTimeout(t); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusCenter, radiusKm]);

  /* ── Geolocalizzazione con dot persistente ── */
  const locateMe = useCallback(() => {
    if (!mapInstance.current || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapInstance.current!.flyTo([latitude, longitude], APP_CONFIG.mapZoomCity, { duration: 1.2 });

        if (L) {
          const dotSvg = `<div style="
            width:14px;height:14px;
            background:#4285f4;border:3px solid #fff;border-radius:50%;
            box-shadow:0 0 0 2px #4285f4,0 2px 8px rgba(0,0,0,0.55);
          "></div>`;
          const icon = L.divIcon({ html: dotSvg, className: '', iconSize: [14, 14], iconAnchor: [7, 7] });

          if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([latitude, longitude]);
          } else {
            userMarkerRef.current = L.marker([latitude, longitude], { icon, zIndexOffset: 2000 })
              .addTo(mapInstance.current!)
              .bindTooltip('📍 Sei qui', { permanent: false, direction: 'top' });
          }
        }
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
        {/* Localizza */}
        <button
          onClick={locateMe} disabled={locating}
          title="Mostrami sulla mappa" aria-label="Mostrami sulla mappa"
          style={{
            width: 44, height: 44, background: 'var(--gray-800)',
            border: '1px solid var(--gray-600)', borderRadius: 4,
            color: locating ? 'var(--orange)' : 'var(--bone)',
            fontSize: 20, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
            animation: locating ? 'spin-slow 1s linear infinite' : 'none',
          }}
        >
          {locating ? '⌛' : '📍'}
        </button>

        {/* Contatore */}
        <div style={{
          background: 'var(--gray-800)', border: '1px solid var(--gray-700)',
          borderRadius: 4, padding: '6px 8px',
          fontFamily: 'var(--font-mono)', fontSize: 14,
          color: 'var(--orange)', textAlign: 'center',
          boxShadow: '0 2px 12px rgba(0,0,0,0.5)', minWidth: 44,
        }}>
          {filtered.length}
          <div style={{ color: 'var(--gray-400)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>SPOT</div>
        </div>
      </div>
    </div>
  );
}
