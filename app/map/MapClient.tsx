'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import Link from 'next/link';
import type { SpotMapPin, SpotType, SpotCondition, Ostacolo } from '@/lib/types';
import { REGIONI_ITALIA, TIPI_SPOT, OSTACOLI, CONDIZIONI } from '@/lib/constants';
import TopBar from '@/components/TopBar';
import AddSpotModal from '@/components/AddSpotModal';
import AuthModal from '@/components/AuthModal';
import BottomNav from '@/components/BottomNav';
import Lightbox from '@/components/Lightbox';
import { useToast } from '@/components/Toast';
import { useFavorites } from '@/hooks/useFavorites';
import { useUser } from '@/hooks/useUser';
import MapIcon from '@/components/MapIcon';
import { getFreshness } from '@/lib/freshness';
import FreshnessDot from '@/components/FreshnessDot';
import { miniatura } from '@/lib/immagini';
import NearbyEventBanner from '@/components/NearbyEventBanner';
import AuthErrorBanner from '@/components/AuthErrorBanner';
import { findNearby } from '@/lib/nearby-radar';
import { loadMapSpots } from '@/lib/map-spots';
import { useMapPhotos } from '@/hooks/useMapPhotos';
import { pointInBounds, normalizeMapBounds } from '@/lib/spot-query';
import { useLanguage } from '@/components/LanguageProvider';
import { EXPLORE_STATE_KEY, parseExploreState, type MapView, type ExploreState } from '@/lib/explore-state';

/* ── Haversine ── */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toR = (x: number) => x * Math.PI / 180;
  const dLat = toR(lat2 - lat1);
  const dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Distanza in forma leggibile: sotto il km si scende ai metri. */
function formatKm(km: number): string {
  if (km < 1)   return `${Math.round(km * 1000)} m`;
  if (km < 10)  return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

const SpotMap = dynamic(() => import('@/components/SpotMap'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--gray-800)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Shimmer skeleton */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(110deg, var(--gray-800) 30%, rgba(255,106,0,0.04) 50%, var(--gray-800) 70%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.8s ease-in-out infinite',
      }} />
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="1.5" strokeLinecap="round" style={{ opacity: 0.6, animation: 'pulse 1.5s ease-in-out infinite' }}>
          <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/>
          <path d="M8 2v16M16 6v16"/>
        </svg>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--orange)', fontSize: 14, opacity: 0.7 }}>
          CARICAMENTO MAPPA...
        </span>
      </div>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
      `}</style>
    </div>
  ),
});

interface MapClientProps { initialSpots: SpotMapPin[]; autoAdd?: boolean; initialSpotSlug?: string; initialQuery?: string }

const topOffset_MOBILE  = 116;  // topbar only (filter bar hidden on mobile)
const topOffset_DESKTOP = 120; // topbar + filter bar
/** Raggio entro cui uno spot conta come "nella tua zona". */
const NEARBY_KM       = 25;
const PANEL_MIN       = 64;
const PANEL_SNAP      = 140;
const EXPANDED_CARD_H = 0; // not used — expanded cards open to 92% viewport
function DEFAULT_PANEL_H() {
  return typeof window !== 'undefined'
    ? Math.min(340, Math.max(220, window.innerHeight * 0.38))
    : 260;
}

/* ════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════ */
export default function MapClient({ initialSpots, autoAdd, initialSpotSlug, initialQuery }: MapClientProps) {
  const { text, language } = useLanguage();
  const [spots, setSpots]    = useState<SpotMapPin[]>(initialSpots);
  const [spotsLoading, setSpotsLoading] = useState(initialSpots.length === 0);
  const [spotsError, setSpotsError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  // Stable random seed per session — shuffle order changes per visit, not per render
  const shuffleSeed = useRef(Math.random());

  // Fetch spots client-side for instant page load
  useEffect(() => {
    if (initialSpots.length > 0) return; // already have server data
    const controller = new AbortController();
    let active = true;
    setSpotsLoading(true);
    setSpotsError(null);
    const timeout = window.setTimeout(() => controller.abort(), 15000);

    loadMapSpots(controller.signal)
      .then(data => { if (active) setSpots(data); })
      .catch(() => {
        if (active) setSpotsError('Non riesco a caricare gli spot. Controlla la connessione e riprova.');
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) setSpotsLoading(false);
      });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [initialSpots, loadAttempt]);
  const user = useUser();
  const { toast } = useToast();
  const { isFav, toggleFav: toggleFavHook, error: favoriteError, loaded: favoritesLoaded, reload: reloadFavorites } = useFavorites();
  const [filterType,      setFilterType]      = useState<SpotType | null>(null);
  const [filterRegion,    setFilterRegion]    = useState<typeof REGIONI_ITALIA[0] | null>(null);
  const [filterCondition, setFilterCondition] = useState<SpotCondition | null>(null);
  const [filterDifficulty,setFilterDifficulty]= useState<string | null>(null);
  /* Filtro per ostacolo: la domanda vera del rider non e' «dammi gli spot
     street», e' «dove trovo un rail». Fino ad ora il sito non sapeva
     rispondere, perche' l'informazione non esisteva. */
  const [filterOstacolo,  setFilterOstacolo]  = useState<Ostacolo | null>(null);
  const [mapBounds, setMapBounds] = useState<{ south: number; west: number; north: number; east: number } | null>(null);
  const [searchQuery,        setSearchQuery]        = useState('');
  const [addOpen,            setAddOpen]            = useState(false);
  const [addLat,             setAddLat]             = useState<number | undefined>();
  const [addLon,             setAddLon]             = useState<number | undefined>();
  const [flyTarget,          setFlyTarget]          = useState<{ lat: number; lon: number; zoom?: number; exact?: boolean; bounds?: [number, number, number, number] } | null>(null);
  const [authOpen,           setAuthOpen]           = useState(false);
  const [fitAllTrigger,      setFitAllTrigger]      = useState(0);

  const pendingAddRef = useRef(false);
  useEffect(() => {
    if (user && pendingAddRef.current) { pendingAddRef.current = false; setAuthOpen(false); setAddOpen(true); }
  }, [user]);
  /* ── Auth-gated add spot ── */
  const openAddSpot = useCallback(() => {
    if (!user) { pendingAddRef.current = true; setAuthOpen(true); return; }
    setAddOpen(true);
  }, [user]);

  /* ── Auto-open add modal se URL contiene ?add=1 ── */
  useEffect(() => {
    if (autoAdd && user !== undefined) {
      if (user) setAddOpen(true);
      else { pendingAddRef.current = true; setAuthOpen(true); }
    }
  }, [autoAdd, user]);

  /* ── Pannello ridimensionabile ── */
  const [panelHeight,   setPanelHeight]   = useState<number>(320);
  const [panelSnapping, setPanelSnapping] = useState(false); // true durante animazione snap
  useEffect(() => { setPanelHeight(DEFAULT_PANEL_H()); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const dragState  = useRef<{ startY: number; startH: number } | null>(null);
  const didDragRef = useRef(false); // distingue tap da drag sul grip

  const snapTo = useCallback((h: number) => {
    setPanelSnapping(true);
    setPanelHeight(h);
    setTimeout(() => setPanelSnapping(false), 260);
  }, []);

  const onDragStart = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = { startY: e.clientY, startH: panelHeight };
    didDragRef.current = false;
  }, [panelHeight]);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return;
    const delta = dragState.current.startY - e.clientY;
    if (Math.abs(delta) > 6) didDragRef.current = true;
    const newH  = Math.min(
      Math.max(200, window.innerHeight - 196),
      Math.max(PANEL_MIN, dragState.current.startH + delta),
    );
    setPanelHeight(newH);
  }, []);

  const onDragEnd = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return;
    const startH  = dragState.current.startH;
    const h       = startH + (dragState.current.startY - e.clientY);
    const wasTap  = !didDragRef.current;
    dragState.current  = null;
    didDragRef.current = false;
    if (wasTap) {
      // Tap: da chiuso apre, da espanso torna a default, altrimenti chiude.
      // startH è l'altezza al tocco: panelHeight qui sarebbe quella del primo render.
      if (startH <= PANEL_MIN + 10 || startH > window.innerHeight * 0.75) snapTo(DEFAULT_PANEL_H());
      else snapTo(PANEL_MIN);
    } else if (h < PANEL_SNAP)               snapTo(PANEL_MIN);
    else if (h > window.innerHeight * 0.75) snapTo(Math.round(Math.max(200, window.innerHeight - 196)));
    else                                    snapTo(DEFAULT_PANEL_H());
  }, [snapTo]);

  /* ── Raggio ── dichiarati PRIMA di filtered che li usa ──
     Il centro è sempre la posizione del rider: il raggio vive dentro
     "Vicino a me" (chip 10/25/50 km), non più in un pannello a parte. */
  const [radiusMode,      setRadiusMode]      = useState(false);
  const [radiusCenter,    setRadiusCenter]    = useState<{ lat: number; lon: number } | null>(null);
  const [radiusKm,        setRadiusKm]        = useState(10);

  /* ── Bottoni mappa: locate trigger ── */
  const [locateTrigger, setLocateTrigger] = useState(0);
  const [isLocating,    setIsLocating]    = useState(false);

  /* Posizione utente, emessa da SpotMap sia all'avvio automatico sia dal tasto GPS.
     Serve a ordinare il pannello per vicinanza e a scrivere le distanze sulle card:
     senza, la prima domanda del rider («c'è qualcosa vicino a me?») resta senza risposta. */
  const [userPos, setUserPos] = useState<{ lat: number; lon: number } | null>(null);

  /* ── Auto-hide bottoni mappa ── */
  /* I bottoni si nascondono quando il pannello è alto (> 62% vh).
     Toccando il bordo destro si rivelano per 4 secondi. */
  const [btnsRevealed,  setBtnsRevealed] = useState(false);
  const btnsRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealButtons = useCallback(() => {
    if (btnsRevealTimerRef.current) clearTimeout(btnsRevealTimerRef.current);
    setBtnsRevealed(true);
    btnsRevealTimerRef.current = setTimeout(() => setBtnsRevealed(false), 4000);
  }, []);
  useEffect(() => () => {
    if (btnsRevealTimerRef.current) clearTimeout(btnsRevealTimerRef.current);
  }, []);

  /* ── Stile mappa (chiaro/scuro) ── */
  /* Chiara di default. Era stata messa scura per uniformarla alla UI, ma
     Christian la preferisce chiara: sulle tile scure gli spot si leggono
     peggio quando si gira davvero, e la coerenza cromatica vale meno della
     leggibilità. Il toggle resta, la preferenza salvata vince. */
  const [darkMap, setDarkMap] = useState<boolean>(() => {
    try { return localStorage.getItem('cmaps_dark_map') === '1'; }
    catch { return false; }
  });
  const toggleDarkMap = () => setDarkMap(prev => {
    const next = !prev;
    try { localStorage.setItem('cmaps_dark_map', next ? '1' : '0'); } catch { /* */ }
    return next;
  });

  /* ── Spot Radar — notifica spot vicini ── */
  useEffect(() => {
    if (spots.length === 0) return;
    if (!('geolocation' in navigator)) return;

    const RADAR_KEY     = 'cmaps_radar_enabled';
    const LAST_CHECK    = 'cmaps_radar_last_check';
    const LAST_NOTIFY   = 'cmaps_radar_last_notify';
    const CHECK_MS      = 3 * 60 * 60 * 1000;  // 3h
    const NOTIFY_MS     = 24 * 60 * 60 * 1000;  // 24h

    const run = () => {
      try {
        if (localStorage.getItem(RADAR_KEY) !== '1') return;
        const now = Date.now();
        if (now - Number(localStorage.getItem(LAST_CHECK) || 0) < CHECK_MS) return;
        localStorage.setItem(LAST_CHECK, String(now));

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const result = findNearby(
              { lat: pos.coords.latitude, lon: pos.coords.longitude },
              spots,
              5,
            );
            if (result.count === 0) return;
            if (Date.now() - Number(localStorage.getItem(LAST_NOTIFY) || 0) < NOTIFY_MS) return;
            localStorage.setItem(LAST_NOTIFY, String(Date.now()));

            const km = result.nearestKm!;
            const rounded = km < 1 ? km.toFixed(1) : km.toFixed(0);
            const msg = result.count === 1
              ? `📡 C'è uno spot a circa ${rounded} km da te.`
              : `📡 Ci sono ${result.count} spot entro 5 km. Il più vicino è a ${rounded} km.`;
            toast(msg, 'info');
          },
          () => {},
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 30 * 60 * 1000 },
        );
      } catch {}
    };

    run();
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [spots, toast]);

  /* ── Spot attivo (bordo + mappa) e spot espanso (contenuto) — separati ── */
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [windowH,   setWindowH]   = useState(700);
  const topOffset = isDesktop ? topOffset_DESKTOP : topOffset_MOBILE;
  useEffect(() => {
    const check = () => {
      setIsDesktop(window.innerWidth >= 768);
      setWindowH(window.innerHeight);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const [scrollToId,     setScrollToId]     = useState<string | null>(null);
  const scrollInstantRef = useRef(false); // true → usa 'instant' invece di 'smooth'

  const [sessionReady, setSessionReady] = useState(false);
  const [initialView, setInitialView] = useState<MapView | null>(null);
  const [currentView, setCurrentView] = useState<MapView | null>(null);
  const returnViewRef = useRef<MapView | null>(null);
  const returnBoundsRef = useRef<typeof mapBounds>(null);
  const listScrollRef = useRef(0);
  const returnScrollRef = useRef(0);
  const initialScrollRef = useRef(0);

  useEffect(() => {
    try {
      const saved = parseExploreState(sessionStorage.getItem(EXPLORE_STATE_KEY));
      if (saved) {
        setFilterType(saved.type); setFilterRegion(REGIONI_ITALIA.find(r => r.label === saved.region) ?? null);
        setFilterCondition(saved.condition); setFilterDifficulty(saved.difficulty); setFilterOstacolo(saved.obstacle);
        setSearchQuery(saved.search); setActiveListId(saved.selected); setExpandedId(saved.expanded);
        setInitialView(saved.view); setCurrentView(saved.view);
        setPanelHeight(Math.min(saved.panelHeight, Math.max(200, window.innerHeight - 196)));
        returnViewRef.current = saved.returnView; returnBoundsRef.current = saved.returnBounds;
        listScrollRef.current = saved.scrollTop; initialScrollRef.current = saved.scrollTop; returnScrollRef.current = saved.returnScroll;
        setVisibleCount(Math.max(32, Math.ceil(Math.max(saved.scrollTop, saved.returnScroll) / 100) + 16));
        shuffleSeed.current = saved.seed;
        setRadiusMode(saved.radiusMode); setRadiusCenter(saved.radiusCenter); setRadiusKm(saved.radiusKm);
      }
    } catch { /* Session storage may be unavailable; exploration still works. */ }
    setSessionReady(true);
  }, []);

  const persistExplore = useCallback(() => {
    if (!sessionReady) return;
    const saved: ExploreState = {
      version:1, savedAt:Date.now(), search:searchQuery, type:filterType, region:filterRegion?.label ?? null,
      condition:filterCondition, difficulty:filterDifficulty as ExploreState['difficulty'], obstacle:filterOstacolo,
      selected:activeListId, expanded:expandedId, view:currentView, returnView:returnViewRef.current, returnBounds:returnBoundsRef.current,
      panelHeight, scrollTop:listScrollRef.current, returnScroll:returnScrollRef.current, seed:shuffleSeed.current,
      radiusMode, radiusCenter, radiusKm, radiusPanelOpen:false,
    };
    try { sessionStorage.setItem(EXPLORE_STATE_KEY, JSON.stringify(saved)); } catch { /* Optional continuity. */ }
  }, [sessionReady, searchQuery, filterType, filterRegion, filterCondition, filterDifficulty, filterOstacolo, activeListId, expandedId, currentView, panelHeight, radiusMode, radiusCenter, radiusKm]);
  useEffect(() => { persistExplore(); }, [persistExplore]);

  /* Pre-calcola le distanze una volta sola per il filtro a raggio */
  const distanceMap = useMemo(() => {
    if (!radiusCenter) return new Map<string, number>();
    const m = new Map<string, number>();
    spots.forEach(s => m.set(s.id, haversineKm(radiusCenter.lat, radiusCenter.lon, s.lat, s.lon)));
    return m;
  }, [spots, radiusCenter]);

  const filtered = useMemo(() => {
    let result = spots.filter((s) => {
      if (filterType && s.type !== filterType) return false;
      if (filterRegion) {
        const [latMin, lonMin, latMax, lonMax] = filterRegion.bbox;
        if (s.lat < latMin || s.lat > latMax || s.lon < lonMin || s.lon > lonMax) return false;
      }
      if (filterCondition && s.condition !== filterCondition) return false;
      if (filterOstacolo && !(s.ostacoli ?? []).includes(filterOstacolo)) return false;
      if (filterDifficulty && s.difficulty !== filterDifficulty) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase().replace(/^@/, '');
        return (
          s.name.toLowerCase().includes(q) ||
          (s.city ?? '').toLowerCase().includes(q) ||
          (s.country ?? '').toLowerCase().includes(q) ||
          (s.region ?? '').toLowerCase().includes(q) ||
          (s.submitted_by_username ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
    // Raggio attivo → filtra per distanza (usa distanceMap)
    if (radiusMode && radiusCenter) {
      result = result
        .filter(s => (distanceMap.get(s.id) ?? Infinity) <= radiusKm)
        .sort((a, b) => (distanceMap.get(a.id) ?? 0) - (distanceMap.get(b.id) ?? 0));
    }
    return result;
  }, [spots, filterType, filterRegion, filterCondition, filterDifficulty, filterOstacolo, searchQuery, radiusMode, radiusCenter, radiusKm, distanceMap]);

  /* Spot visibili nel pannello: filtrati per viewport della mappa + ordine casuale.
     Se l'utente è in radius mode o ha una ricerca attiva, non filtrare per viewport. */
  const panelSpots = useMemo(() => {
    let list = filtered;
    // Filtra per viewport solo quando non c'è ricerca/radius attivo e abbiamo bounds.
    // Con uno spot aperto vale la zona di prima: lo zoom sullo spot non deve
    // ridurre "124 spot" a "1 spot" né svuotare "Altri risultati".
    const hasActiveFilter = !!(searchQuery || (radiusMode && radiusCenter));
    const bounds = expandedId && returnBoundsRef.current ? returnBoundsRef.current : mapBounds;
    if (bounds && !hasActiveFilter) {
      list = list.filter(s =>
        pointInBounds(s, normalizeMapBounds(bounds))
      );
    }
    // Garantisci che lo spot espanso/attivo sia sempre incluso (anche durante flyTo
    // quando il viewport non lo contiene ancora)
    if (expandedId && !list.find(s => s.id === expandedId)) {
      const expandedSpot = filtered.find(s => s.id === expandedId);
      if (expandedSpot) list = [expandedSpot, ...list];
    }
    /* Se sappiamo dov'è l'utente, il più vicino va per primo: è l'ordine che
       risponde alla domanda con cui apre l'app. Altrimenti resta lo shuffle
       con seed stabile (ordine casuale per sessione, non per render). */
    if (userPos) {
      return [...list].sort((a, b) =>
        haversineKm(userPos.lat, userPos.lon, a.lat, a.lon) -
        haversineKm(userPos.lat, userPos.lon, b.lat, b.lon)
      );
    }
    return [...list].sort((a, b) => (b.approved_at ?? '').localeCompare(a.approved_at ?? '') || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }, [filtered, mapBounds, searchQuery, radiusMode, radiusCenter, expandedId, userPos]);

  const [visibleCount, setVisibleCount] = useState(32);
  const areaKey = [searchQuery, filterType, filterRegion?.label, filterCondition, filterDifficulty, filterOstacolo, radiusMode, radiusKm, mapBounds?.south, mapBounds?.west, mapBounds?.north, mapBounds?.east].join('|');
  useEffect(() => {
    if (sessionReady && !expandedId) setVisibleCount(Math.max(32, Math.ceil(initialScrollRef.current / 100) + 16));
  }, [areaKey, expandedId, sessionReady]);
  const visibleSpots = useMemo(() => {
    const rows = panelSpots.slice(0, visibleCount);
    const selected = expandedId && panelSpots.find(spot => spot.id === expandedId);
    return selected && !rows.some(spot => spot.id === selected.id) ? [selected, ...rows] : rows;
  }, [panelSpots, visibleCount, expandedId]);
  const {photos: spotPhotos, error: photoError, retry: retryPhotos} = useMapPhotos(
    mapBounds || searchQuery ? visibleSpots.map(spot => spot.id) : [], expandedId,
  );
  const visibleWithPhotos = visibleSpots.map(spot => {
    const photos = spotPhotos[spot.id];
    return photos ? {...spot, cover_url:photos.cover_url, cover_source:photos.cover_source, photo_urls:photos.photo_urls, photo_sources:photos.photo_sources} : spot;
  });

  /* Spot più vicino in assoluto (non filtrato, non limitato al viewport).
     Serve all'empty state: quando la zona inquadrata è vuota, la risposta
     utile non è "nessuno spot trovato" ma "il più vicino è a N km". */
  const nearestOverall = useMemo(() => {
    if (!userPos || spots.length === 0) return null;
    let best: SpotMapPin | null = null;
    let bestKm = Infinity;
    for (const s of spots) {
      const km = haversineKm(userPos.lat, userPos.lon, s.lat, s.lon);
      if (km < bestKm) { bestKm = km; best = s; }
    }
    return best ? { spot: best, km: bestKm } : null;
  }, [userPos, spots]);

  /* Quanti spot cadono nel raggio "zona" — alimenta la schermata di benvenuto. */
  const nearbyCount = useMemo(() => {
    if (!userPos) return null;
    return spots.filter(s => haversineKm(userPos.lat, userPos.lon, s.lat, s.lon) <= NEARBY_KM).length;
  }, [userPos, spots]);

  const filtersActive = !!(filterType || filterRegion || filterCondition || filterDifficulty || filterOstacolo || searchQuery);

  /* Pin selezionato sulla mappa (marker ingrandito + orange outline) */
  const selectedPin = useMemo(() =>
    filtered.find(s => s.id === activeListId) ?? null,
  [filtered, activeListId]);

  useEffect(() => {
    if (spotsLoading || !expandedId || filtered.some(s => s.id === expandedId)) return;
    setExpandedId(null); setActiveListId(null);
    returnViewRef.current = null; returnBoundsRef.current = null;
    initialScrollRef.current = 0;
  }, [filtered, expandedId, spotsLoading]);

  /* Auto-refit mappa quando cambiano i filtri principali.
     Usiamo un ref per saltare il primo render (mount). */
  const filterInitRef = useRef(false);
  const skipFilterFitRef = useRef(false);
  useEffect(() => {
    if (!sessionReady) return;
    if (!filterInitRef.current) { filterInitRef.current = true; return; }
    if (skipFilterFitRef.current) { skipFilterFitRef.current = false; return; }
    // Incrementa il trigger → SpotMap farà fitBounds sui filtered
    setFitAllTrigger(n => n + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterRegion, filterCondition, filterDifficulty, filterOstacolo, searchQuery, sessionReady]);

  const handleFilterRegion = useCallback((label: string | null) => {
    if (!label) { setFilterRegion(null); return; }
    const region = REGIONI_ITALIA.find(r => r.label === label) ?? null;
    setFilterRegion(region);
    // NON setFlyTarget: il fitAllTrigger (useEffect su filterRegion) farà fitBounds
    // sugli spot reali della regione → zoom calibrato sui dati, non sul centro bbox
  }, []);

  // Il click sulla mappa NON imposta più il centro del raggio —
  // il centro si sceglie solo tramite GPS o selezione città nel pannello
  const handleMapClick = useCallback((lat: number, lon: number) => {
    /* intenzionalmente vuoto: radius center viene da GPS o city picker */
    void lat; void lon;
  }, []);

  /* "Vicino a me": null = tutti gli spot sulla mappa, altrimenti raggio in km
     attorno alla posizione del rider. */
  const setNearRadius = useCallback((km: number | null) => {
    if (km === null || !userPos) { setRadiusMode(false); setRadiusCenter(null); return; }
    setRadiusCenter(userPos);
    setRadiusKm(km);
    setRadiusMode(true);
  }, [userPos]);

  /* Il tap su "Vicino a me" chiede la posizione e, appena arriva, mostra la
     zona (NEARBY_KM): lo zoom da città del GPS da solo lascia spesso la lista
     vuota, e "0 spot" non risponde alla domanda. */
  const nearPendingRef = useRef(false);
  const askNearMe = useCallback(() => {
    nearPendingRef.current = true;
    setLocateTrigger(n => n + 1);
  }, []);
  useEffect(() => {
    if (!userPos || !nearPendingRef.current) return;
    nearPendingRef.current = false;
    setNearRadius(NEARBY_KM);
  }, [userPos, setNearRadius]);

  /* Click su uno spot (da mappa o da lista) → espandi card + vola mappa
     Zoom 13: mostra il quartiere/zona, non solo il singolo marciapiede,
     così l'utente capisce subito dove si trova lo spot nel contesto urbano. */
  /* Lock temporaneo: impedisce all'IntersectionObserver di sovrascrivere
     l'activeListId subito dopo la chiusura di una card (il collasso cambia
     le altezze e il IO si riattiverebbe sullo spot sbagliato). */
  const ioLockRef = useRef(false);

  const handleSpotClick = useCallback((pin: SpotMapPin, forceOpen = false) => {
    if (!forceOpen && expandedId === pin.id) {
      // Render the saved portion before the child's layout effect restores scroll.
      setVisibleCount(count => Math.max(count, Math.ceil(returnScrollRef.current / 100) + 16));
      setExpandedId(null);
      initialScrollRef.current = returnScrollRef.current;
      if (returnViewRef.current) setFlyTarget({...returnViewRef.current, exact:true});
      if (returnBoundsRef.current) setMapBounds(returnBoundsRef.current);
      snapTo(DEFAULT_PANEL_H());
      return;
    }
    if (!expandedId) {
      returnViewRef.current = currentView;
      returnBoundsRef.current = mapBounds;
      returnScrollRef.current = listScrollRef.current;
    }
    initialScrollRef.current = 0;
    setActiveListId(pin.id); setExpandedId(pin.id); setScrollToId(pin.id);
    setFlyTarget({ lat:pin.lat, lon:pin.lon, zoom:16 });
    snapTo(Math.min(480, Math.max(200, window.innerHeight - 300)));
  }, [expandedId, currentView, mapBounds, snapTo]);

  const activateDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleActivateFromScroll = useCallback((id: string) => {
    if (ioLockRef.current || expandedId) return; // lock attivo — ignora
    if (activateDebounce.current) clearTimeout(activateDebounce.current);
    activateDebounce.current = setTimeout(() => {
      setActiveListId(id);
    }, 120);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedId]);

  // La scelta esplicita di un risultato ha precedenza sui filtri precedenti.
  const handleSearchSpot = useCallback((pin: SpotMapPin) => {
    skipFilterFitRef.current = !!(filterType || filterRegion || filterCondition || filterDifficulty || filterOstacolo || searchQuery !== pin.name);
    const hadFilters = !!(filterType || filterRegion || filterCondition || filterDifficulty || filterOstacolo || radiusMode);
    setFilterType(null); setFilterRegion(null); setFilterCondition(null);
    setFilterDifficulty(null); setFilterOstacolo(null);
    setRadiusMode(false); setRadiusCenter(null);
    setSearchQuery(pin.name);
    handleSpotClick(pin, true);
    // Tornare ai risultati della nuova ricerca non deve ripristinare la vecchia zona.
    returnViewRef.current = null; returnBoundsRef.current = null; returnScrollRef.current = 0;
    if (hadFilters) toast(text('Filtri rimossi per mostrare lo spot scelto.', 'Filters cleared to show the selected spot.'), 'info');
  }, [filterType, filterRegion, filterCondition, filterDifficulty, filterOstacolo, searchQuery, radiusMode, handleSpotClick, toast, text]);

  const consumedLink = useRef('');
  useEffect(() => {
    if (!sessionReady || spotsLoading || spotsError) return;
    const key = `${initialSpotSlug ?? ''}|${initialQuery ?? ''}`;
    if (key === '|' || consumedLink.current === key) return;
    consumedLink.current = key;
    if (initialSpotSlug) {
      const spot = spots.find(item => item.slug === initialSpotSlug || item.id === initialSpotSlug);
      if (spot) handleSearchSpot(spot);
      else toast(text('Questo spot non è disponibile sulla mappa.', 'This spot is not available on the map.'), 'info');
    } else if (initialQuery) {
      setSearchQuery(initialQuery); setFilterType(null); setFilterRegion(null); setFilterCondition(null);
      setFilterDifficulty(null); setFilterOstacolo(null); setExpandedId(null); setActiveListId(null);
      setRadiusMode(false); setRadiusCenter(null);
    }
  }, [sessionReady, spotsLoading, spotsError, spots, initialSpotSlug, initialQuery, handleSearchSpot, text, toast]);

  const handleCitySelect = useCallback((city: string, lat: number, lon: number) => {
    // Conserva il tipo di spot cercato, sostituisce solo la zona e il testo.
    skipFilterFitRef.current = !!(searchQuery || filterRegion);
    setSearchQuery(''); setFilterRegion(null);
    setRadiusMode(false); setRadiusCenter(null);
    setExpandedId(null); setActiveListId(null);
    returnViewRef.current = null; returnBoundsRef.current = null;
    initialScrollRef.current = 0;
    snapTo(DEFAULT_PANEL_H());
    const citySpots = spots.filter(s =>
      s.city?.trim().toLocaleLowerCase('it') === city.trim().toLocaleLowerCase('it') &&
      haversineKm(lat, lon, s.lat, s.lon) < 50 &&
      (!filterType || s.type === filterType) &&
      (!filterCondition || s.condition === filterCondition) &&
      (!filterDifficulty || s.difficulty === filterDifficulty) &&
      (!filterOstacolo || (s.ostacoli ?? []).includes(filterOstacolo))
    );
    const bounds: [number, number, number, number] | undefined = citySpots.length ? [
      Math.min(lat, ...citySpots.map(s => s.lat)), Math.min(lon, ...citySpots.map(s => s.lon)),
      Math.max(lat, ...citySpots.map(s => s.lat)), Math.max(lon, ...citySpots.map(s => s.lon)),
    ] : undefined;
    setFlyTarget({ lat, lon, zoom: 13, bounds });
  }, [searchQuery, filterRegion, snapTo, spots, filterType, filterCondition, filterDifficulty, filterOstacolo]);

  const handleAddSpotAt = useCallback((lat: number, lon: number) => {
    setAddLat(lat); setAddLon(lon);
    if (!user) { pendingAddRef.current = true; setAuthOpen(true); return; }
    setAddOpen(true);
  }, [user]);

  /* Bottoni mappa: nascosti quando il pannello è alto (>62% vh) */
  const autoHidden = !isDesktop && panelHeight > windowH * 0.62;
  const showBtns   = !autoHidden || btnsRevealed;

  return (
    <div className="cm-map-app" style={{ height: '100dvh', overflow: 'hidden', '--map-sheet-height': `${panelHeight}px` } as React.CSSProperties}>

      <TopBar
        onSearch={value => { setSearchQuery(value); if (!value) { setExpandedId(null); setActiveListId(null); initialScrollRef.current = 0; snapTo(DEFAULT_PANEL_H()); } }}
        activeSearch={searchQuery}
        onFilterType={setFilterType}
        onFilterRegion={handleFilterRegion}
        onFilterCondition={setFilterCondition}
        onFilterDifficulty={setFilterDifficulty}
        onFilterOstacolo={setFilterOstacolo}
        activeOstacolo={filterOstacolo}
        onAddSpot={openAddSpot}
        activeType={filterType}
        activeRegion={filterRegion?.label ?? null}
        activeCondition={filterCondition}
        activeDifficulty={filterDifficulty}
        spots={spots}
        filteredCount={filtered.length}
        onCitySelect={handleCitySelect}
        onSpotSelect={handleSearchSpot}
        onOpenAuth={() => setAuthOpen(true)}
      />

      {/* ── MAPPA — schermo intero sotto topbar ── */}
      <div style={{
        position: 'fixed',
        top: topOffset, left: isDesktop ? 400 : 0, right: 0, bottom: isDesktop ? 0 : 'calc(60px + env(safe-area-inset-bottom))',
        zIndex: 10,
      }}>
        {sessionReady && <SpotMap
          initialView={initialView}
          onViewChanged={setCurrentView}
          spots={filtered}
          filterType={filterType}
          filterRegionBbox={filterRegion?.bbox ?? null}
          searchQuery={searchQuery}
          onSpotClick={handleSpotClick}
          onAddSpotAt={handleAddSpotAt}
          flyTarget={flyTarget}
          selectedPin={selectedPin}
          overlayOffsetPx={isDesktop ? 0 : Math.round(panelHeight / 2)}
          fitAllTrigger={fitAllTrigger}
          radiusMode={radiusMode}
          radiusCenter={radiusCenter}
          radiusKm={radiusKm}
          onMapClick={handleMapClick}
          locateTrigger={locateTrigger}
          onLocatingChange={setIsLocating}
          onLocateError={(m) => { nearPendingRef.current = false; toast(m, 'error'); }}
          onBoundsChanged={setMapBounds}
          darkMap={darkMap}
          onUserLocated={setUserPos}
        />}
        {/* Toast solo quando raggio attivo e nessun centro ancora */}
        {/* RadiusToast rimosso: il centro si sceglie solo da GPS o città nel pannello */}
      </div>

      {/* ── BOTTONI MAPPA — colonna destra, auto-hide ── */}
      <div style={{
        position: 'fixed',
        top: topOffset + 10,
        right: 12,
        display: 'flex', flexDirection: 'column', gap: 8,
        zIndex: 12,
        opacity:   showBtns ? 1 : 0,
        transform: showBtns ? 'translateX(0)' : 'translateX(56px)',
        pointerEvents: showBtns ? 'all' : 'none',
        transition: 'opacity 0.22s ease, transform 0.22s ease',
      }}>
        <MapBtn
          onClick={() => setLocateTrigger(n => n + 1)}
          disabled={isLocating}
          title={text('Mostrami sulla mappa', 'Show my location')}
          active={false}
          loading={isLocating}
        >
          <LocateGlyph />
        </MapBtn>
      </div>

      {/* Bordo destro — tap per rivelare i bottoni quando sono nascosti */}
      {autoHidden && !btnsRevealed && (
        <button
          type="button"
          onClick={revealButtons}
          aria-label={text('Mostra i comandi della mappa', 'Show map controls')}
          style={{
            position: 'fixed', top: topOffset + 10, right: 0,
            width: 36, height: 44, zIndex: 12, padding: 0,
            background: 'transparent', border: 0,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          }}
        >
          <span style={{
            width: 28, height: 28,
            background: 'rgba(10,10,10,0.85)',
            border: '1px solid rgba(255,106,0,0.5)',
            borderRadius: '8px 0 0 8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </span>
        </button>
      )}

      {/* ── OVERLAY LISTA — galleggia sulla mappa, altezza regolabile ── */}
      <div className="map-panel-wrap" style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 15,
        height: panelHeight,
        display: 'flex', flexDirection: 'column',
        pointerEvents: 'none',
        transition: 'none',
      }}>
        <div className="cm-panel-surface">
          <div className="cm-panel-heading">
            <div className="cm-grip" onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd} aria-hidden="true"><span /></div>
            <div><h1>{userPos ? text('Più vicini a te', 'Nearest to you') : text('Spot sulla mappa', 'Spots on the map')}</h1><p>{spotsLoading ? text('Caricamento…', 'Loading…') : spotsError ? text('Caricamento non riuscito', 'Loading failed') : `${panelSpots.length} spot${radiusMode && radiusCenter ? ` entro ${radiusKm} km` : ''}${filtersActive ? text(' · Filtri attivi', ' · Filters active') : ''}`}</p></div>
            {!isDesktop && <div className="cm-panel-states" role="group" aria-label={text('Dimensione pannello', 'Panel size')}>
              <button aria-pressed={panelHeight <= PANEL_MIN + 10} onClick={() => snapTo(PANEL_MIN)}>{text('Mappa', 'Map')}</button>
              <button aria-pressed={panelHeight > PANEL_MIN + 10 && panelHeight < windowH - 210} onClick={() => snapTo(DEFAULT_PANEL_H())}>{text('Lista', 'List')}</button>
              <button aria-pressed={panelHeight >= windowH - 210} onClick={() => snapTo(Math.max(200, windowH - 196))}>{text('Espandi', 'Expand')}</button>
            </div>}
          </div>

          {/* ── VICINO A ME — la prima domanda del rider, prima della lista ── */}
          {(isDesktop || panelHeight > 90) && !expandedId && sessionReady && !spotsLoading && !spotsError && (
            <div className="cm-near" role="group" aria-label={text('Spot vicino a te', 'Spots near you')}>
              {userPos
                ? [null, 10, 25, 50].map(km => (
                    <button key={km ?? 'all'} type="button"
                      aria-pressed={km === null ? !radiusMode : radiusMode && radiusKm === km}
                      onClick={() => setNearRadius(km)}>
                      {km === null ? text('Tutti', 'All') : `${km} km`}
                    </button>
                  ))
                : <button type="button" className="cm-near-locate" disabled={isLocating} onClick={askNearMe}>
                    <LocateGlyph />{isLocating ? text('Cerco la tua posizione…', 'Finding your location…') : text('Vicino a me', 'Near me')}
                  </button>}
            </div>
          )}

          {favoriteError && <div role="alert" style={{padding:'10px 16px',fontSize:14,borderBottom:'1px solid var(--gray-700)'}}>{text('I preferiti non sono sincronizzati. Controlla la connessione.', 'Favorites are not synced. Check your connection.')} <button className="cm-text-button" onClick={reloadFavorites}>{text('Riprova','Try again')}</button></div>}
          {/* Pannello scroll */}
          {(isDesktop || panelHeight > 90) && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {!sessionReady || spotsLoading || spotsError ? (
                <div role={spotsError ? 'alert' : 'status'} aria-live="polite" style={{
                  padding: '24px 20px', minHeight: 160, overflowY: 'auto', height: '100%',
                  fontFamily: 'var(--font-mono)', textAlign: 'center', color: 'var(--bone)',
                }}>
                  <p style={{ fontSize: 14, lineHeight: 1.5, margin: '0 0 16px' }}>
                    {spotsError ? text('Non riesco a caricare gli spot. Controlla la connessione e riprova.', 'Could not load spots. Check your connection and try again.') : text('Caricamento spot...', 'Loading spots…')}
                  </p>
                  {spotsError && <button type="button" onClick={() => setLoadAttempt(n => n + 1)} style={{
                    padding: '12px 20px', minHeight: 44, borderRadius: 6, border: 'none',
                    background: 'var(--orange)', color: 'var(--black)', font: 'inherit', cursor: 'pointer',
                  }}>{text('Riprova', 'Try again')}</button>}
                </div>
              ) : <SpotListPanel
                spots={visibleWithPhotos}
                total={panelSpots.length}
                onLoadMore={() => setVisibleCount(count => count + 32)}
                photoLoaded={id => !!spotPhotos[id]}
                photoError={photoError}
                onRetryPhotos={retryPhotos}
                initialScrollRef={initialScrollRef}
                listScrollRef={listScrollRef}
                onBeforeNavigate={persistExplore}
                activeId={activeListId}
                expandedId={expandedId}
                onActivate={handleActivateFromScroll}
                onSpotClick={handleSpotClick}
                scrollToId={scrollToId}
                onScrolled={() => setScrollToId(null)}
                radiusCenter={radiusMode ? radiusCenter : null}
                userPos={userPos}
                nearestOverall={nearestOverall}
                filtersActive={filtersActive}
                onGoToNearest={() => {
                  if (!nearestOverall) return;
                  setFlyTarget({ lat: nearestOverall.spot.lat, lon: nearestOverall.spot.lon, zoom: 16 });
                  handleSpotClick(nearestOverall.spot);
                }}
                isDesktop={isDesktop}
                scrollInstantRef={scrollInstantRef}
                onReset={() => { setSearchQuery(''); setFilterType(null); setFilterRegion(null); setFilterCondition(null); setFilterDifficulty(null); setFilterOstacolo(null); }}
                isFav={isFav}
                onToggleFav={(e, id) => {
                  e.stopPropagation();
                  if (favoritesLoaded) toggleFavHook(id);
                }}
              />}
            </div>
          )}
        </div>
      </div>

      <AddSpotModal
        open={addOpen}
        onClose={() => { setAddOpen(false); setAddLat(undefined); setAddLon(undefined); }}
        initialLat={addLat} initialLon={addLon}
      />
      <AuthModal open={authOpen} onClose={() => { pendingAddRef.current = false; setAuthOpen(false); }} onSuccess={() => { if (pendingAddRef.current) { pendingAddRef.current = false; setAuthOpen(false); setAddOpen(true); } }} />

      {/* ── ACCESSO SOCIAL FALLITO — prima tornava alla mappa in silenzio ── */}
      <AuthErrorBanner />

      {/* ── EVENTO VICINO — data-driven, sostituisce il banner Jam Roma cablato ── */}
      <NearbyEventBanner userPos={userPos} />

      {/* ── BOTTOM NAV — solo mobile, sostituisce il pulsante +SPOT della topbar ── */}
      <BottomNav onAddSpot={openAddSpot} onOpenAuth={() => setAuthOpen(true)} />

    </div>
  );
}

/* ════════════════════════════════════════════════════════
   SPOT LIST PANEL
════════════════════════════════════════════════════════ */

function SpotListPanel({
  spots, total, onLoadMore, photoLoaded, photoError, onRetryPhotos, activeId, expandedId, onActivate, onSpotClick, scrollToId, onScrolled, radiusCenter,
  userPos, nearestOverall, filtersActive, onGoToNearest, onReset, isFav, onToggleFav, initialScrollRef, listScrollRef, onBeforeNavigate,
}: {
  initialScrollRef: React.MutableRefObject<number>; listScrollRef: React.MutableRefObject<number>; onBeforeNavigate: () => void;
  total: number; onLoadMore: () => void; photoLoaded: (id: string) => boolean; photoError: boolean; onRetryPhotos: () => void;
  spots: SpotMapPin[]; activeId: string | null; expandedId: string | null;
  onActivate: (id: string) => void; onSpotClick: (pin: SpotMapPin) => void;
  scrollToId: string | null; onScrolled: () => void;
  radiusCenter: { lat: number; lon: number } | null; userPos: { lat: number; lon: number } | null;
  nearestOverall: { spot: SpotMapPin; km: number } | null;
  filtersActive: boolean; onGoToNearest: () => void; isDesktop: boolean;
  scrollInstantRef: React.MutableRefObject<boolean>; onReset?: () => void;
  isFav: (id: string) => boolean; onToggleFav: (e: React.MouseEvent, id: string) => void;
}) {
  const { text, language } = useLanguage();
  const panelRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<{urls:string[];idx:number} | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  useLayoutEffect(() => { setPhotoIndex(0); if (panelRef.current) panelRef.current.scrollTop = initialScrollRef.current; }, [expandedId, initialScrollRef]);
  useEffect(() => { if (scrollToId) onScrolled(); }, [scrollToId, onScrolled]);
  const selected = spots.find(s => s.id === expandedId);
  const distance = (spot: SpotMapPin) => {
    const origin = radiusCenter ?? userPos;
    return origin ? formatKm(haversineKm(origin.lat, origin.lon, spot.lat, spot.lon)) : null;
  };
  if (!spots.length) return <div className="cm-empty">
    <MapIcon name="search" size={28} />
    <h2>{filtersActive ? text('Nessuno spot con questi filtri', 'No spots match these filters') : text('Nessuno spot in questa zona', 'No spots in this area')}</h2>
    <p>{filtersActive ? text('Prova a togliere un filtro o a cercare un altro luogo.', 'Try removing a filter or searching for another place.') : text('Sposta la mappa per esplorare un’altra zona.', 'Move the map to explore another area.')}</p>
    {filtersActive && <button className="btn-primary" onClick={onReset}>{text('Azzera filtri', 'Clear filters')}</button>}
    {nearestOverall && <button className="cm-text-button" onClick={onGoToNearest}>Mostra {nearestOverall.spot.name} · {formatKm(nearestOverall.km)}</button>}
  </div>;
  const photos = selected ? [...new Set([selected.cover_url, ...(selected.photo_urls ?? [])].filter((x):x is string => !!x))] : [];
  const index = Math.min(photoIndex, Math.max(0,photos.length-1));
  return <>
    {lightbox && <Lightbox urls={lightbox.urls} initialIdx={lightbox.idx} onClose={() => setLightbox(null)} />}
    <div className="cm-spot-list" ref={panelRef} onScroll={e => { listScrollRef.current = e.currentTarget.scrollTop; }}>
      {selected && <article className="cm-spot-preview">
        <div className="cm-preview-heading">
          <button className="cm-back-to-list" onClick={() => onSpotClick(selected)}>{text('← Risultati', '← Results')}</button>
          <Link className="btn-primary cm-open-spot" onClick={onBeforeNavigate} href={`/map/spot/${selected.slug}`}>{text('Apri spot', 'Open spot')} <MapIcon name="arrow" size={18} /></Link>
        </div>
        {photos.length ? <div className="cm-preview-photo">
          <button className="cm-photo-open" onClick={() => setLightbox({urls:photos,idx:index})} aria-label={text(`Ingrandisci foto di ${selected.name}`, `Enlarge photo of ${selected.name}`)}><img src={miniatura(photos[index],800)} alt={selected.name} /></button>
          {photos.length > 1 && <div className="cm-photo-controls"><button aria-label={text('Foto precedente', 'Previous photo')} onClick={() => setPhotoIndex((index-1+photos.length)%photos.length)}>←</button><span>{index+1} / {photos.length}</span><button aria-label={text('Foto successiva', 'Next photo')} onClick={() => setPhotoIndex((index+1)%photos.length)}>→</button></div>}
          {(selected.photo_sources?.[index] ?? (index === 0 ? selected.cover_source : null)) === 'streetview' && <span className="cm-photo-source">{text('Immagine da Street View', 'Street View image')}</span>}
        </div> : <div className="cm-missing-photo"><MapIcon name="photo" /><span>{photoLoaded(selected.id) ? text('Nessuna foto disponibile','No photos available') : text('Caricamento foto…','Loading photos…')}</span></div>}
        <div className="cm-preview-info">
          <span className="cm-category"><MapIcon name={selected.type} size={18} />{TIPI_SPOT[selected.type].label}</span>
          <h2><Link className="cm-spot-title-link" onClick={onBeforeNavigate} href={`/map/spot/${selected.slug}`}>{selected.name} <MapIcon name="arrow" size={20} /></Link></h2>
          <p className="cm-locality">{selected.city}{distance(selected) && ` · ${distance(selected)} ${text('in linea d’aria','straight-line distance')}`}</p>
          <div className="cm-features">{(selected.ostacoli ?? []).filter(o => OSTACOLI[o]).map(o => <span key={o}><MapIcon name={o} size={16} />{OSTACOLI[o].label}</span>)}</div>
          {selected.difficulty && <p className="cm-meta">{text('Difficoltà','Difficulty')}: {{ beginner: text('Principiante','Beginner'), intermediate: text('Intermedio','Intermediate'), pro: 'Pro' }[selected.difficulty] ?? selected.difficulty}</p>}
          <p className="cm-meta">{getFreshness(selected.condition,selected.condition_updated_at,new Date(),language).label}</p>
          {selected.submitted_by_username && <Link className="cm-contributor" href={`/u/${selected.submitted_by_username}`}>{text('Spot aggiunto da','Spot added by')} @{selected.submitted_by_username}</Link>}
          <div className="cm-preview-actions"><a className="btn-primary" href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lon}`} target="_blank" rel="noopener noreferrer"><MapIcon name="route" />{text('Apri indicazioni','Get directions')}</a><button className="cm-icon-button" aria-label={isFav(selected.id)?text('Rimuovi dai preferiti', 'Remove from favorites'):text('Aggiungi ai preferiti', 'Save to favorites')} aria-pressed={isFav(selected.id)} onClick={e => onToggleFav(e,selected.id)}><MapIcon name="heart" filled={isFav(selected.id)} /></button></div>
        </div>
      </article>}
      {selected && spots.length > 1 && <h3 className="cm-other-heading">{text('Altri risultati sulla mappa', 'Other results on the map')}</h3>}
      <div className="cm-results">
        {spots.filter(s => s.id !== selected?.id).map(spot => {
          const cover = spot.cover_url || spot.photo_urls?.[0];
          return <article key={spot.id} className={`cm-result${activeId === spot.id ? ' is-active' : ''}`} onMouseEnter={() => onActivate(spot.id)} onFocus={() => onActivate(spot.id)}>
            <button className="cm-result-select" onClick={() => onSpotClick(spot)} aria-label={text(`Mostra ${spot.name}${spot.city ? `, ${spot.city}` : ''} sulla mappa`, `Show ${spot.name}${spot.city ? `, ${spot.city}` : ''} on the map`)}>
              <span className="cm-result-image">{cover ? <img src={miniatura(cover,400)} alt="" loading="lazy" /> : <span className="cm-missing-photo"><MapIcon name="photo" /><small>{photoLoaded(spot.id) ? text('Foto assente','No photo') : text('Caricamento…','Loading…')}</small></span>}</span>
              <span className="cm-result-copy"><span className="cm-category"><MapIcon name={spot.type} size={17} />{TIPI_SPOT[spot.type].label}</span><strong>{spot.name}</strong><span className="cm-locality">{spot.city}{distance(spot) && ` · ${distance(spot)}`}</span>{spot.submitted_by_username && <span className="cm-result-author">@{spot.submitted_by_username}</span>}{spot.cover_source === 'streetview' && <span className="cm-source-label">Street View</span>}</span>
            </button>
            <button className="cm-result-fav" aria-label={text(`${isFav(spot.id)?'Rimuovi':'Salva'} ${spot.name} ${isFav(spot.id)?'dai':'nei'} preferiti`, `${isFav(spot.id)?'Remove':'Save'} ${spot.name} ${isFav(spot.id)?'from':'to'} favorites`)} aria-pressed={isFav(spot.id)} onClick={e => onToggleFav(e,spot.id)}><MapIcon name="heart" size={18} filled={isFav(spot.id)} /></button>
          </article>;
        })}
      </div>
      {photoError && <p role="alert" className="cm-list-footer">{text('Alcune foto non sono state caricate.', 'Some photos could not be loaded.')} <button className="cm-text-button" onClick={onRetryPhotos}>{text('Riprova', 'Try again')}</button></p>}
      {spots.length < total && <button className="btn-secondary" style={{margin:'16px', minHeight:44}} onClick={onLoadMore}>{text('Mostra altri spot', 'Show more spots')} ({total - spots.length})</button>}
      <p className="cm-list-footer">{text('Spot condivisi da chi ci gira.','Spots shared by the riders who ride them.')}{(userPos || radiusCenter) && text(' Distanze in linea d’aria.', ' Straight-line distances.')}</p>
    </div>
  </>;
}

/** Mirino GPS: stessa icona per il bottone mappa e per "Vicino a me". */
function LocateGlyph() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
      <circle cx="12" cy="12" r="9" strokeDasharray="2 3" strokeWidth="1.2"/>
    </svg>
  );
}

function MapBtn({
  children, onClick, title, active = false, disabled = false, loading = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{
        width: 44, height: 44,
        background: active ? 'var(--orange)' : 'var(--gray-800)',
        border: `1px solid ${active ? 'var(--orange)' : 'var(--gray-600)'}`,
        borderRadius: 6,
        color: active ? '#000' : loading ? 'var(--orange)' : 'var(--bone)',
        fontSize: 18, cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'none',
        animation: loading ? 'spin-slow 1s linear infinite' : 'none',
        flexShrink: 0,
      } as React.CSSProperties}
    >
      {children}
    </button>
  );
}
