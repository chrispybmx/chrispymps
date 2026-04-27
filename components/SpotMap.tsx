'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { SpotMapPin, SpotType } from '@/lib/types';
import { TIPI_SPOT, APP_CONFIG, PALETTE } from '@/lib/constants';
import 'leaflet/dist/leaflet.css';

let L: typeof import('leaflet') | null = null;

/* Zoom sotto il quale mostriamo i cluster invece dei pin individuali. */
const CLUSTER_ZOOM = 12;

interface SpotMapProps {
  spots:             SpotMapPin[];
  filterType:        SpotType | null;
  filterRegionBbox?: [number, number, number, number] | null;
  searchQuery:       string;
  onSpotClick:        (pin: SpotMapPin) => void;
  onAddSpotAt:        (lat: number, lon: number) => void;
  flyTarget?:         { lat: number; lon: number; zoom?: number } | null;
  selectedPin?:       SpotMapPin | null;
  overlayOffsetPx?:   number;
  fitAllTrigger?:     number;
  // Radius search
  radiusMode?:   boolean;
  radiusCenter?: { lat: number; lon: number } | null;
  radiusKm?:     number;
  onMapClick?:   (lat: number, lon: number) => void;
  // GPS locate triggered from MapClient
  locateTrigger?: number;
  onLocatingChange?: (v: boolean) => void;
}

/* ── SVG pin individuale ── */
function pinSvg(type: SpotType, condition: string, isSelected = false): string {
  const info  = TIPI_SPOT[type];
  const color = condition === 'alive'   ? info.color
              : condition === 'bustato' ? '#888'
              : '#444';
  const cross = condition !== 'alive' ? `
    <line x1="9" y1="9" x2="21" y2="21" stroke="${PALETTE.orange}" stroke-width="2" stroke-linecap="round"/>
    <line x1="21" y1="9" x2="9" y2="21" stroke="${PALETTE.orange}" stroke-width="2" stroke-linecap="round"/>
  ` : '';
  const glow = condition === 'alive' ? `<circle cx="15" cy="15" r="13" fill="${color}" opacity="0.12"/>` : '';
  const strokeColor = isSelected ? '#ff6a00' : '#0a0a0a';
  const strokeWidth = isSelected ? 2.5 : 1.5;
  const w = isSelected ? 38 : 30;
  const h = isSelected ? 48 : 38;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 30 38">
    ${glow}
    <path d="M15 0C6.72 0 0 6.72 0 15c0 8.28 15 23 15 23S30 23.28 30 15C30 6.72 23.28 0 15 0z"
          fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
    <circle cx="15" cy="15" r="9" fill="rgba(0,0,0,0.22)"/>
    <text x="15" y="15.5" text-anchor="middle" font-size="12" dominant-baseline="middle">${info.emoji}</text>
    ${cross}
  </svg>`;
}

/* ── Calcola l'offset in pixel per centrare il punto nello spazio visibile ──
   Il pannello lista occupa clamp(270px, 54dvh, 480px) in fondo.
   Per centrare nello spazio sopra il pannello: offset = panelHeight / 2.
   (Il topbar è già gestito da Leaflet perché il container mappa parte sotto di esso.)
   Su mobile usiamo lo stesso valore perché la mappa copre comunque la viewport intera. */
function getPanelOffsetPx(): number {
  if (typeof window === 'undefined') return 160;
  const panelH = Math.min(480, Math.max(270, window.innerHeight * 0.54));
  return Math.round(panelH / 2);
}

/* ── Clustering geografico a griglia adattiva allo zoom ──
   Celle più piccole = cluster più granulari e precisi. */
function computeGridClusters(spots: SpotMapPin[], zoom: number) {
  /* Dimensione cella in gradi geografici — ottimizzata per distribuzione mondiale */
  const cellDeg =
    zoom < 4  ? 5    :   // vista mondo: ~550 km per cella
    zoom < 5  ? 2.5  :   // ~280 km
    zoom < 6  ? 1.2  :   // ~130 km — continente (Europa intera)
    zoom < 7  ? 0.6  :   // ~65 km  — paese (Italia = ~18 cluster)
    zoom < 8  ? 0.3  :   // ~33 km  — regione
    zoom < 9  ? 0.15 :   // ~17 km  — area metropolitana
    zoom < 10 ? 0.07 :   // ~8 km   — città grande
    zoom < 11 ? 0.03 :   // ~3 km   — quartiere
                0.01;    // ~1 km   — pin quasi individuali

  const cellMap = new Map<string, SpotMapPin[]>();
  for (const s of spots) {
    const key = `${Math.floor(s.lat / cellDeg)}_${Math.floor(s.lon / cellDeg)}`;
    if (!cellMap.has(key)) cellMap.set(key, []);
    cellMap.get(key)!.push(s);
  }

  return Array.from(cellMap.values()).map((pins) => {
    /* Usa la città del primo spot come label (se disponibile) */
    const city = pins.find(p => p.city)?.city ?? null;
    return {
      key:   `${pins[0].lat.toFixed(4)}_${pins[0].lon.toFixed(4)}`,
      city,
      lat:   pins.reduce((s, p) => s + p.lat, 0) / pins.length,
      lon:   pins.reduce((s, p) => s + p.lon, 0) / pins.length,
      count: pins.length,
      spots: pins,
    };
  });
}

export default function SpotMap({
  spots, filterType, filterRegionBbox, searchQuery, onSpotClick, onAddSpotAt, flyTarget,
  selectedPin, overlayOffsetPx = 160, fitAllTrigger, radiusMode, radiusCenter, radiusKm, onMapClick,
  locateTrigger, onLocatingChange,
}: SpotMapProps) {
  const mapRef           = useRef<HTMLDivElement>(null);
  const mapInstance      = useRef<import('leaflet').Map | null>(null);
  const markersRef       = useRef<import('leaflet').LayerGroup | null>(null);
  const hasInitialFit    = useRef(false);
  const circleRef        = useRef<import('leaflet').Circle | null>(null);
  const centerMarkerRef  = useRef<import('leaflet').Marker | null>(null);
  const userMarkerRef    = useRef<import('leaflet').Marker | null>(null);
  const onMapClickRef    = useRef(onMapClick);
  const onSpotClickRef   = useRef(onSpotClick);
  /* Memoization: refs dichiarati qui ma inizializzati dopo filtered/clusters */
  const pinMarkersRef    = useRef<Map<string, import('leaflet').Marker>>(new Map());
  const prevSelIdRef     = useRef<string | null>(null);
  const filteredRef      = useRef<SpotMapPin[]>([]);
  const selPinRef        = useRef<SpotMapPin | null>(null);
  /* Refs per il fitAllTrigger effect — evita di aggiungere filterRegionBbox/searchQuery
     come dependency (causerebbero re-run ad ogni render) */
  const filterRegionBboxRef = useRef(filterRegionBbox);
  const searchQueryRef      = useRef(searchQuery);
  const [locating, setLocating] = useState(false);
  const [zoom, setZoom]         = useState<number>(APP_CONFIG.mapZoom ?? 6);

  useEffect(() => { onMapClickRef.current       = onMapClick; });
  useEffect(() => { onSpotClickRef.current      = onSpotClick; });
  useEffect(() => { filterRegionBboxRef.current = filterRegionBbox; });
  useEffect(() => { searchQueryRef.current      = searchQuery; });

  const filtered = useMemo(() => spots.filter((s) => {
    if (filterType && s.type !== filterType) return false;
    if (filterRegionBbox) {
      const [latMin, lonMin, latMax, lonMax] = filterRegionBbox;
      if (s.lat < latMin || s.lat > latMax || s.lon < lonMin || s.lon > lonMax) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase().replace(/^@/, '');
      return (
        s.name.toLowerCase().includes(q) ||
        (s.city ?? '').toLowerCase().includes(q) ||
        (s.submitted_by_username ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  }), [spots, filterType, filterRegionBbox, searchQuery]);

  /* Clusters calcolati in base al zoom corrente — la griglia adattiva gestisce 500+ spot */
  const clusters = useMemo(() => computeGridClusters(filtered, zoom), [filtered, zoom]);

  // Sincronizza ref mutabili col valore corrente del render (dopo filtered/clusters)
  filteredRef.current = filtered;
  selPinRef.current   = selectedPin ?? null;

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

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19, className: 'osm-tiles',
      }).addTo(map);

      L.control.zoom({ position: 'bottomleft' }).addTo(map);
      markersRef.current  = L.layerGroup().addTo(map);
      mapInstance.current = map;

      /* Aggiorna stato zoom React */
      map.on('zoomend', () => setZoom(map.getZoom()));

      /* nessun CSS extra necessario: il pin selezionato usa già il bordo arancione in pinSvg */

      /* ── Geolocalizzazione automatica all'avvio ──
         Se il browser conosce la posizione dell'utente, partiamo da lì.
         Se non risponde prima che gli spot facciano il loro auto-fit, aggiungiamo
         solo il dot blu senza spostare la mappa. */
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!mapInstance.current || !L) return;
            const { latitude, longitude } = pos.coords;

            /* Vola sempre alla posizione utente quando la geo risponde —
               dà un'apertura della mappa centrata su dove ti trovi */
            const isMobile = window.innerWidth < 768;
            if (isMobile) {
              mapInstance.current.setView([latitude, longitude], APP_CONFIG.mapZoomCity, { animate: false });
            } else {
              mapInstance.current.flyTo([latitude, longitude], APP_CONFIG.mapZoomCity, { duration: 1.0, easeLinearity: 0.4 });
            }
            hasInitialFit.current = true;

            /* Dot blu "Sei qui" */
            const dotSvg = `<div style="
              width:14px;height:14px;
              background:#4285f4;border:3px solid #fff;border-radius:50%;
              box-shadow:0 0 0 2px #4285f4,0 2px 8px rgba(0,0,0,0.55);
            "></div>`;
            const icon = L!.divIcon({
              html: dotSvg, className: '',
              iconSize: [14, 14], iconAnchor: [7, 7],
            });
            if (!userMarkerRef.current) {
              userMarkerRef.current = L!.marker([latitude, longitude], { icon, zIndexOffset: 2000 })
                .addTo(mapInstance.current!)
                .bindTooltip('📍 Sei qui', { permanent: false, direction: 'top' });
            } else {
              userMarkerRef.current.setLatLng([latitude, longitude]);
            }
          },
          () => { /* permesso negato → nessuna azione */ },
          { timeout: 6000, maximumAge: 300_000 }
        );
      }

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

  /* ── Render marker al cambio di zoom / filtri ── */
  /* selectedPin NON è nelle deps: gestito separatamente in Effect 2 per evitare
     il full-rebuild ad ogni click su uno spot (potenzialmente centinaia di marker) */
  useEffect(() => {
    if (!mapInstance.current || !markersRef.current || !L) return;
    markersRef.current.clearLayers();
    pinMarkersRef.current.clear();

    if (zoom < CLUSTER_ZOOM) {
      /* ── CLUSTER VIEW: un cerchio per città ── */
      clusters.forEach((c) => {
        if (!L || !markersRef.current) return;

        /* Pallino arancione uniforme — sempre, anche per singoli spot */
        const radius = Math.min(6 + Math.sqrt(c.count) * 1.6, 15);
        const label  = c.count === 1 ? '' : String(c.count);
        const fontSize = Math.max(9, 13 - String(c.count).length);
        const html = `<div style="
          width:${radius * 2}px; height:${radius * 2}px;
          background: rgba(255,106,0,0.9);
          border: 1.5px solid rgba(255,255,255,0.9);
          border-radius: 50%;
          display:flex; align-items:center; justify-content:center;
          font-family:'VT323',monospace;
          font-size:${fontSize}px;
          color:#000; font-weight:700;
          box-shadow: 0 1px 5px rgba(0,0,0,0.5);
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
          if (!mapInstance.current || !L) return;
          const isMobile = window.innerWidth < 768;

          if (c.count === 1) {
            /* Spot singolo → vola diretto + apri la card */
            const targetZoom = 17;
            if (isMobile) mapInstance.current.setView([c.lat, c.lon], targetZoom, { animate: false });
            else mapInstance.current.flyTo([c.lat, c.lon], targetZoom, { duration: 0.6 });
            onSpotClickRef.current(c.spots[0]);
          } else {
            /* Multi-spot → fitBounds sul gruppo reale, non zoom fisso.
               Padding inferiore = altezza pannello (calcolata live dalla viewport). */
            const bounds    = L!.latLngBounds(c.spots.map(s => [s.lat, s.lon] as [number, number]));
            const panelH    = Math.min(480, Math.max(270, window.innerHeight * 0.54));
            const padBottom = panelH + 20;
            if (isMobile) {
              mapInstance.current.fitBounds(bounds, {
                paddingTopLeft:     [20, 20],
                paddingBottomRight: [20, padBottom],
                maxZoom: 16, animate: false,
              });
            } else {
              mapInstance.current.fitBounds(bounds, {
                paddingTopLeft:     [40, 40],
                paddingBottomRight: [40, padBottom],
                maxZoom: 16,
              });
            }
          }
        });

        markersRef.current!.addLayer(marker);
      });

    } else {
      /* ── PIN VIEW: pin individuali ── */
      filtered.forEach((pin) => {
        if (!L || !markersRef.current) return;

        // Usa selPinRef (sempre aggiornato) per rendere l'icona corretta
        const isSel = selPinRef.current?.id === pin.id;
        const svg   = pinSvg(pin.type, pin.condition, isSel);
        const pw    = isSel ? 38 : 30;
        const ph    = isSel ? 48 : 38;
        const icon  = L!.divIcon({
          html:        svg,
          className:   'spot-pin',
          iconSize:    [pw, ph],
          iconAnchor:  [pw / 2, ph],
          popupAnchor: [0, -(ph + 2)],
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
        pinMarkersRef.current.set(pin.id, marker); // salva ref per Effect 2
      });
    }

    prevSelIdRef.current = selPinRef.current?.id ?? null;

    /* ── Auto-fit al primo render con spot ── */
    if (!hasInitialFit.current && filtered.length > 0 && mapInstance.current && L) {
      const bounds = L.latLngBounds(filtered.map(s => [s.lat, s.lon] as [number, number]));
      const panelH = Math.min(480, Math.max(270, window.innerHeight * 0.54));
      mapInstance.current.fitBounds(bounds, {
        paddingTopLeft:     [32, 32],
        paddingBottomRight: [32, panelH + 32],
        maxZoom: 15,
        animate: false,
      });
      hasInitialFit.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, clusters, zoom]); // selectedPin gestito in Effect 2

  /* ── Effect 2: aggiorna SOLO l'icona del pin selezionato/deselezionato ── */
  /* Evita di ricreare tutti i marker ad ogni click: O(1) invece di O(n) */
  useEffect(() => {
    if (!L || !mapInstance.current || zoom < CLUSTER_ZOOM) return;

    const newSelId  = selectedPin?.id ?? null;
    const prevSelId = prevSelIdRef.current;

    // Ripristina icona precedente
    if (prevSelId && prevSelId !== newSelId) {
      const marker = pinMarkersRef.current.get(prevSelId);
      if (marker) {
        const pin = filteredRef.current.find(s => s.id === prevSelId);
        if (pin) {
          const svg  = pinSvg(pin.type, pin.condition, false);
          const icon = L!.divIcon({ html: svg, className: 'spot-pin', iconSize: [30, 38], iconAnchor: [15, 38], popupAnchor: [0, -40] });
          marker.setIcon(icon);
        }
      }
    }

    // Applica icona selezionata al nuovo pin (bordo arancione, più grande)
    if (selectedPin) {
      const marker = pinMarkersRef.current.get(selectedPin.id);
      if (marker) {
        const svg  = pinSvg(selectedPin.type, selectedPin.condition, true);
        const icon = L!.divIcon({ html: svg, className: 'spot-pin', iconSize: [38, 48], iconAnchor: [19, 48], popupAnchor: [0, -50] });
        marker.setIcon(icon);
      }
    }

    prevSelIdRef.current = newSelId;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPin, zoom]);

  /* ── Fly-to: centrato nello spazio visibile sopra il pannello ── */
  useEffect(() => {
    if (!mapInstance.current || !flyTarget || !L) return;
    const map  = mapInstance.current;
    const zoom = flyTarget.zoom ?? APP_CONFIG.mapZoomCity;
    const isMobile = window.innerWidth < 768;

    /* Calcola offset dinamico: panel_height / 2
       Logica: proiettiamo il pin in pixel, poi AGGIUNGIAMO l'offset a Y (spostiamo
       il "centro virtuale" più a sud). Leaflet centra la mappa su quel punto sud,
       quindi il pin appare panel_height/2 px SOPRA il centro → al centro dello
       spazio visibile sopra il pannello. Sottrarre (vecchio codice) faceva l'opposto. */
    const offset = getPanelOffsetPx();

    if (isMobile) {
      // Su mobile: stesso offset, senza animazione
      const targetPoint  = map.project([flyTarget.lat, flyTarget.lon], zoom);
      const offsetPoint  = targetPoint.add(L!.point(0, offset));
      const offsetLatLng = map.unproject(offsetPoint, zoom);
      map.setView(offsetLatLng, zoom, { animate: false });
    } else {
      // Su desktop: flyTo con centro spostato a sud del pin
      const targetPoint  = map.project([flyTarget.lat, flyTarget.lon], zoom);
      const offsetPoint  = targetPoint.add(L!.point(0, offset));
      const offsetLatLng = map.unproject(offsetPoint, zoom);
      map.flyTo(offsetLatLng, zoom, { duration: 0.7, easeLinearity: 0.5 });
    }
  }, [flyTarget]);

  /* ── Refit quando cambiano i filtri (fitAllTrigger incrementa in MapClient) ── */
  useEffect(() => {
    if (!fitAllTrigger || !hasInitialFit.current || !mapInstance.current || !L) return;
    const pins    = filteredRef.current;
    const hasRegion = !!filterRegionBboxRef.current;
    const hasSearch = !!searchQueryRef.current;
    const panelH  = Math.min(480, Math.max(270, window.innerHeight * 0.54));

    /* Caso 0: nessun risultato */
    if (pins.length === 0) {
      if (hasRegion) {
        // Mostra comunque la regione selezionata
        const [latMin, lonMin, latMax, lonMax] = filterRegionBboxRef.current!;
        mapInstance.current.fitBounds(L.latLngBounds([[latMin, lonMin], [latMax, lonMax]]), {
          paddingTopLeft: [32, 32], paddingBottomRight: [32, panelH + 32], animate: true,
        });
      } else {
        // Nessun risultato → lascia la mappa dove si trova (nessun refit)
      }
      return;
    }

    /* Caso 1: singolo risultato → zoom ravvicinato centrato sopra il pannello */
    if (pins.length === 1) {
      const offset       = getPanelOffsetPx();
      const p            = pins[0];
      const targetZoom   = 15;
      const targetPoint  = mapInstance.current.project([p.lat, p.lon], targetZoom);
      const offsetPoint  = targetPoint.add(L!.point(0, offset));
      const offsetLatLng = mapInstance.current.unproject(offsetPoint, targetZoom);
      mapInstance.current.flyTo(offsetLatLng, targetZoom, { duration: 0.7, easeLinearity: 0.5 });
      return;
    }

    /* Caso 2: filtro regione attivo → mostra sempre l'intera bbox della regione,
       così la distribuzione degli spot nella regione è chiara anche se sono
       concentrati in una città sola */
    if (hasRegion) {
      const [latMin, lonMin, latMax, lonMax] = filterRegionBboxRef.current!;
      mapInstance.current.fitBounds(L.latLngBounds([[latMin, lonMin], [latMax, lonMax]]), {
        paddingTopLeft:     [32, 32],
        paddingBottomRight: [32, panelH + 32],
        animate: true,
      });
      return;
    }

    /* Caso 3: ricerca testuale → fitBounds sui risultati effettivi */
    if (hasSearch) {
      const bounds = L.latLngBounds(pins.map(s => [s.lat, s.lon] as [number, number]));
      mapInstance.current.fitBounds(bounds, {
        paddingTopLeft:     [32, 32],
        paddingBottomRight: [32, panelH + 32],
        maxZoom: 14,
        animate: true,
      });
      return;
    }

    /* Caso 4: solo filtro categoria (no regione, no ricerca) → fitBounds sugli spot
       reali, ovunque si trovino nel mondo — zoom calibrato sulla distribuzione effettiva */
    {
      const bounds = L.latLngBounds(pins.map(s => [s.lat, s.lon] as [number, number]));
      mapInstance.current.fitBounds(bounds, {
        paddingTopLeft:     [32, 32],
        paddingBottomRight: [32, panelH + 32],
        maxZoom: 12,
        animate: true,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitAllTrigger]);

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
    onLocatingChange?.(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
          mapInstance.current!.setView([latitude, longitude], APP_CONFIG.mapZoomCity, { animate: false });
        } else {
          mapInstance.current!.flyTo([latitude, longitude], APP_CONFIG.mapZoomCity, { duration: 0.8 });
        }

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
        onLocatingChange?.(false);
      },
      () => { setLocating(false); onLocatingChange?.(false); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [onLocatingChange]);

  /* Esegui locateMe quando il trigger esterno cambia */
  const prevLocateTriggerRef = useRef(0);
  useEffect(() => {
    if (locateTrigger && locateTrigger !== prevLocateTriggerRef.current) {
      prevLocateTriggerRef.current = locateTrigger;
      locateMe();
    }
  }, [locateTrigger, locateMe]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={mapRef}
        style={{ width: '100%', height: '100%' }}
        aria-label="Mappa spot BMX Italia"
        role="application"
      />

      {/* Bottoni spostati in MapClient come elementi fixed sopra la mappa */}
    </div>
  );
}
