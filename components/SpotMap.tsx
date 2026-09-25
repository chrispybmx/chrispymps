'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { SpotMapPin, SpotType } from '@/lib/types';
import { TIPI_SPOT, APP_CONFIG, PALETTE } from '@/lib/constants';
import { getFreshness, needsConfirmation } from '@/lib/freshness';
import 'leaflet/dist/leaflet.css';
import { spotSymbol } from '@/lib/spot-symbols';
import { computeGridClusters } from '@/lib/cluster-spots';
import { coreBounds } from '@/lib/core-bounds';
import type { MapView } from '@/lib/explore-state';
import { useLanguage } from '@/components/LanguageProvider';

let L: typeof import('leaflet') | null = null;

/* Zoom sotto il quale mostriamo i cluster invece dei pin individuali. */
const CLUSTER_ZOOM = 12;

/** Ricordiamo noi che il permesso e' stato concesso almeno una volta: Safari
 *  non espone `geolocation` nel Permissions API, e senza questo flag i suoi
 *  utenti dovrebbero ritoccare il tasto a ogni visita. */
const GEO_CONCESSA_KEY = 'cmaps_geo_concessa';

interface SpotMapProps {
  spots:             SpotMapPin[];
  filterType:        SpotType | null;
  filterRegionBbox?: [number, number, number, number] | null;
  searchQuery:       string;
  onSpotClick:        (pin: SpotMapPin) => void;
  onAddSpotAt:        (lat: number, lon: number) => void;
  flyTarget?:         { lat: number; lon: number; zoom?: number; exact?: boolean; bounds?: [number, number, number, number] } | null;
  initialView?: MapView | null;
  onViewChanged?: (view: MapView) => void;
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
  /** Il tasto GPS ha fallito. Senza questo il bottone girava, si fermava e non
   *  succedeva niente: se il permesso e' gia' stato negato il browser rifiuta
   *  all'istante, e l'utente non aveva modo di sapere perche'. */
  onLocateError?: (messaggio: string) => void;
  // Viewport bounds callback — emitted on moveend/zoomend
  onBoundsChanged?: (bounds: { south: number; west: number; north: number; east: number }) => void;
  // Stile mappa
  darkMap?: boolean;
  /** Emesso quando la posizione dell'utente è nota (avvio automatico o tasto GPS). */
  onUserLocated?: (pos: { lat: number; lon: number }) => void;
}

/* ── SVG pin individuale ── */
function pinSvg(type: SpotType, condition: string, isSelected = false, updatedAt?: string | null): string {
  const fill = isSelected ? '#ff6a00' : '#181715';
  const ink = isSelected ? '#181715' : '#f6f3ee';
  const status = condition !== 'alive' ? '<path d="M27 7l8 8m0-8-8 8" stroke="#ff6a00" stroke-width="3"/>' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 40 50"><path d="M20 47 5 29A19 19 0 1 1 35 29Z" fill="${fill}" stroke="#f6f3ee" stroke-width="2.5"/><g transform="translate(8 7)" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${spotSymbol(type)}"/></g>${status}</svg>`;
}

/* ── Clustering geografico a griglia adattiva allo zoom ──
   Celle più piccole = cluster più granulari e precisi. */

export default function SpotMap({
  spots, filterType, filterRegionBbox, searchQuery, onSpotClick, onAddSpotAt, flyTarget,
  initialView, onViewChanged, selectedPin, overlayOffsetPx = 160, fitAllTrigger, radiusMode, radiusCenter, radiusKm, onMapClick,
  locateTrigger, onLocatingChange, onLocateError, onBoundsChanged, darkMap: darkMapProp, onUserLocated,
}: SpotMapProps) {
  const { text } = useLanguage();
  const textRef = useRef(text);
  textRef.current = text;
  const zoomControlRef = useRef<import('leaflet').Control.Zoom | null>(null);
  const mapRef           = useRef<HTMLDivElement>(null);
  const mapInstance      = useRef<import('leaflet').Map | null>(null);
  const markersRef       = useRef<import('leaflet').LayerGroup | null>(null);
  const hasInitialFit    = useRef(false);
  const circleRef        = useRef<import('leaflet').Circle | null>(null);
  const centerMarkerRef  = useRef<import('leaflet').Marker | null>(null);
  const userMarkerRef    = useRef<import('leaflet').Marker | null>(null);
  const onMapClickRef      = useRef(onMapClick);
  const onSpotClickRef     = useRef(onSpotClick);
  const onBoundsChangedRef = useRef(onBoundsChanged);
  const onViewChangedRef = useRef(onViewChanged);
  onViewChangedRef.current = onViewChanged;
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
  const tileLayerRef = useRef<import('leaflet').TileLayer | null>(null);

  const onUserLocatedRef = useRef(onUserLocated);
  useEffect(() => { onUserLocatedRef.current      = onUserLocated; });
  useEffect(() => { onMapClickRef.current       = onMapClick; });
  useEffect(() => { onSpotClickRef.current      = onSpotClick; });
  useEffect(() => { onBoundsChangedRef.current  = onBoundsChanged; });
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
        (s.country ?? '').toLowerCase().includes(q) ||
        (s.region ?? '').toLowerCase().includes(q) ||
        (s.country_code ?? '').toLowerCase().includes(q) ||
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

  const [mapReady, setMapReady] = useState(false);

  /* ── Init mappa ── */
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    let cancelled = false;
    import('leaflet').then((leaflet) => {
      if (cancelled || !mapRef.current || mapInstance.current) return;
      L = leaflet;
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        iconUrl:       '/leaflet/marker-icon.png',
        shadowUrl:     '/leaflet/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, {
        center: APP_CONFIG.mapCenter,
        zoom:   APP_CONFIG.mapZoom,
        zoomControl: false,
        attributionControl: true,
        maxBounds: L.latLngBounds([-85, -180], [85, 180]),
        maxBoundsViscosity: 1.0,     // blocco rigido ai bordi del mondo
        minZoom: 3,
      });

      const isDark = darkMapProp ?? false;
      tileLayerRef.current = L.tileLayer(
        isDark
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        isDark
          ? { attribution: '© OpenStreetMap contributors © CARTO', subdomains: 'abcd', maxZoom: 19, noWrap: true, className: 'osm-tiles' }
          : { attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19, noWrap: true, className: 'osm-tiles' }
      ).addTo(map);

      zoomControlRef.current = L.control.zoom({ position: 'bottomleft', zoomInTitle: textRef.current('Ingrandisci', 'Zoom in'), zoomOutTitle: textRef.current('Riduci', 'Zoom out') }).addTo(map);
      markersRef.current  = L.layerGroup().addTo(map);
      mapInstance.current = map;
      setMapReady(true);

      /* Aggiorna stato zoom React + emetti bounds */
      const emitBounds = () => {
        const b = map.getBounds();
        const center = map.getCenter();
        onViewChangedRef.current?.({lat:center.lat, lon:center.lng, zoom:map.getZoom()});
        onBoundsChangedRef.current?.({
          south: b.getSouth(), west: b.getWest(),
          north: b.getNorth(), east: b.getEast(),
        });
      };
      map.on('zoomend', () => { setZoom(map.getZoom()); emitBounds(); });
      map.on('moveend', emitBounds);

      /* ── Vista iniziale provvisoria (placeholder finché non arrivano gli spot) ──
         Mostriamo l'area storica della community come segnaposto visivo, ma NON
         marchiamo hasInitialFit: appena gli spot sono caricati, l'auto-fit
         data-driven (più sotto) inquadra DOVE SONO gli spot — oggi Italia,
         domani il mondo — senza nulla di hardcoded.
         paddingBottomRight bottom = overlayOffsetPx (= panelHeight/2) + handle. */
      const handleH = overlayOffsetPx > 0 ? 64 : 0;
      const PLACEHOLDER_BOUNDS = L.latLngBounds([36.0, 6.0], [47.5, 19.0]);
      if (initialView) {
        hasInitialFit.current = true;
        map.setView([initialView.lat, initialView.lon], initialView.zoom, {animate:false});
        setZoom(initialView.zoom);
        emitBounds();
      } else map.fitBounds(PLACEHOLDER_BOUNDS, {
        paddingTopLeft:     [20, 10],
        paddingBottomRight: [20, overlayOffsetPx + handleH],
        maxZoom: 7,
        animate: false,
      });
      /* Se l'utente interagisce prima che arrivino gli spot, l'auto-fit non deve
         scavalcare la sua vista. */
      map.once('dragstart', () => { hasInitialFit.current = true; });

      /* ── Posizione all'avvio, ma solo per chi l'ha gia' concessa ──
         Si apre a livello citta' invece che a zoom paese: il primo fotogramma
         deve rispondere a «c'e' qualcosa vicino a me?», non mostrare una
         cartina politica dell'Europa.
         Ma la richiesta NON parte piu' a freddo. Prima `getCurrentPosition`
         veniva chiamata all'init: il prompt di sistema compariva entro un
         secondo dall'apertura, sopra al banner cookie, prima che il rider
         avesse un motivo per dire di si'. Chi negava perdeva ordinamento per
         vicinanza, distanze sulle card e "portami li'" — e la scelta resta
         appiccicata alle visite successive.
         Ora si parte solo se il permesso e' gia' stato dato: in quel caso il
         browser non chiede niente e l'esperienza resta identica. A tutti gli
         altri lo chiede la card di benvenuto, con un tap esplicito. */
      const chiedibileInSilenzio = async (): Promise<boolean> => {
        try {
          if (localStorage.getItem(GEO_CONCESSA_KEY) === '1') return true;
        } catch { /* storage negato: si prosegue col Permissions API */ }
        try {
          const p = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          return p.state === 'granted';
        } catch {
          /* Safari non espone geolocation nel Permissions API: senza risposta
             non si rischia il prompt a freddo, decide il tap. */
          return false;
        }
      };

      if (navigator.geolocation) void (initialView ? Promise.resolve(false) : chiedibileInSilenzio()).then((ok) => {
        if (!ok) return;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!mapInstance.current || !L) return;
            const { latitude, longitude } = pos.coords;

            /* Zoom 11 = la zona intorno a te; poi offsettiamo verso il basso
               di metà altezza pannello così il centro cade nell'area visibile */
            const LOCAL_ZOOM = 11;
            mapInstance.current.setView([latitude, longitude], LOCAL_ZOOM, { animate: false });
            mapInstance.current.panBy([0, overlayOffsetPx], { animate: false });
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
                .bindTooltip(textRef.current('Sei qui', 'You are here'), { permanent: false, direction: 'top' });
            } else {
              userMarkerRef.current.setLatLng([latitude, longitude]);
            }

            onUserLocatedRef.current?.({ lat: latitude, lon: longitude });
          },
          () => { /* permesso revocato fra un giro e l'altro → nessuna azione */ },
          { timeout: 6000, maximumAge: 300_000 }
        );
      });

      /* Click sulla mappa → radius mode */
      map.on('click', (e) => {
        onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
      });
    });

    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markersRef.current  = null;
        userMarkerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const observer = new ResizeObserver(() => mapInstance.current?.invalidateSize({ pan: false }));
    observer.observe(mapRef.current);
    return () => observer.disconnect();
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady || !mapInstance.current || !L) return;
    zoomControlRef.current?.remove();
    zoomControlRef.current = L.control.zoom({ position: 'bottomleft', zoomInTitle: text('Ingrandisci', 'Zoom in'), zoomOutTitle: text('Riduci', 'Zoom out') }).addTo(mapInstance.current);
    userMarkerRef.current?.setTooltipContent(text('Sei qui', 'You are here'));
  }, [mapReady, text]);

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
        const radius = Math.min(14 + Math.sqrt(c.count), 21);
        const label = c.count === 1 ? `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="${spotSymbol(c.spots[0].type)}"/></svg>` : String(c.count);
        const fontSize = 14;
        const html = `<div style="
          width:${radius * 2}px; height:${radius * 2}px;
          background: #181715;
          border: 2px solid #f6f3ee;
          border-radius: 50%;
          display:flex; align-items:center; justify-content:center;
          font-family:system-ui,sans-serif;
          font-size:${fontSize}px;
          color:#f6f3ee; font-weight:700;
          box-shadow: none;
          cursor: pointer;
        ">${label}</div>`;

        const icon = L!.divIcon({
          html,
          className: 'spot-cluster',
          iconSize:  [radius * 2, radius * 2],
          iconAnchor:[radius, radius],
        });

        const marker = L!.marker([c.lat, c.lon], { icon, title: text(`${c.count} spot`, `${c.count} ${c.count === 1 ? 'spot' : 'spots'}`), alt: text(`${c.count} spot, ingrandisci la zona`, `${c.count} ${c.count === 1 ? 'spot' : 'spots'}, zoom into this area`) });
        const cityName = c.city
          ? c.city.charAt(0).toUpperCase() + c.city.slice(1)
          : text('Zona', 'Area');

        marker.bindTooltip(
          `<span style="font-family:monospace;font-size:12px"><b>${escapeMapLabel(cityName)}</b> · ${c.count} ${text('spot', c.count === 1 ? 'spot' : 'spots')}</span>`,
          { permanent: false, direction: 'top', offset: [0, -radius - 2] }
        );

        marker.on('click', () => {
          if (!mapInstance.current || !L) return;

          if (c.count === 1) {
            /* Spot singolo → vola diretto + apri la card — stessa animazione su mobile e desktop */
            const targetZoom  = 17;
            const targetPoint = mapInstance.current.project([c.lat, c.lon], targetZoom);
            const offsetPoint = targetPoint.add(L!.point(0, overlayOffsetPx));
            const offsetLL    = mapInstance.current.unproject(offsetPoint, targetZoom);
            mapInstance.current.flyTo(offsetLL, targetZoom, { duration: 0.45, easeLinearity: 0.35 });
            onSpotClickRef.current(c.spots[0]);
          } else {
            /* Multi-spot → flyToBounds cinematico, stesso comportamento su mobile e desktop */
            const bounds    = L!.latLngBounds(c.spots.map(s => [s.lat, s.lon] as [number, number]));
            const padBottom = overlayOffsetPx * 2 + 20;
            mapInstance.current.flyToBounds(bounds, {
              paddingTopLeft:     [24, 24],
              paddingBottomRight: [24, padBottom],
              maxZoom: 16,
              duration: 0.45,
            });
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
        const svg   = pinSvg(pin.type, pin.condition, isSel, pin.condition_updated_at);
        const pw    = isSel ? 48 : 38;
        const ph    = isSel ? 60 : 48;
        const icon  = L!.divIcon({
          html:        svg,
          className:   'spot-pin',
          iconSize:    [pw, ph],
          iconAnchor:  [pw / 2, ph],
          popupAnchor: [0, -(ph + 2)],
        });

        const marker = L!.marker([pin.lat, pin.lon], { icon, title: pin.name, alt: `${pin.name}, ${TIPI_SPOT[pin.type].label}` });
        // Un unico percorso per marker e lista: seleziona l’anteprima esistente.
        marker.on('click', () => onSpotClickRef.current(pin));

        markersRef.current!.addLayer(marker);
        pinMarkersRef.current.set(pin.id, marker); // salva ref per Effect 2
      });
    }

    prevSelIdRef.current = selPinRef.current?.id ?? null;

    /* ── Auto-fit al primo render con spot: sul grosso degli spot, non sugli estremi ── */
    const core = !hasInitialFit.current ? coreBounds(filtered) : null;
    if (core && mapInstance.current && L) {
      const bounds  = L.latLngBounds(core);
      const padBot  = overlayOffsetPx * 2 + 32;
      mapInstance.current.fitBounds(bounds, {
        paddingTopLeft:     [32, 32],
        paddingBottomRight: [32, padBot],
        maxZoom: 15,
        animate: false,   // primo render: nessuna animazione
      });
      hasInitialFit.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, clusters, zoom, mapReady, text]); // selectedPin gestito in Effect 2

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
          const svg  = pinSvg(pin.type, pin.condition, false, pin.condition_updated_at);
          const icon = L!.divIcon({ html: svg, className: 'spot-pin', iconSize: [38, 48], iconAnchor: [19, 48], popupAnchor: [0, -50] });
          marker.setIcon(icon);
        }
      }
    }

    // Applica icona selezionata al nuovo pin (bordo arancione, più grande)
    if (selectedPin) {
      const marker = pinMarkersRef.current.get(selectedPin.id);
      if (marker) {
        const svg  = pinSvg(selectedPin.type, selectedPin.condition, true, selectedPin.condition_updated_at);
        const icon = L!.divIcon({ html: svg, className: 'spot-pin', iconSize: [48, 60], iconAnchor: [24, 60], popupAnchor: [0, -62] });
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
    if (flyTarget.bounds) {
      const [south, west, north, east] = flyTarget.bounds;
      map.flyToBounds([[south, west], [north, east]], {
        paddingTopLeft: [32, 48], paddingBottomRight: [32, overlayOffsetPx * 2 + 32],
        maxZoom: 15, duration: .45,
        animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      });
      return;
    }

    /* Calcola offset dinamico: panel_height / 2
       Logica: proiettiamo il pin in pixel, poi AGGIUNGIAMO l'offset a Y (spostiamo
       il "centro virtuale" più a sud). Leaflet centra la mappa su quel punto sud,
       quindi il pin appare panel_height/2 px SOPRA il centro → al centro dello
       spazio visibile sopra il pannello. Sottrarre (vecchio codice) faceva l'opposto.
       overlayOffsetPx viene passato da MapClient come Math.round(panelHeight / 2),
       quindi traccia l'altezza reale del pannello anche quando l'utente lo trascina. */
    const offset = flyTarget.exact ? 0 : overlayOffsetPx;

    // Stessa animazione su mobile e desktop — lenta abbastanza da
    // permettere di seguire visivamente il percorso verso lo spot
    const targetPoint  = map.project([flyTarget.lat, flyTarget.lon], zoom);
    const offsetPoint  = targetPoint.add(L!.point(0, offset));
    const offsetLatLng = map.unproject(offsetPoint, zoom);
    map.flyTo(offsetLatLng, zoom, { duration: 0.45, animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches, easeLinearity: 0.35 });

  // eslint-disable-next-line react-hooks/exhaustive-deps -- overlayOffsetPx changes on drag; re-flying mid-drag would be jarring
  }, [flyTarget, mapReady]);

  /* ── Refit quando cambiano i filtri (fitAllTrigger incrementa in MapClient) ── */
  useEffect(() => {
    if (!fitAllTrigger || !hasInitialFit.current || !mapInstance.current || !L) return;
    const pins    = filteredRef.current;
    const hasRegion = !!filterRegionBboxRef.current;
    const hasSearch = !!searchQueryRef.current;
    /* overlayOffsetPx = panelHeight / 2 → panelHeight = overlayOffsetPx * 2.
       Usiamo il valore dinamico passato da MapClient invece della stima statica. */
    const padBot = overlayOffsetPx * 2 + 32;
    const pad    = { paddingTopLeft: [32, 32] as [number, number], paddingBottomRight: [32, padBot] as [number, number] };

    /* Caso 0: nessun risultato */
    if (pins.length === 0) {
      if (hasRegion) {
        const [latMin, lonMin, latMax, lonMax] = filterRegionBboxRef.current!;
        mapInstance.current.flyToBounds(L.latLngBounds([[latMin, lonMin], [latMax, lonMax]]), { ...pad, duration: 0.45 });
      }
      return;
    }

    /* Caso 1: singolo risultato → flyTo con offset pannello */
    if (pins.length === 1) {
      const p            = pins[0];
      const targetZoom   = 15;
      const targetPoint  = mapInstance.current.project([p.lat, p.lon], targetZoom);
      const offsetPoint  = targetPoint.add(L!.point(0, overlayOffsetPx));
      const offsetLatLng = mapInstance.current.unproject(offsetPoint, targetZoom);
      mapInstance.current.flyTo(offsetLatLng, targetZoom, { duration: 0.45, easeLinearity: 0.35 });
      return;
    }

    /* Caso 2: filtro regione attivo */
    if (hasRegion) {
      const [latMin, lonMin, latMax, lonMax] = filterRegionBboxRef.current!;
      mapInstance.current.flyToBounds(L.latLngBounds([[latMin, lonMin], [latMax, lonMax]]), { ...pad, duration: 0.45 });
      return;
    }

    /* Caso 3: ricerca testuale */
    if (hasSearch) {
      const bounds = L.latLngBounds(pins.map(s => [s.lat, s.lon] as [number, number]));
      mapInstance.current.flyToBounds(bounds, { ...pad, maxZoom: 14, duration: 0.45 });
      return;
    }

    /* Caso 4: solo filtro categoria */
    {
      const bounds = L.latLngBounds(pins.map(s => [s.lat, s.lon] as [number, number]));
      mapInstance.current.flyToBounds(bounds, { ...pad, maxZoom: 12, duration: 0.45 });
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

        // Il pannello copre la metà bassa su mobile: il cerchio va inquadrato sopra.
        mapInstance.current.fitBounds(circleRef.current.getBounds(), {
          paddingTopLeft: [40, 40], paddingBottomRight: [40, overlayOffsetPx * 2 + 40], maxZoom: 13,
        });
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
        mapInstance.current!.flyTo([latitude, longitude], APP_CONFIG.mapZoomCity, { duration: 0.45, easeLinearity: 0.35 });

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
              .bindTooltip(textRef.current('Sei qui', 'You are here'), { permanent: false, direction: 'top' });
          }
        }
        /* Da qui in poi il permesso c'e': le prossime visite possono
           localizzare all'avvio senza far comparire nessun prompt. */
        try { localStorage.setItem(GEO_CONCESSA_KEY, '1'); } catch { /* */ }
        onUserLocatedRef.current?.({ lat: latitude, lon: longitude });
        setLocating(false);
        onLocatingChange?.(false);
      },
      (err) => {
        setLocating(false);
        onLocatingChange?.(false);
        /* PERMISSION_DENIED (1) e' il caso che confondeva: il permesso era
           stato negato in una visita precedente, il browser rifiuta senza
           chiedere niente e il bottone sembrava semplicemente rotto. */
        onLocateError?.(
          err.code === err.PERMISSION_DENIED
            ? textRef.current('Posizione bloccata per questo sito. Sbloccala dal lucchetto accanto all’indirizzo, poi riprova.', 'Location access is blocked for this site. Enable it in your browser’s site settings, then try again.')
            : err.code === err.TIMEOUT
              ? textRef.current('Il GPS ci sta mettendo troppo. Riprova all’aperto.', 'GPS is taking too long. Try again outdoors.')
              : textRef.current('Non riesco a leggere la posizione.', 'Your location could not be determined.'),
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [onLocatingChange, onLocateError]);

  /* Cambia tile layer quando darkMapProp cambia */
  useEffect(() => {
    if (!mapInstance.current || !tileLayerRef.current || !L) return;
    tileLayerRef.current.remove();
    tileLayerRef.current = L.tileLayer(
      darkMapProp
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      darkMapProp
        ? { attribution: '© OpenStreetMap contributors © CARTO', subdomains: 'abcd', maxZoom: 19, className: 'osm-tiles' }
        : { attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19, className: 'osm-tiles' }
    ).addTo(mapInstance.current);
  }, [darkMapProp]);

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
        className={darkMapProp ? undefined : 'cm-cartography-warm'}
        style={{ width: '100%', height: '100%' }}
        aria-label={text('Mappa spot BMX, skate e scooter', 'BMX, skate and scooter spot map')}
        role="application"
      />

      {/* Bottoni ora gestiti da MapClient */}
    </div>
  );
}

function escapeMapLabel(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
}
