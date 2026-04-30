'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { SpotMapPin, SpotType, SpotCondition } from '@/lib/types';
import { REGIONI_ITALIA, TIPI_SPOT, CONDIZIONI, DEBOUNCE_SEARCH_MS } from '@/lib/constants';
import { geocodeForward } from '@/lib/geocoding';
import TopBar from '@/components/TopBar';
import AddSpotModal from '@/components/AddSpotModal';
import AuthModal from '@/components/AuthModal';
import BottomNav from '@/components/BottomNav';
import Lightbox from '@/components/Lightbox';
import { useToast } from '@/components/Toast';
import { useFavorites } from '@/hooks/useFavorites';
import { useUser } from '@/hooks/useUser';
import OnboardingHints from '@/components/OnboardingHints';
import { findNearby } from '@/lib/nearby-radar';

/* ── Haversine ── */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toR = (x: number) => x * Math.PI / 180;
  const dLat = toR(lat2 - lat1);
  const dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

interface MapClientProps { initialSpots: SpotMapPin[]; autoAdd?: boolean }

const topOffset_MOBILE  = 56;  // topbar only (filter bar hidden on mobile)
const topOffset_DESKTOP = 100; // topbar + filter bar
const PANEL_MIN       = 0;
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
export default function MapClient({ initialSpots, autoAdd }: MapClientProps) {
  const [spots, setSpots]    = useState<SpotMapPin[]>(initialSpots);
  const [spotsLoading, setSpotsLoading] = useState(initialSpots.length === 0);

  // Fetch spots client-side for instant page load
  useEffect(() => {
    if (initialSpots.length > 0) return; // already have server data
    fetch('/api/spots')
      .then(r => r.json())
      .then(j => { if (j.ok) setSpots(j.data ?? []); })
      .catch(() => {})
      .finally(() => setSpotsLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const user = useUser();
  const { toast } = useToast();
  const { isFav, toggleFav: toggleFavHook } = useFavorites();
  const [filterType,      setFilterType]      = useState<SpotType | null>(null);
  const [filterRegion,    setFilterRegion]    = useState<typeof REGIONI_ITALIA[0] | null>(null);
  const [filterCondition, setFilterCondition] = useState<SpotCondition | null>(null);
  const [filterDifficulty,setFilterDifficulty]= useState<string | null>(null);
  const [searchQuery,        setSearchQuery]        = useState('');
  const [addOpen,            setAddOpen]            = useState(false);
  const [addLat,             setAddLat]             = useState<number | undefined>();
  const [addLon,             setAddLon]             = useState<number | undefined>();
  const [flyTarget,          setFlyTarget]          = useState<{ lat: number; lon: number; zoom?: number } | null>(null);
  const [authOpen,           setAuthOpen]           = useState(false);
  const [fitAllTrigger,      setFitAllTrigger]      = useState(0);

  /* ── Auth-gated add spot ── */
  const openAddSpot = useCallback(() => {
    if (user === undefined) return; // still loading
    if (!user) { setAuthOpen(true); return; } // not logged → auth first
    setAddOpen(true);
  }, [user]);

  /* ── Auto-open add modal se URL contiene ?add=1 ── */
  useEffect(() => {
    if (autoAdd && user !== undefined) {
      if (user) setAddOpen(true);
      else setAuthOpen(true);
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
      window.innerHeight * 0.92,
      Math.max(PANEL_MIN, dragState.current.startH + delta),
    );
    setPanelHeight(newH);
  }, []);

  const onDragEnd = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return;
    const h       = dragState.current.startH + (dragState.current.startY - e.clientY);
    const wasTap  = !didDragRef.current;
    dragState.current  = null;
    didDragRef.current = false;
    if (wasTap) {
      // a max height: tap → torna a default (non chiudere)
      if (panelHeight > window.innerHeight * 0.75) snapTo(DEFAULT_PANEL_H());
      else snapTo(PANEL_MIN);
    } else if (h < PANEL_SNAP)               snapTo(PANEL_MIN);
    else if (h > window.innerHeight * 0.75) snapTo(Math.round(window.innerHeight * 0.92));
    else                                    snapTo(DEFAULT_PANEL_H());
  }, [snapTo]);

  /* ── Radius search ── dichiarati PRIMA di filtered che li usa ── */
  const [radiusMode,      setRadiusMode]      = useState(false);
  const [radiusPanelOpen, setRadiusPanelOpen] = useState(false);
  const [radiusCenter,    setRadiusCenter]    = useState<{ lat: number; lon: number } | null>(null);
  const [radiusKm,        setRadiusKm]        = useState(10);
  const [gpsLoading,      setGpsLoading]      = useState(false);
  const [citySearch,      setCitySearch]      = useState('');
  const [cityPickerOpen,  setCityPickerOpen]  = useState(false);
  const [cityResults,     setCityResults]     = useState<{ name: string; display: string; lat: number; lon: number }[]>([]);
  const [cityLoading,     setCityLoading]     = useState(false);

  /* Nominatim debounce per comuni italiani */
  useEffect(() => {
    if (!cityPickerOpen) return;
    if (citySearch.trim().length < 2) { setCityResults([]); return; }
    const t = setTimeout(async () => {
      setCityLoading(true);
      try {
        const places = await geocodeForward(citySearch, {
          limit: 8,
          featureType: 'city,town,village,municipality',
        });
        setCityResults(places.map(p => ({ name: p.name, display: p.displayExtra, lat: p.lat, lon: p.lon })));
      } catch { setCityResults([]); }
      setCityLoading(false);
    }, DEBOUNCE_SEARCH_MS);
    return () => clearTimeout(t);
  }, [citySearch, cityPickerOpen]);

  /* ── Bottoni mappa: locate trigger ── */
  const [locateTrigger, setLocateTrigger] = useState(0);
  const [isLocating,    setIsLocating]    = useState(false);

  /* ── Drag handle hint — bounce on first visit ── */
  const [showDragHint, setShowDragHint] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem('cmaps_drag_hint')) {
        setShowDragHint(true);
        localStorage.setItem('cmaps_drag_hint', '1');
        setTimeout(() => setShowDragHint(false), 4000);
      }
    } catch {}
  }, []);

  /* ── Auto-hide bottoni mappa ── */
  /* I bottoni si nascondono quando il pannello è alto (> 62% vh) o il raggio è aperto.
     Toccando il bordo sinistro si rivelano per 4 secondi. */
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
  const [darkMap, setDarkMap] = useState<boolean>(() => {
    try { return localStorage.getItem('cmaps_dark_map') === '1'; } catch { return false; }
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

  /* Pre-calcola le distanze una volta sola → riutilizzato da filtered e spotsInRadius */
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
      if (filterDifficulty && s.difficulty !== filterDifficulty) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase().replace(/^@/, '');
        return (
          s.name.toLowerCase().includes(q) ||
          (s.city ?? '').toLowerCase().includes(q) ||
          (s.submitted_by_username ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
    // Quando il raggio è attivo E il pannello è chiuso → filtra per distanza (usa distanceMap)
    if (radiusMode && radiusCenter && !radiusPanelOpen) {
      result = result
        .filter(s => (distanceMap.get(s.id) ?? Infinity) <= radiusKm)
        .sort((a, b) => (distanceMap.get(a.id) ?? 0) - (distanceMap.get(b.id) ?? 0));
    }
    return result;
  }, [spots, filterType, filterRegion, filterCondition, filterDifficulty, searchQuery, radiusMode, radiusCenter, radiusPanelOpen, radiusKm, distanceMap]);

  /* Pin selezionato sulla mappa (marker ingrandito + orange outline) */
  const selectedPin = useMemo(() =>
    filtered.find(s => s.id === activeListId) ?? null,
  [filtered, activeListId]);

  /* Auto-refit mappa quando cambiano i filtri principali.
     Usiamo un ref per saltare il primo render (mount). */
  const filterInitRef = useRef(false);
  useEffect(() => {
    if (!filterInitRef.current) { filterInitRef.current = true; return; }
    // Incrementa il trigger → SpotMap farà fitBounds sui filtered
    setFitAllTrigger(n => n + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterRegion, filterCondition, filterDifficulty, searchQuery]);

  const handleFilterRegion = useCallback((label: string | null) => {
    if (!label) { setFilterRegion(null); return; }
    const region = REGIONI_ITALIA.find(r => r.label === label) ?? null;
    setFilterRegion(region);
    // NON setFlyTarget: il fitAllTrigger (useEffect su filterRegion) farà fitBounds
    // sugli spot reali della regione → zoom calibrato sui dati, non sul centro bbox
  }, []);

  const spotsInRadius = useMemo(() => {
    if (!radiusCenter) return [];
    return spots
      .filter(s => (distanceMap.get(s.id) ?? Infinity) <= radiusKm)
      .sort((a, b) => (distanceMap.get(a.id) ?? 0) - (distanceMap.get(b.id) ?? 0))
      .map(s => ({ ...s, distance: distanceMap.get(s.id) ?? 0 }));
  }, [spots, radiusCenter, radiusKm, distanceMap]);

  // Il click sulla mappa NON imposta più il centro del raggio —
  // il centro si sceglie solo tramite GPS o selezione città nel pannello
  const handleMapClick = useCallback((lat: number, lon: number) => {
    /* intenzionalmente vuoto: radius center viene da GPS o city picker */
    void lat; void lon;
  }, []);

  const handleUseGPS = useCallback(() => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const center = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setRadiusCenter(center);
        setFlyTarget({ lat: center.lat, lon: center.lon, zoom: 11 });
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const closeRadiusMode = useCallback(() => {
    setRadiusMode(false);
    setRadiusCenter(null);
    setRadiusPanelOpen(false);
    setCitySearch('');
    setCityPickerOpen(false);
  }, []);

  const handleCityForRadius = useCallback((cityLabel: string, lat: number, lon: number) => {
    const center = { lat, lon };
    setRadiusCenter(center);
    setFlyTarget({ lat, lon, zoom: 11 });
    setCitySearch(cityLabel);
    setCityPickerOpen(false);
  }, []);

  const handleRadiusToggle = useCallback(() => {
    if (radiusMode) {
      closeRadiusMode();
    } else {
      setRadiusMode(true);
      setRadiusPanelOpen(true);
    }
  }, [radiusMode, closeRadiusMode]);

  const handleApplyRadius = useCallback(() => {
    setRadiusPanelOpen(false);
    // La mappa mostra già il cerchio, la lista già filtra via spotsInRadius
  }, []);

  /* Click su uno spot (da mappa o da lista) → espandi card + vola mappa
     Zoom 13: mostra il quartiere/zona, non solo il singolo marciapiede,
     così l'utente capisce subito dove si trova lo spot nel contesto urbano. */
  /* Lock temporaneo: impedisce all'IntersectionObserver di sovrascrivere
     l'activeListId subito dopo la chiusura di una card (il collasso cambia
     le altezze e il IO si riattiverebbe sullo spot sbagliato). */
  const ioLockRef = useRef(false);

  const handleSpotClick = useCallback((pin: SpotMapPin) => {
    setActiveListId(pin.id);
    setExpandedId(prev => {
      const isClosing = prev === pin.id;
      if (isClosing) {
        // Chiudi card → torna a lista
        snapTo(DEFAULT_PANEL_H());
      } else {
        // Apri anteprima — foto + info + VEDI SPOT ben visibile
        snapTo(400);
      }
      return isClosing ? null : pin.id;
    });
    setFlyTarget({ lat: pin.lat, lon: pin.lon, zoom: 12 });
  }, [snapTo]);  // eslint-disable-line react-hooks/exhaustive-deps

  const activateDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleActivateFromScroll = useCallback((id: string) => {
    if (ioLockRef.current) return; // lock attivo — ignora
    if (activateDebounce.current) clearTimeout(activateDebounce.current);
    activateDebounce.current = setTimeout(() => {
      setActiveListId(id);
    }, 120);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCitySelect = useCallback((city: string, lat: number, lon: number) => {
    setFlyTarget({ lat, lon, zoom: 14 });
    setSearchQuery(city);
  }, []);

  const handleAddSpotAt = useCallback((lat: number, lon: number) => {
    if (!user) { setAuthOpen(true); return; }
    setAddLat(lat); setAddLon(lon); setAddOpen(true);
  }, [user]);

  /* Bottoni mappa: nascosti quando il pannello è alto (>62% vh) o raggio aperto */
  const autoHidden = panelHeight > windowH * 0.62 || radiusPanelOpen;
  const showBtns   = !autoHidden || btnsRevealed;

  return (
    <div style={{ height: '100dvh', overflow: 'hidden' }}>

      <TopBar
        onSearch={setSearchQuery}
        onFilterType={setFilterType}
        onFilterRegion={handleFilterRegion}
        onFilterCondition={setFilterCondition}
        onFilterDifficulty={setFilterDifficulty}
        onAddSpot={openAddSpot}
        activeType={filterType}
        activeRegion={filterRegion?.label ?? null}
        activeCondition={filterCondition}
        activeDifficulty={filterDifficulty}
        spots={spots}
        filteredCount={filtered.length}
        onCitySelect={handleCitySelect}
        onSpotSelect={handleSpotClick}
        onOpenAuth={() => setAuthOpen(true)}
      />

      {/* ── MAPPA — schermo intero sotto topbar ── */}
      <div style={{
        position: 'fixed',
        top: topOffset, left: 0, right: 0, bottom: 0,
        zIndex: 1,
      }}>
        <SpotMap
          spots={spots}
          filterType={filterType}
          filterRegionBbox={filterRegion?.bbox ?? null}
          searchQuery={searchQuery}
          onSpotClick={handleSpotClick}
          onAddSpotAt={handleAddSpotAt}
          flyTarget={flyTarget}
          selectedPin={selectedPin}
          overlayOffsetPx={Math.round(panelHeight / 2)}
          fitAllTrigger={fitAllTrigger}
          radiusMode={radiusMode}
          radiusCenter={radiusCenter}
          radiusKm={radiusKm}
          onMapClick={handleMapClick}
          locateTrigger={locateTrigger}
          onLocatingChange={setIsLocating}
          darkMap={darkMap}
        />
        {/* Toast solo quando raggio attivo e nessun centro ancora */}
        {/* RadiusToast rimosso: il centro si sceglie solo da GPS o città nel pannello */}
      </div>

      {/* ── BOTTONI MAPPA — colonna sinistra, auto-hide ── */}
      <div style={{
        position: 'fixed',
        top: topOffset + 10,
        left: 12,
        display: 'flex', flexDirection: 'column', gap: 8,
        zIndex: 55,
        opacity:   showBtns ? 1 : 0,
        transform: showBtns ? 'translateX(0)' : 'translateX(-56px)',
        pointerEvents: showBtns ? 'all' : 'none',
        transition: 'opacity 0.22s ease, transform 0.22s ease',
      }}>
        <MapBtn
          onClick={() => setLocateTrigger(n => n + 1)}
          disabled={isLocating}
          title="Mostrami sulla mappa"
          active={false}
          loading={isLocating}
        >
          {/* GPS / locate icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
            <circle cx="12" cy="12" r="9" strokeDasharray="2 3" strokeWidth="1.2"/>
          </svg>
        </MapBtn>
        <MapBtn onClick={handleRadiusToggle} title="Ricerca per raggio" active={radiusMode}>
          {/* Radius / target icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="12" r="9"/>
            <circle cx="12" cy="12" r="4"/>
            <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>
          </svg>
        </MapBtn>
      </div>

      {/* Bordo sinistro — tap per rivelare i bottoni quando sono nascosti */}
      {autoHidden && !btnsRevealed && (
        <div
          onClick={revealButtons}
          style={{
            position: 'fixed', top: topOffset + 10, left: 0,
            width: 36, height: 132, zIndex: 54,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
          }}
        >
          <div style={{
            width: 28, height: 28,
            background: 'rgba(10,10,10,0.85)',
            border: '1px solid rgba(255,106,0,0.5)',
            borderRadius: '0 8px 8px 0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: 20,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        </div>
      )}

      {/* ── PANNELLO RAGGIO — scende dall'alto quando attivo ── */}
      {radiusMode && radiusPanelOpen && (
        <div style={{
          position: 'fixed',
          top: topOffset,
          left: 0, right: 0,
          zIndex: 50,
          background: 'rgba(14,14,14,0.97)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '2px solid var(--orange)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
          padding: '14px 16px 16px',
        } as React.CSSProperties}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 22 }}>🎯</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--orange)', lineHeight: 1 }}>
                RICERCA PER RAGGIO
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginTop: 3 }}>
                {radiusCenter
                  ? `${spotsInRadius.length} spot nel raggio di ${radiusKm} km`
                  : 'Scegli il centro con GPS o città'}
              </div>
            </div>
            <button onClick={closeRadiusMode} style={{
              background: 'var(--gray-700)', border: '1px solid var(--gray-600)',
              borderRadius: 6, width: 32, height: 32, fontSize: 16,
              color: 'var(--bone)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
          </div>

          {/* GPS + CITTÀ — due bottoni affiancati */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button
              onClick={handleUseGPS} disabled={gpsLoading}
              style={{
                flex: 1, padding: '10px 10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.4)',
                borderRadius: 8, cursor: gpsLoading ? 'default' : 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--orange)',
                opacity: gpsLoading ? 0.6 : 1,
              }}
            >
              <span style={{ fontSize: 16 }}>{gpsLoading ? '⌛' : '📡'}</span>
              {gpsLoading ? 'GPS...' : 'MIA POSIZIONE'}
            </button>
            <button
              onClick={() => setCityPickerOpen(v => !v)}
              style={{
                flex: 1, padding: '10px 10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: cityPickerOpen ? 'rgba(255,106,0,0.15)' : 'rgba(255,106,0,0.05)',
                border: `1px solid ${cityPickerOpen ? 'var(--orange)' : 'rgba(255,106,0,0.3)'}`,
                borderRadius: 8, cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--orange)',
              }}
            >
              <span style={{ fontSize: 16 }}>🏙️</span>
              {citySearch || 'SCEGLI CITTÀ'}
            </button>
          </div>

          {/* City picker — input + lista comuni via Nominatim */}
          {cityPickerOpen && (
            <div style={{
              marginBottom: 10,
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid var(--gray-600)',
              borderRadius: 8, overflow: 'hidden',
            }}>
              <div style={{ position: 'relative' }}>
                <input
                  autoFocus
                  value={citySearch}
                  onChange={e => setCitySearch(e.target.value)}
                  placeholder="Cerca comune..."
                  style={{
                    width: '100%', padding: '9px 36px 9px 12px',
                    background: 'var(--gray-800)', border: 'none', borderBottom: '1px solid var(--gray-700)',
                    fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
                {cityLoading && (
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)' }}>...</span>
                )}
              </div>
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                {/* Risultati Nominatim */}
                {cityResults.length > 0 && cityResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => handleCityForRadius(r.name, r.lat, r.lon)}
                    style={{
                      width: '100%', padding: '9px 12px', textAlign: 'left',
                      background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                      fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)',
                      cursor: 'pointer', display: 'block',
                    }}
                  >
                    {r.name}
                    {r.display && <span style={{ color: 'var(--gray-500)', fontSize: 10, marginLeft: 6 }}>{r.display}</span>}
                  </button>
                ))}
                {/* Stato vuoto */}
                {!cityLoading && citySearch.trim().length >= 2 && cityResults.length === 0 && (
                  <div style={{ padding: '12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-500)', textAlign: 'center' }}>
                    Nessun comune trovato
                  </div>
                )}
                {citySearch.trim().length < 2 && (
                  <div style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)' }}>
                    Digita almeno 2 lettere...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chips raggio */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', flexShrink: 0 }}>
              KM:
            </span>
            {[10, 25, 50, 100, 200, 500].map(km => (
              <button key={km} onClick={() => setRadiusKm(km)} style={{
                flex: 1, padding: '6px 0',
                fontFamily: 'var(--font-mono)', fontSize: 11,
                border: `1px solid ${radiusKm === km ? 'var(--orange)' : 'var(--gray-600)'}`,
                borderRadius: 6,
                background: radiusKm === km ? 'var(--orange)' : 'transparent',
                color: radiusKm === km ? '#000' : 'var(--gray-400)',
                cursor: 'pointer', fontWeight: radiusKm === km ? 700 : 400,
                transition: 'all 0.1s',
              }}>
                {km}
              </button>
            ))}
          </div>

          {/* APPLICA */}
          <button
            onClick={handleApplyRadius}
            disabled={!radiusCenter}
            style={{
              width: '100%', padding: '12px',
              background: radiusCenter ? 'var(--orange)' : 'var(--gray-700)',
              border: 'none', borderRadius: 8,
              fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700,
              color: radiusCenter ? '#000' : 'var(--gray-500)',
              cursor: radiusCenter ? 'pointer' : 'default',
              letterSpacing: '0.05em',
              transition: 'all 0.15s',
            }}
          >
            {radiusCenter
              ? `✓ APPLICA — ${spotsInRadius.length} SPOT`
              : '↑ SCEGLI GPS O CITTÀ'}
          </button>
        </div>
      )}

      {/* Banner raggio attivo (pannello chiuso) */}
      {radiusMode && !radiusPanelOpen && radiusCenter && (
        <div style={{
          position: 'fixed',
          top: topOffset + 8,
          left: 60,
          zIndex: 55,
          background: 'rgba(255,106,0,0.15)',
          border: '1px solid var(--orange)',
          borderRadius: 6,
          padding: '5px 10px',
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 2px 14px rgba(0,0,0,0.6)',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--orange)' }}>
            🎯 {radiusKm}km · {filtered.length} spot
          </span>
          <button
            onClick={closeRadiusMode}
            style={{
              background: 'none', border: 'none',
              color: 'var(--orange)', cursor: 'pointer', fontSize: 14,
              padding: '0 2px', lineHeight: 1,
            }}
          >✕</button>
        </div>
      )}

      {/* ── CORNICE VHS — visibile quando il pannello è chiuso ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9,
        pointerEvents: 'none',
        opacity: panelHeight <= PANEL_MIN + 10 ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}>
        {/* Angolo top-left */}
        <div style={{ position: 'absolute', top: 56, left: 10, width: 40, height: 40, borderTop: '2px solid rgba(255,106,0,0.6)', borderLeft: '2px solid rgba(255,106,0,0.6)' }} />
        {/* Angolo top-right */}
        <div style={{ position: 'absolute', top: 56, right: 10, width: 40, height: 40, borderTop: '2px solid rgba(255,106,0,0.6)', borderRight: '2px solid rgba(255,106,0,0.6)' }} />
        {/* Angolo bottom-left */}
        <div style={{ position: 'absolute', bottom: 44, left: 10, width: 40, height: 40, borderBottom: '2px solid rgba(255,106,0,0.6)', borderLeft: '2px solid rgba(255,106,0,0.6)' }} />
        {/* Angolo bottom-right */}
        <div style={{ position: 'absolute', bottom: 44, right: 10, width: 40, height: 40, borderBottom: '2px solid rgba(255,106,0,0.6)', borderRight: '2px solid rgba(255,106,0,0.6)' }} />

        {/* Striscia bottom — copre attribution OSM */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 46,
          background: 'linear-gradient(to top, rgba(10,10,10,0.92) 0%, transparent 100%)',
        }} />

        {/* Attribution OSM stilizzata */}
        <div style={{
          position: 'absolute', bottom: 10, left: 14,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.05em' }}>
            © OpenStreetMap contributors
          </span>
        </div>

        {/* Scanline sottile su tutto lo schermo */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)',
        }} />
      </div>

      {/* ── TAB FISSO — sempre visibile, apre il pannello a tutto schermo ── */}
      <div
        className="map-panel-tab"
        onClick={() => { if (panelHeight <= PANEL_MIN + 10) snapTo(Math.round(window.innerHeight * 0.92)); }}
        style={{
          position: 'fixed',
          bottom: 0, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 11,
          padding: '8px 20px 12px',
          background: 'rgba(10,10,10,0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '12px 12px 0 0',
          border: '1px solid rgba(255,255,255,0.07)',
          borderBottom: 'none',
          display: 'flex', alignItems: 'center', gap: 10,
          cursor: 'pointer',
          pointerEvents: panelHeight <= PANEL_MIN + 10 ? 'all' : 'none',
          opacity: panelHeight <= PANEL_MIN + 10 ? 1 : 0,
          transition: 'opacity 0.2s ease',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 15 }}>↑</span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 13,
          color: 'var(--orange)', letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          {filtered.length} spot
        </span>
      </div>

      {/* ── OVERLAY LISTA — galleggia sulla mappa, altezza regolabile ── */}
      <div className="map-panel-wrap" style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 10,
        height: panelHeight,
        display: 'flex', flexDirection: 'column',
        pointerEvents: 'none',
        transition: (dragState.current && !panelSnapping) ? 'none' : 'height 0.3s ease-out',
      }}>
        {/* Gradiente fade */}
        <div style={{
          height: 36, flexShrink: 0,
          background: 'linear-gradient(to bottom, transparent 0%, rgba(10,10,10,0.97) 100%)',
          pointerEvents: 'none',
          marginBottom: -1,
        }} />

        {/* ── DRAG HANDLE + PANNELLO — unico layer blur/background ── */}
        <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          background: 'rgba(10,10,10,0.97)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          pointerEvents: 'all',
          overflow: expandedId ? 'auto' : 'hidden',
          borderRadius: panelHeight <= PANEL_MIN + 10 ? '14px 14px 0 0' : '0',
          transition: 'border-radius 0.25s ease',
          position: 'relative',
        }}>
          {/* ── DRAG HANDLE ── */}
          <div
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            style={{
              flexShrink: 0,
              height: 46,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'ns-resize',
              touchAction: 'none',
              animation: showDragHint ? 'dragBounce 0.6s ease-in-out 0.8s 3' : 'none',
              position: 'relative',
            }}
          >
            <div style={{
              width: 68, height: 26,
              background: '#222',
              borderRadius: 5,
              boxShadow: 'inset 0 1px 0 #3e3e3e, inset 0 -1px 0 #111, 0 3px 8px rgba(0,0,0,0.9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', position: 'relative',
            } as React.CSSProperties}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 3px)',
                pointerEvents: 'none',
              }} />
              <div style={{ display: 'flex', gap: 3, position: 'relative' }}>
                {[0,1,2,3,4].map(col => (
                  <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ width: 4, height: 4, background: '#3a3a3a', borderRadius: '50%', boxShadow: 'inset -1px -1px 0 #222, inset 1px 1px 0 #505050' }} />
                    <div style={{ width: 4, height: 4, background: '#3a3a3a', borderRadius: '50%', boxShadow: 'inset -1px -1px 0 #222, inset 1px 1px 0 #505050' }} />
                  </div>
                ))}
              </div>
            </div>
            {/* First-visit hint */}
            {showDragHint && (
              <div style={{
                position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)',
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--orange)',
                whiteSpace: 'nowrap', pointerEvents: 'none',
                animation: 'fadeIn 0.3s ease-out 1s both',
              }}>
                ↕ trascina
              </div>
            )}
          </div>

          {/* Pannello scroll */}
          {panelHeight > 90 && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <SpotListPanel
                spots={filtered}
                activeId={activeListId}
                expandedId={expandedId}
                onActivate={handleActivateFromScroll}
                onSpotClick={handleSpotClick}
                scrollToId={scrollToId}
                onScrolled={() => setScrollToId(null)}
                radiusCenter={radiusMode && !radiusPanelOpen ? radiusCenter : null}
                isDesktop={isDesktop}
                scrollInstantRef={scrollInstantRef}
                onReset={() => { setFilterType(null); setFilterRegion(null); setFilterCondition(null); setFilterDifficulty(null); }}
                isFav={isFav}
                onToggleFav={(e, id) => {
                  e.stopPropagation();
                  const added = toggleFavHook(id);
                  toast(added ? 'Aggiunto ai preferiti' : 'Rimosso dai preferiti', added ? 'success' : 'info');
                }}
              />
            </div>
          )}
        </div>
      </div>

      <AddSpotModal
        open={addOpen}
        onClose={() => { setAddOpen(false); setAddLat(undefined); setAddLon(undefined); }}
        initialLat={addLat} initialLon={addLon}
      />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      {/* ── BOTTOM NAV — solo mobile, sostituisce il pulsante +SPOT della topbar ── */}
      <BottomNav onAddSpot={openAddSpot} onOpenAuth={() => setAuthOpen(true)} />

      {/* ── ONBOARDING — first visit only ── */}
      <OnboardingHints />
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   SPOT LIST PANEL
════════════════════════════════════════════════════════ */

function SpotListPanel({
  spots, activeId, expandedId, onActivate, onSpotClick, scrollToId, onScrolled, radiusCenter,
  isDesktop, scrollInstantRef, onReset, isFav, onToggleFav,
}: {
  spots:            SpotMapPin[];
  activeId:         string | null;
  expandedId:       string | null;
  onActivate:       (id: string) => void;
  onSpotClick:      (pin: SpotMapPin) => void;
  scrollToId:       string | null;
  onScrolled:       () => void;
  radiusCenter:     { lat: number; lon: number } | null;
  isDesktop:        boolean;
  scrollInstantRef: React.MutableRefObject<boolean>;
  onReset?:         () => void;
  isFav:            (id: string) => boolean;
  onToggleFav:      (e: React.MouseEvent, id: string) => void;
}) {
  /* Indice foto corrente per ogni spot (nella card espansa) */
  const [photoIdx,   setPhotoIdx]   = useState<Record<string, number>>({});
  /* Lightbox */
  const [lightbox,   setLightbox]   = useState<{ urls: string[]; idx: number } | null>(null);
  /* Ref strip foto della card espansa (una sola per volta) */
  const photoStripRef = useRef<HTMLDivElement | null>(null);
  /* Swipe-vs-tap detection per la strip foto (shared: una sola card espansa per volta) */
  const photoTouchStartX = useRef(0);
  const photoTouchStartY = useRef(0);
  const photoIsSwiping   = useRef(false);

  const panelRef       = useRef<HTMLDivElement>(null);
  const cardRefs       = useRef<Map<string, Element>>(new Map());
  const ioRef          = useRef<IntersectionObserver | null>(null);
  /* Mappa dei ratio di visibilità: id → intersectionRatio (0..1) */
  const visibilityMap  = useRef<Map<string, number>>(new Map());

  /* favs now come from parent via isFav/onToggleFav props */

  /* IntersectionObserver con root = pannello scroll.
     Strategia: aggiorna la mappa di visibilità ad ogni entry, poi scegli
     sempre lo spot con il ratio PIÙ ALTO — evita salti durante lo scroll. */
  useEffect(() => {
    ioRef.current?.disconnect();
    visibilityMap.current.clear();
    if (!panelRef.current) return;
    ioRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const id = (entry.target as HTMLElement).dataset.spotId;
          if (!id) return;
          if (entry.isIntersecting) {
            visibilityMap.current.set(id, entry.intersectionRatio);
          } else {
            visibilityMap.current.delete(id);
          }
        });
        /* Spot più visibile nella viewport */
        let bestId = '';
        let bestRatio = -1;
        visibilityMap.current.forEach((ratio, id) => {
          if (ratio > bestRatio) { bestRatio = ratio; bestId = id; }
        });
        if (bestId) onActivate(bestId);
      },
      {
        root: panelRef.current,
        rootMargin: '-5% 0px -50% 0px',
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0],
      }
    );
    cardRefs.current.forEach(el => ioRef.current!.observe(el));
    return () => ioRef.current?.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots]);

  const setRef = useCallback((id: string, el: Element | null) => {
    if (el) { cardRefs.current.set(id, el); ioRef.current?.observe(el); }
    else    { cardRefs.current.delete(id); }
  }, []);

  useEffect(() => {
    if (!scrollToId || !panelRef.current) return;
    const el = cardRefs.current.get(scrollToId);
    const behavior = scrollInstantRef.current ? 'instant' : 'smooth';
    scrollInstantRef.current = false;
    if (el) el.scrollIntoView({ behavior: behavior as ScrollBehavior, block: 'start' });
    onScrolled();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToId]);

  /* handleFav now passed via onToggleFav prop */

  /* ── Non-passive touchmove sulla strip foto ──────────────────────────────
     Safari iOS ignora touch-action: pan-x dentro overflow-y: auto.
     L'unico fix affidabile è preventDefault() in un listener non-passivo
     quando il gesto è orizzontale — impossibile farlo con i synthetic events
     di React (sempre passivi). Lo montiamo/smontiamo via useEffect. */
  useEffect(() => {
    if (!expandedId) return;
    let removeListeners: (() => void) | undefined;

    /* Piccolo delay: React deve aver già renderizzato la card espansa
       prima che possiamo leggere il ref della strip. */
    const t = setTimeout(() => {
      const stripEl = photoStripRef.current;
      if (!stripEl) return;

      let startX = 0, startY = 0, decided = false;

      const onStart = (e: TouchEvent) => {
        startX  = e.touches[0].clientX;
        startY  = e.touches[0].clientY;
        decided = false;
      };
      const onMove = (e: TouchEvent) => {
        const dx = Math.abs(e.touches[0].clientX - startX);
        const dy = Math.abs(e.touches[0].clientY - startY);
        if (!decided && (dx > 4 || dy > 4)) decided = true;
        /* Gesto orizzontale → blocca lo scroll verticale del parent */
        if (decided && dx > dy) e.preventDefault();
      };

      stripEl.addEventListener('touchstart', onStart, { passive: true });
      stripEl.addEventListener('touchmove',  onMove,  { passive: false });

      removeListeners = () => {
        stripEl.removeEventListener('touchstart', onStart);
        stripEl.removeEventListener('touchmove',  onMove);
      };
    }, 30);

    return () => { clearTimeout(t); removeListeners?.(); };
  }, [expandedId]);

  /* Naviga le foto della card espansa via scroll-snap */
  const scrollToPhotoInStrip = useCallback((spotId: string, i: number) => {
    const el = photoStripRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.offsetWidth, behavior: 'smooth' });
    setPhotoIdx(p => ({ ...p, [spotId]: i }));
  }, []);

  /* Lightbox keyboard/close handled by shared <Lightbox> component */

  if (spots.length === 0) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
        <div style={{ color: 'var(--bone)', fontSize: 15, marginBottom: 6 }}>Nessuno spot trovato</div>
        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 20 }}>Prova a cambiare o azzerare i filtri.</div>
        {onReset && (
          <button
            onClick={onReset}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 13,
              padding: '9px 20px',
              border: '1px solid var(--orange)',
              borderRadius: 4, background: 'transparent',
              color: 'var(--orange)', cursor: 'pointer',
              letterSpacing: '0.05em',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            } as React.CSSProperties}
          >
            ✕ AZZERA FILTRI
          </button>
        )}
      </div>
    );
  }

  return (
    <>
    {/* ── LIGHTBOX (shared component) ── */}
    {lightbox && (
      <Lightbox
        urls={lightbox.urls}
        initialIdx={lightbox.idx}
        onClose={() => setLightbox(null)}
      />
    )}

    <div ref={panelRef} style={{ height: '100%', overflowY: 'auto', overscrollBehavior: 'contain' } as React.CSSProperties}>

      <style>{`
        .spot-card-wrap { -webkit-tap-highlight-color: transparent; }
        .spot-card-wrap:active { opacity: 0.9; }
        .spot-fav-btn { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
        .photo-nav-btn { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
      `}</style>

      {/* Header + horizontal strip — when NOT expanded */}
      {!expandedId && (
        <>
          <div style={{
            padding: '7px 14px 5px',
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>{spots.length} spot</span>
            {radiusCenter && (
              <span style={{ color: 'var(--orange)', fontSize: 10 }}>
                🎯 per distanza
              </span>
            )}
          </div>

          {/* ══ 2-COLUMN VERTICAL GRID ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 10px 12px' }}>
            {spots.map(spot => {
              const tipo = TIPI_SPOT[spot.type];
              const cond = CONDIZIONI[spot.condition];
              const cover = spot.cover_url || (spot.photo_urls?.[0]);
              const myFav = isFav(spot.id);
              const isAct = activeId === spot.id;

              return (
                <div
                  key={spot.id}
                  ref={(el) => setRef(spot.id, el)}
                  data-spot-id={spot.id}
                  className="spot-card-wrap"
                  onClick={() => onSpotClick(spot)}
                  style={{
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: 'var(--gray-800)',
                    border: `1.5px solid ${isAct ? 'var(--orange)' : 'var(--gray-700)'}`,
                    cursor: 'pointer',
                    transition: 'border-color 0.2s',
                  }}
                >
                  {/* Cover photo */}
                  <div style={{
                    height: 130, background: '#111',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    {cover ? (
                      <img src={cover} alt={spot.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 36, opacity: 0.2 }}>{tipo.emoji}</span>
                      </div>
                    )}
                    {/* Gradient bottom */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 50, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', pointerEvents: 'none' }} />
                    {/* Type badge */}
                    <div style={{ position: 'absolute', bottom: 6, left: 8, fontFamily: 'var(--font-mono)', fontSize: 9, color: tipo.color, background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 3 }}>
                      {tipo.emoji} {tipo.label.toUpperCase()}
                    </div>
                    {/* Condition dot */}
                    {spot.condition === 'alive' ? (
                      <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: '#00c851', boxShadow: '0 0 6px #00c851' }} />
                    ) : (
                      <div style={{ position: 'absolute', top: 6, right: 6, fontFamily: 'var(--font-mono)', fontSize: 9, background: cond.bg, color: cond.color, padding: '2px 6px', borderRadius: 3 }}>
                        {cond.label.toUpperCase()}
                      </div>
                    )}
                    {/* Fav */}
                    <button onClick={e => onToggleFav(e, spot.id)} className="spot-fav-btn"
                      style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 28, height: 28, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {myFav ? '❤️' : '🤍'}
                    </button>
                  </div>

                  {/* Info */}
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                      {spot.name}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', display: 'flex', gap: 6, alignItems: 'center' }}>
                      {spot.city && <span>📍 {spot.city}</span>}
                      {spot.submitted_by_username && <span style={{ color: 'var(--gray-600)' }}>@{spot.submitted_by_username}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ══ EXPANDED CARD — shown when a spot is tapped ══ */}
      {expandedId && spots.filter(s => s.id === expandedId).map((spot, idx) => {
        const tipo      = TIPI_SPOT[spot.type];
        const cond      = CONDIZIONI[spot.condition];
        const isAct     = true; // always active when expanded
        const isExp     = true; // always expanded in this section
        const myFav     = isFav(spot.id);
        const isLast    = idx === spots.length - 1;

        /* Foto disponibili */
        const allPhotos = spot.photo_urls && spot.photo_urls.length > 0
          ? spot.photo_urls
          : spot.cover_url ? [spot.cover_url] : [];
        const curPhotoIdx = photoIdx[spot.id] ?? 0;
        const curPhoto    = allPhotos[curPhotoIdx];

        const goPrev = (e: React.MouseEvent) => {
          e.stopPropagation();
          setPhotoIdx(p => {
            const cur = p[spot.id] ?? 0;
            return { ...p, [spot.id]: cur === 0 ? allPhotos.length - 1 : cur - 1 };
          });
        };
        const goNext = (e: React.MouseEvent) => {
          e.stopPropagation();
          setPhotoIdx(p => {
            const cur = p[spot.id] ?? 0;
            return { ...p, [spot.id]: cur === allPhotos.length - 1 ? 0 : cur + 1 };
          });
        };

        return (
          <div
            key={spot.id}
            ref={(el) => setRef(spot.id, el)}
            data-spot-id={spot.id}
            data-exp={isExp ? '1' : undefined}
            className="spot-card-wrap"
            onClick={() => onSpotClick(spot)}
            style={{
              position: 'relative',
              borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.06)',
              borderLeft: `3px solid ${isAct ? 'var(--orange)' : 'transparent'}`,
              transition: 'border-color 0.2s',
              cursor: 'pointer',
              background: isExp ? 'rgba(255,106,0,0.04)' : 'transparent',
              touchAction: isExp ? 'auto' : 'manipulation',
            }}
          >

            {/* ══ EXPANDED LAYOUT ══ */}
              <div style={{ position: 'relative' }}>

                {/* ── FOTO — scroll-snap swipeable ── */}
                {allPhotos.length > 0 ? (
                  <div style={{ position: 'relative', background: '#000' }}>
                    <div
                      ref={photoStripRef}
                      onScroll={e => {
                        const el = e.currentTarget;
                        const newIdx = Math.round(el.scrollLeft / el.offsetWidth);
                        setPhotoIdx(p => p[spot.id] !== newIdx ? { ...p, [spot.id]: newIdx } : p);
                      }}
                      onTouchStart={e => {
                        photoTouchStartX.current = e.touches[0].clientX;
                        photoTouchStartY.current = e.touches[0].clientY;
                        photoIsSwiping.current   = false;
                      }}
                      onTouchMove={e => {
                        const dx = Math.abs(e.touches[0].clientX - photoTouchStartX.current);
                        const dy = Math.abs(e.touches[0].clientY - photoTouchStartY.current);
                        if (dx > 6 || dy > 6) photoIsSwiping.current = true;
                        if (dx > dy) e.stopPropagation();
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        if (!photoIsSwiping.current) setLightbox({ urls: allPhotos, idx: curPhotoIdx });
                      }}
                      style={{
                        display: 'flex', overflowX: 'auto',
                        scrollSnapType: 'x mandatory', scrollBehavior: 'auto',
                        WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
                        width: '100%', height: 'clamp(140px, 30vh, 220px)',
                        cursor: 'zoom-in', touchAction: 'pan-x',
                      } as React.CSSProperties}
                    >
                      {allPhotos.map((url, i) => (
                        <div key={url + i} style={{ flexShrink: 0, width: '100%', height: '100%', scrollSnapAlign: 'start' }}>
                          <img
                            src={url} alt={spot.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
                            loading={i === 0 ? 'eager' : 'lazy'}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Overlay sfumato in basso per leggere i badge */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(transparent, rgba(0,0,0,0.75))', pointerEvents: 'none' }} />

                    {/* Badge tipo — in basso a sinistra sulla foto */}
                    <div style={{ position: 'absolute', bottom: 8, left: 10, display: 'flex', gap: 5, alignItems: 'center', pointerEvents: 'none' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: tipo.color, background: 'rgba(0,0,0,0.6)', padding: '3px 7px', borderRadius: 4, border: `1px solid ${tipo.color}55` }}>
                        {tipo.emoji} {tipo.label.toUpperCase()}
                      </span>
                      {spot.condition === 'alive' ? (
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00c851', boxShadow: '0 0 6px #00c851', display: 'inline-block' }} />
                      ) : (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: cond.bg, color: cond.color, padding: '2px 6px', borderRadius: 4 }}>{cond.label.toUpperCase()}</span>
                      )}
                    </div>

                    {/* Close — top-right only (fav moved to CTA bar) */}
                    <div style={{ position: 'absolute', top: 8, right: 8 }}>
                      <button onClick={e => { e.stopPropagation(); onSpotClick(spot); }}
                        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', border: 'none', borderRadius: '50%', width: 34, height: 34, fontSize: 16, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        aria-label="Chiudi">✕</button>
                    </div>

                    {/* Dots navigazione foto */}
                    {allPhotos.length > 1 && (
                      <div style={{ position: 'absolute', bottom: 8, right: 10, display: 'flex', gap: 4, pointerEvents: 'none' }}>
                        {allPhotos.map((_, i) => (
                          <div key={i} style={{ width: i === curPhotoIdx ? 16 : 5, height: 5, borderRadius: 3, background: i === curPhotoIdx ? 'var(--orange)' : 'rgba(255,255,255,0.4)', transition: 'all 0.2s' }} />
                        ))}
                      </div>
                    )}

                    {/* Frecce laterali */}
                    {allPhotos.length > 1 && (
                      <>
                        <button onClick={e => { e.stopPropagation(); scrollToPhotoInStrip(spot.id, curPhotoIdx === 0 ? allPhotos.length - 1 : curPhotoIdx - 1); }} className="photo-nav-btn"
                          style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', border: 'none', borderRadius: '50%', width: 34, height: 34, color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}>‹</button>
                        <button onClick={e => { e.stopPropagation(); scrollToPhotoInStrip(spot.id, (curPhotoIdx + 1) % allPhotos.length); }} className="photo-nav-btn"
                          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', border: 'none', borderRadius: '50%', width: 34, height: 34, color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}>›</button>
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ height: 80, background: 'var(--gray-800)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 36, opacity: 0.2 }}>{tipo.emoji}</span>
                  </div>
                )}

                {/* Info */}
                <div style={{ padding: '10px 12px 4px', background: '#0a0a0a' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--bone)', lineHeight: 1.2, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                    {spot.name}
                  </div>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                    {spot.city && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)' }}>📍 {spot.city}</span>}
                    {spot.difficulty && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#ffce4d' }}>⚡ {spot.difficulty.toUpperCase()}</span>}
                    {(spot.likes_count ?? 0) > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--orange)' }}>🔥 {spot.likes_count}</span>}
                    {spot.submitted_by_username && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-600)' }}>@{spot.submitted_by_username}</span>}
                  </div>
                </div>

                {/* CTA bottom */}
                <div style={{ display: 'flex', gap: 8, padding: '8px 12px 12px', background: '#0a0a0a' }}>
                  <button
                    onClick={e => onToggleFav(e, spot.id)}
                    className="spot-fav-btn"
                    aria-label={myFav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                    style={{ width: 40, height: 40, flexShrink: 0, background: myFav ? 'rgba(255,106,0,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${myFav ? 'var(--orange)' : 'rgba(255,255,255,0.15)'}`, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, transition: 'all 0.15s' }}
                  >{myFav ? '❤️' : '🤍'}</button>
                  <Link
                    href={`/map/spot/${spot.slug}`}
                    onClick={e => e.stopPropagation()}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#000', background: 'var(--orange)', borderRadius: 8, height: 40, textDecoration: 'none', letterSpacing: '0.05em', boxShadow: '0 2px 12px rgba(255,106,0,0.3)' }}
                  >
                    VEDI SPOT →
                  </Link>
                  <button
                    onClick={e => { e.stopPropagation(); window.open(`https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lon}`, '_blank'); }}
                    aria-label="Portami qui"
                    style={{ width: 40, height: 40, flexShrink: 0, background: 'rgba(255,106,0,0.1)', border: '1px solid rgba(255,106,0,0.3)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}
                  >📍</button>
                </div>
              </div>

          </div>
        );
      })}

      <div style={{ height: 'calc(48px + env(safe-area-inset-bottom, 0px))' }} />
    </div>
    </>
  );
}

/* ── Bottone mappa generico ── */
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
      style={{
        width: 40, height: 40,
        background: active ? 'var(--orange)' : 'var(--gray-800)',
        border: `1px solid ${active ? 'var(--orange)' : 'var(--gray-600)'}`,
        borderRadius: 6,
        color: active ? '#000' : loading ? 'var(--orange)' : 'var(--bone)',
        fontSize: 18, cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 14px rgba(0,0,0,0.6)',
        animation: loading ? 'spin-slow 1s linear infinite' : 'none',
        flexShrink: 0,
      } as React.CSSProperties}
    >
      {children}
    </button>
  );
}

