'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { SpotMapPin, SpotType, SpotCondition } from '@/lib/types';
import { REGIONI_ITALIA, TIPI_SPOT, CONDIZIONI } from '@/lib/constants';
import TopBar from '@/components/TopBar';
import AddSpotModal from '@/components/AddSpotModal';
import SupportModal from '@/components/SupportModal';
import AuthModal from '@/components/AuthModal';
import RadiusSheet from '@/components/RadiusSheet';

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
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--gray-800)', fontFamily: 'var(--font-mono)',
      color: 'var(--orange)', fontSize: 16,
    }}>
      CARICAMENTO MAPPA...
    </div>
  ),
});

interface MapClientProps { initialSpots: SpotMapPin[]; autoAdd?: boolean }

const TOP_OFFSET = 100;

/* ════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════ */
export default function MapClient({ initialSpots, autoAdd }: MapClientProps) {
  const [spots]              = useState<SpotMapPin[]>(initialSpots);
  const [filterType,      setFilterType]      = useState<SpotType | null>(null);
  const [filterRegion,    setFilterRegion]    = useState<typeof REGIONI_ITALIA[0] | null>(null);
  const [filterCondition, setFilterCondition] = useState<SpotCondition | null>(null);
  const [filterDifficulty,setFilterDifficulty]= useState<string | null>(null);
  const [searchQuery,        setSearchQuery]        = useState('');
  const [addOpen,            setAddOpen]            = useState(false);
  const [supportOpen,        setSupportOpen]        = useState(false);
  const [addLat,             setAddLat]             = useState<number | undefined>();
  const [addLon,             setAddLon]             = useState<number | undefined>();
  const [flyTarget,          setFlyTarget]          = useState<{ lat: number; lon: number; zoom?: number } | null>(null);
  const [authOpen,           setAuthOpen]           = useState(false);
  const [fitAllTrigger,      setFitAllTrigger]      = useState(0);

  /* ── Auto-open add modal se URL contiene ?add=1 ── */
  useEffect(() => {
    if (autoAdd) setAddOpen(true);
  }, [autoAdd]);

  /* ── Pannello ridimensionabile ── */
  const DEFAULT_PANEL_H = () =>
    typeof window !== 'undefined'
      ? Math.min(480, Math.max(270, window.innerHeight * 0.54))
      : 320;
  const [panelHeight, setPanelHeight] = useState<number>(320);
  useEffect(() => { setPanelHeight(DEFAULT_PANEL_H()); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const dragState = useRef<{ startY: number; startH: number } | null>(null);

  const onDragStart = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = { startY: e.clientY, startH: panelHeight };
  }, [panelHeight]);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return;
    const delta  = dragState.current.startY - e.clientY; // positivo = su = pannello più alto
    const newH   = Math.min(
      window.innerHeight * 0.88,
      Math.max(44, dragState.current.startH + delta),
    );
    setPanelHeight(newH);
  }, []);

  const onDragEnd = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return;
    /* Snap su/giù: se < 120px → collassa a 44; se > 75% vh → espandi a 88% */
    const h = dragState.current.startH + (dragState.current.startY - e.clientY);
    if (h < 120) setPanelHeight(44);
    else if (h > window.innerHeight * 0.75) setPanelHeight(Math.round(window.innerHeight * 0.88));
    dragState.current = null;
  }, []);

  /* ── Spot attivo (bordo + mappa) e spot espanso (contenuto) — separati ── */
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [scrollToId,   setScrollToId]   = useState<string | null>(null);
  /* flag: cambiamento viene dallo scroll (IO) → non ri-flyare */
  const fromScrollRef = useRef(false);

  const filtered = useMemo(() => spots.filter((s) => {
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
  }), [spots, filterType, filterRegion, filterCondition, filterDifficulty, searchQuery]);

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

  /* ── Radius search ── */
  const [radiusMode,   setRadiusMode]   = useState(false);
  const [radiusCenter, setRadiusCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [radiusKm,     setRadiusKm]     = useState(50);
  const [gpsLoading,   setGpsLoading]   = useState(false);

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
      .map(s => ({ ...s, distance: haversineKm(radiusCenter.lat, radiusCenter.lon, s.lat, s.lon) }))
      .filter(s => s.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
  }, [spots, radiusCenter, radiusKm]);

  const handleMapClick = useCallback((lat: number, lon: number) => {
    if (radiusMode) setRadiusCenter({ lat, lon });
  }, [radiusMode]);

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

  const closeRadiusMode = useCallback(() => { setRadiusMode(false); setRadiusCenter(null); }, []);

  /* Click su uno spot (da mappa o da lista) → espandi card + vola mappa
     Zoom 13: mostra il quartiere/zona, non solo il singolo marciapiede,
     così l'utente capisce subito dove si trova lo spot nel contesto urbano. */
  const handleSpotClick = useCallback((pin: SpotMapPin) => {
    setActiveListId(pin.id);
    setExpandedId(prev => prev === pin.id ? null : pin.id); // toggle
    setScrollToId(pin.id);
    setFlyTarget({ lat: pin.lat, lon: pin.lon, zoom: 13 });
  }, []);

  /* Scroll sync: IO ha visto una card → aggiorna SOLO il pin attivo (bordo arancione)
     ma NON muove la mappa. La mappa si muove solo su click esplicito. */
  const handleActivateFromScroll = useCallback((id: string) => {
    fromScrollRef.current = true;
    setActiveListId(id);
    // ← nessun setFlyTarget: la mappa resta ferma durante lo scroll
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCitySelect = useCallback((city: string, lat: number, lon: number) => {
    setFlyTarget({ lat, lon, zoom: 14 });
    setSearchQuery(city);
  }, []);

  const handleAddSpotAt = useCallback((lat: number, lon: number) => {
    setAddLat(lat); setAddLon(lon); setAddOpen(true);
  }, []);

  return (
    <div style={{ height: '100dvh', overflow: 'hidden' }}>

      <TopBar
        onSearch={setSearchQuery}
        onFilterType={setFilterType}
        onFilterRegion={handleFilterRegion}
        onFilterCondition={setFilterCondition}
        onFilterDifficulty={setFilterDifficulty}
        onAddSpot={() => setAddOpen(true)}
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
        top: TOP_OFFSET, left: 0, right: 0, bottom: 0,
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
          overlayOffsetPx={160}
          fitAllTrigger={fitAllTrigger}
          radiusMode={radiusMode}
          radiusCenter={radiusCenter}
          radiusKm={radiusKm}
          onMapClick={handleMapClick}
        />
        <RadiusBtn active={radiusMode} onClick={() => radiusMode ? closeRadiusMode() : setRadiusMode(true)} />
        {radiusMode && !radiusCenter && <RadiusToast />}
      </div>

      {/* ── OVERLAY LISTA — galleggia sulla mappa, altezza regolabile ── */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 10,
        height: panelHeight,
        display: 'flex', flexDirection: 'column',
        pointerEvents: 'none',
        transition: dragState.current ? 'none' : 'height 0.18s ease',
      }}>
        {/* ── DRAG HANDLE ── */}
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: 36, zIndex: 2,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 4,
            cursor: 'ns-resize',
            pointerEvents: 'all',
            touchAction: 'none',
          }}
        >
          {/* pill */}
          <div style={{
            width: 40, height: 4, borderRadius: 3,
            background: 'rgba(255,255,255,0.28)',
            marginTop: 10,
          }} />
        </div>

        {/* Gradiente fade */}
        <div style={{
          height: 56, flexShrink: 0,
          background: 'linear-gradient(to bottom, transparent 0%, rgba(10,10,10,0.88) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Pannello scroll — visibile solo se il pannello è abbastanza alto */}
        {panelHeight > 80 && (
          <div style={{
            flex: 1,
            background: 'rgba(10,10,10,0.94)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            overflow: 'hidden',
            pointerEvents: 'all',
          }}>
            <SpotListPanel
              spots={filtered}
              activeId={activeListId}
              expandedId={expandedId}
              onActivate={handleActivateFromScroll}
              onSpotClick={handleSpotClick}
              scrollToId={scrollToId}
              onScrolled={() => setScrollToId(null)}
            />
          </div>
        )}
      </div>

      {/* Radius sheet */}
      {radiusMode && (
        <RadiusSheet
          radiusKm={radiusKm} center={radiusCenter} spots={spotsInRadius}
          onSetRadius={setRadiusKm} onUseGPS={handleUseGPS} onClose={closeRadiusMode}
          onSpotClick={handleSpotClick} gpsLoading={gpsLoading}
        />
      )}

      <AddSpotModal
        open={addOpen}
        onClose={() => { setAddOpen(false); setAddLat(undefined); setAddLon(undefined); }}
        initialLat={addLat} initialLon={addLon}
      />
      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   SPOT LIST PANEL
════════════════════════════════════════════════════════ */

const FAVS_KEY  = 'cmaps_favs_v1';
const ratingKey = (id: string) => `cmaps_rating_${id}`;

function isFav(id: string) {
  try { return (JSON.parse(localStorage.getItem(FAVS_KEY) ?? '[]') as string[]).includes(id); }
  catch { return false; }
}
function toggleFav(id: string) {
  try {
    const favs: string[] = JSON.parse(localStorage.getItem(FAVS_KEY) ?? '[]');
    const i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1); else favs.push(id);
    localStorage.setItem(FAVS_KEY, JSON.stringify(favs));
    return i < 0;
  } catch { return false; }
}
function getMyRating(id: string): number {
  try { return Math.min(5, Math.max(0, parseInt(localStorage.getItem(ratingKey(id)) ?? '0', 10) || 0)); }
  catch { return 0; }
}

function SpotListPanel({
  spots, activeId, expandedId, onActivate, onSpotClick, scrollToId, onScrolled,
}: {
  spots:       SpotMapPin[];
  activeId:    string | null;
  expandedId:  string | null;
  onActivate:  (id: string) => void;
  onSpotClick: (pin: SpotMapPin) => void;
  scrollToId:  string | null;
  onScrolled:  () => void;
}) {
  const [favs,       setFavs]       = useState<Record<string, boolean>>({});
  const [ratings,    setRatings]    = useState<Record<string, number>>({});
  /* Indice foto corrente per ogni spot (nella card espansa) */
  const [photoIdx,   setPhotoIdx]   = useState<Record<string, number>>({});
  /* Lightbox: { urls, idx } */
  const [lightbox,   setLightbox]   = useState<{ urls: string[]; idx: number } | null>(null);

  const panelRef  = useRef<HTMLDivElement>(null);
  const cardRefs  = useRef<Map<string, Element>>(new Map());
  const ioRef     = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const f: Record<string, boolean> = {};
    const r: Record<string, number>  = {};
    spots.forEach(s => { f[s.id] = isFav(s.id); r[s.id] = getMyRating(s.id); });
    setFavs(f); setRatings(r);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots.length]);

  /* IntersectionObserver con root = pannello scroll */
  useEffect(() => {
    ioRef.current?.disconnect();
    if (!panelRef.current) return;
    ioRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset.spotId;
            if (id) onActivate(id);
            break;
          }
        }
      },
      { root: panelRef.current, rootMargin: '-10% 0px -55% 0px', threshold: 0 }
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
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    onScrolled();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToId]);

  const handleFav = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const added = toggleFav(id);
    setFavs(prev => ({ ...prev, [id]: added }));
  };

  /* Chiude lightbox con Escape */
  useEffect(() => {
    if (!lightbox) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight') setLightbox(l => l && l.idx < l.urls.length - 1 ? { ...l, idx: l.idx + 1 } : l);
      if (e.key === 'ArrowLeft')  setLightbox(l => l && l.idx > 0 ? { ...l, idx: l.idx - 1 } : l);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [lightbox]);

  if (spots.length === 0) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--gray-500)', fontSize: 14 }}>
        Nessuno spot trovato.<br />
        <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>Prova a cambiare filtro.</span>
      </div>
    );
  }

  return (
    <>
    {/* ── LIGHTBOX ── */}
    {lightbox && (
      <div
        onClick={() => setLightbox(null)}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.96)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* Close */}
        <button onClick={() => setLightbox(null)} style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
          width: 44, height: 44, fontSize: 22, color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
        }}>✕</button>

        {/* Prev */}
        {lightbox.idx > 0 && (
          <button onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, idx: l.idx - 1 } : l); }}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 48, height: 48, fontSize: 26, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        )}

        {/* Image */}
        <img
          src={lightbox.urls[lightbox.idx]}
          alt=""
          onClick={e => e.stopPropagation()}
          style={{ maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 4, boxShadow: '0 8px 48px rgba(0,0,0,0.8)' }}
        />

        {/* Next */}
        {lightbox.idx < lightbox.urls.length - 1 && (
          <button onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, idx: l.idx + 1 } : l); }}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 48, height: 48, fontSize: 26, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        )}

        {/* Counter */}
        {lightbox.urls.length > 1 && (
          <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            {lightbox.idx + 1} / {lightbox.urls.length}
          </div>
        )}
      </div>
    )}

    <div ref={panelRef} style={{ height: '100%', overflowY: 'auto', overscrollBehavior: 'contain' } as React.CSSProperties}>

      <style>{`
        .spot-card-wrap { -webkit-tap-highlight-color: transparent; }
        @media (hover: hover) and (pointer: fine) {
          .spot-card-wrap:not([data-exp="1"]):hover { background: rgba(255,255,255,0.025) !important; }
        }
        .spot-card-wrap:active { opacity: 0.9; }
        .spot-fav-btn { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
        .photo-nav-btn { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
        .thumb-btn { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
      `}</style>

      {/* Header lista */}
      <div style={{
        padding: '7px 14px 5px',
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0,
        background: 'rgba(10,10,10,0.94)', zIndex: 2,
      }}>
        <span>{spots.length} spot</span>
      </div>

      {spots.map((spot, idx) => {
        const tipo      = TIPI_SPOT[spot.type];
        const cond      = CONDIZIONI[spot.condition];
        const isAct     = activeId   === spot.id;
        const isExp     = expandedId === spot.id;
        const myFav     = favs[spot.id]    ?? false;
        const isLast    = idx === spots.length - 1;
        const featured  = !expandedId && idx < 3;

        /* Foto disponibili */
        const allPhotos = spot.photo_urls && spot.photo_urls.length > 0
          ? spot.photo_urls
          : spot.cover_url ? [spot.cover_url] : [];
        const curPhotoIdx = photoIdx[spot.id] ?? 0;
        const curPhoto    = allPhotos[curPhotoIdx];

        const goPrev = (e: React.MouseEvent) => {
          e.stopPropagation();
          setPhotoIdx(p => ({ ...p, [spot.id]: Math.max(0, (p[spot.id] ?? 0) - 1) }));
        };
        const goNext = (e: React.MouseEvent) => {
          e.stopPropagation();
          setPhotoIdx(p => ({ ...p, [spot.id]: Math.min(allPhotos.length - 1, (p[spot.id] ?? 0) + 1) }));
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
              borderLeft: `3px solid ${isAct ? 'var(--orange)' : featured ? 'rgba(255,106,0,0.22)' : 'transparent'}`,
              transition: 'border-color 0.25s, background 0.15s',
              cursor: 'pointer',
              background: isExp ? 'rgba(255,106,0,0.04)' : featured ? 'rgba(255,106,0,0.01)' : 'transparent',
              touchAction: 'manipulation',
            }}
          >

            {/* ══ EXPANDED LAYOUT ══ */}
            {isExp ? (
              <div>
                {/* ── FOTO GRANDE full-width ── */}
                {allPhotos.length > 0 ? (
                  <div style={{ position: 'relative', background: '#0a0a0a' }}>
                    {/* Immagine principale — cliccabile per lightbox */}
                    <div
                      style={{ height: 220, overflow: 'hidden', cursor: 'zoom-in' }}
                      onClick={e => { e.stopPropagation(); setLightbox({ urls: allPhotos, idx: curPhotoIdx }); }}
                    >
                      <img
                        src={curPhoto}
                        alt={spot.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        loading="lazy"
                      />
                      {/* Icona zoom */}
                      <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', borderRadius: 4, padding: '3px 6px', fontSize: 13, pointerEvents: 'none' }}>🔍</div>
                    </div>

                    {/* Frecce prev/next */}
                    {allPhotos.length > 1 && curPhotoIdx > 0 && (
                      <button onClick={goPrev} className="photo-nav-btn" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 44, background: 'linear-gradient(to right,rgba(0,0,0,0.5),transparent)', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                    )}
                    {allPhotos.length > 1 && curPhotoIdx < allPhotos.length - 1 && (
                      <button onClick={goNext} className="photo-nav-btn" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 44, background: 'linear-gradient(to left,rgba(0,0,0,0.5),transparent)', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                    )}

                    {/* Contatore */}
                    {allPhotos.length > 1 && (
                      <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5 }}>
                        {allPhotos.map((_, i) => (
                          <div key={i} onClick={e => { e.stopPropagation(); setPhotoIdx(p => ({ ...p, [spot.id]: i })); }}
                            style={{ width: i === curPhotoIdx ? 16 : 6, height: 6, borderRadius: 3, background: i === curPhotoIdx ? 'var(--orange)' : 'rgba(255,255,255,0.35)', transition: 'width 0.2s, background 0.2s', cursor: 'pointer' }} />
                        ))}
                      </div>
                    )}

                    {/* Cuore in alto a sinistra */}
                    <button onClick={e => handleFav(e, spot.id)} className="spot-fav-btn"
                      style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: 4, width: 34, height: 34, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {myFav ? '❤️' : '🤍'}
                    </button>
                  </div>
                ) : (
                  /* Nessuna foto */
                  <div style={{ height: 80, background: 'var(--gray-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, opacity: 0.3 }}>
                    {tipo.emoji}
                  </div>
                )}

                {/* Thumbnail strip */}
                {allPhotos.length > 1 && (
                  <div style={{ display: 'flex', gap: 4, padding: '6px 10px', background: '#080808', overflowX: 'auto', scrollbarWidth: 'none' } as React.CSSProperties}>
                    {allPhotos.map((url, i) => (
                      <button key={i} className="thumb-btn" onClick={e => { e.stopPropagation(); setPhotoIdx(p => ({ ...p, [spot.id]: i })); }}
                        style={{ flexShrink: 0, width: 52, height: 40, border: `2px solid ${i === curPhotoIdx ? 'var(--orange)' : 'transparent'}`, borderRadius: 3, overflow: 'hidden', padding: 0, cursor: 'pointer', background: '#111' }}>
                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Info testo */}
                <div style={{ padding: '12px 14px 14px' }}>
                  {/* Nome + badges */}
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 17, fontWeight: 700, color: 'var(--orange)', marginBottom: 6, lineHeight: 1.2 }}>
                    {spot.name}
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                    {spot.condition === 'alive' ? (
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#00c851', boxShadow: '0 0 5px #00c851aa' }} />
                    ) : (
                      <span style={{ background: cond.bg, color: cond.color, fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 6px', borderRadius: 2, textTransform: 'uppercase' }}>{cond.label}</span>
                    )}
                    <span style={{ color: tipo.color, fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 6px', borderRadius: 2, border: `1px solid ${tipo.color}55`, textTransform: 'uppercase' }}>{tipo.emoji} {tipo.label}</span>
                    {spot.difficulty && <span style={{ color: '#ffce4d', fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 6px', borderRadius: 2, border: '1px solid rgba(255,206,77,0.35)', textTransform: 'uppercase' }}>⚡ {spot.difficulty}</span>}
                  </div>

                  {/* Città + autore */}
                  {(spot.city || spot.submitted_by_username) && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginBottom: 6 }}>
                      {spot.city && <span>📍 {spot.city}</span>}
                      {spot.submitted_by_username && <span style={{ color: 'var(--gray-600)' }}> · @{spot.submitted_by_username}</span>}
                    </div>
                  )}

                  {/* Descrizione */}
                  {spot.description && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', lineHeight: 1.55, marginBottom: 12 }}>
                      {spot.description}
                    </div>
                  )}

                  {/* Azioni */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link
                      href={`/map/spot/${spot.slug}`}
                      onClick={e => e.stopPropagation()}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#000', background: 'var(--orange)', border: 'none', borderRadius: 4, padding: '10px 0', textDecoration: 'none', letterSpacing: '0.04em' }}
                    >
                      VEDI SPOT →
                    </Link>
                    <button
                      onClick={e => { e.stopPropagation(); window.open(`https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lon}`, '_blank'); }}
                      title="Portami qui"
                      style={{ width: 42, height: 42, background: 'rgba(255,106,0,0.1)', border: '1px solid rgba(255,106,0,0.35)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}
                    >📍</button>
                  </div>
                </div>
              </div>

            ) : (
              /* ══ COMPACT LAYOUT (invariato) ══ */
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px' }}>
                {/* Thumbnail */}
                <div style={{ flexShrink: 0, width: 76, height: 76, borderRadius: 4, overflow: 'hidden', background: 'var(--gray-700)', border: isAct ? '2px solid var(--orange)' : '1px solid rgba(255,255,255,0.07)' }}>
                  {spot.cover_url ? (
                    <img src={spot.cover_url} alt={spot.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, opacity: 0.3 }}>{tipo.emoji}</div>
                  )}
                </div>

                {/* Testo */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: isAct ? 'var(--orange)' : 'var(--bone)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                      {spot.name}
                    </div>
                    <button onClick={e => handleFav(e, spot.id)} className="spot-fav-btn" style={{ flexShrink: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: myFav ? 16 : 13, opacity: myFav ? 1 : 0.4 }}>
                      {myFav ? '❤️' : '🤍'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    {spot.condition === 'alive' ? (
                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#00c851', boxShadow: '0 0 5px #00c851aa' }} />
                    ) : (
                      <span style={{ background: cond.bg, color: cond.color, fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 5px', borderRadius: 2, textTransform: 'uppercase' }}>{cond.label}</span>
                    )}
                    <span style={{ color: tipo.color, fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 5px', borderRadius: 2, border: `1px solid ${tipo.color}55`, textTransform: 'uppercase' }}>{tipo.label}</span>
                  </div>
                  {(spot.city || spot.submitted_by_username) && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[spot.city, spot.submitted_by_username ? `@${spot.submitted_by_username}` : null].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ● REC */}
            {isAct && !isExp && (
              <div style={{ textAlign: 'right', padding: '0 10px 5px', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--gray-600)', letterSpacing: '0.1em' }}>● REC</div>
            )}
          </div>
        );
      })}

      <div style={{ height: 'calc(48px + env(safe-area-inset-bottom, 0px))' }} />
    </div>
    </>
  );
}

/* ── Bottone raggio ── */
function RadiusBtn({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title="Ricerca per raggio" style={{
      position: 'absolute', bottom: 'calc(80px + env(safe-area-inset-bottom))', left: 12,
      width: 40, height: 40,
      background: active ? 'var(--orange)' : 'var(--gray-800)',
      border: `1px solid ${active ? 'var(--orange)' : 'var(--gray-600)'}`,
      borderRadius: 4, color: active ? '#000' : 'var(--bone)',
      fontSize: 20, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 12px rgba(0,0,0,0.5)', zIndex: 10,
    }}>
      🎯
    </button>
  );
}

function RadiusToast() {
  return (
    <div style={{
      position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(10,10,10,0.9)', border: '1px solid var(--orange)',
      borderRadius: 8, padding: '7px 14px',
      fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--orange)',
      zIndex: 20, whiteSpace: 'nowrap', pointerEvents: 'none',
    }}>
      🎯 Tocca la mappa per centrare la ricerca
    </div>
  );
}
