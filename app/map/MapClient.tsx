'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { SpotMapPin, SpotType } from '@/lib/types';
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

interface MapClientProps { initialSpots: SpotMapPin[] }

const TOP_OFFSET = 100;

/* ════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════ */
export default function MapClient({ initialSpots }: MapClientProps) {
  const [spots]              = useState<SpotMapPin[]>(initialSpots);
  const [filterType,         setFilterType]         = useState<SpotType | null>(null);
  const [filterRegionCities, setFilterRegionCities] = useState<string[] | null>(null);
  const [searchQuery,        setSearchQuery]        = useState('');
  const [addOpen,            setAddOpen]            = useState(false);
  const [supportOpen,        setSupportOpen]        = useState(false);
  const [addLat,             setAddLat]             = useState<number | undefined>();
  const [addLon,             setAddLon]             = useState<number | undefined>();
  const [flyTarget,          setFlyTarget]          = useState<{ lat: number; lon: number; zoom?: number } | null>(null);
  const [authOpen,           setAuthOpen]           = useState(false);

  /* ── Spot attivo (bordo + mappa) e spot espanso (contenuto) — separati ── */
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [scrollToId,   setScrollToId]   = useState<string | null>(null);
  /* flag: cambiamento viene dallo scroll (IO) → non ri-flyare */
  const fromScrollRef = useRef(false);

  const filtered = useMemo(() => spots.filter((s) => {
    if (filterType && s.type !== filterType) return false;
    if (filterRegionCities && s.city && !filterRegionCities.includes(s.city)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase().replace(/^@/, '');
      return (
        s.name.toLowerCase().includes(q) ||
        (s.city ?? '').toLowerCase().includes(q) ||
        (s.submitted_by_username ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  }), [spots, filterType, filterRegionCities, searchQuery]);

  /* Pin selezionato sulla mappa (marker ingrandito + orange outline) */
  const selectedPin = useMemo(() =>
    filtered.find(s => s.id === activeListId) ?? null,
  [filtered, activeListId]);

  /* ── Radius search ── */
  const [radiusMode,   setRadiusMode]   = useState(false);
  const [radiusCenter, setRadiusCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [radiusKm,     setRadiusKm]     = useState(50);
  const [gpsLoading,   setGpsLoading]   = useState(false);

  const handleFilterRegion = useCallback((label: string | null) => {
    if (!label) { setFilterRegionCities(null); return; }
    const region = REGIONI_ITALIA.find(r => r.label === label);
    setFilterRegionCities(region?.cities ?? null);
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

  /* Click su uno spot (da mappa o da lista) → espandi card + vola mappa */
  const handleSpotClick = useCallback((pin: SpotMapPin) => {
    setActiveListId(pin.id);
    setExpandedId(prev => prev === pin.id ? null : pin.id); // toggle
    setScrollToId(pin.id);
    setFlyTarget({ lat: pin.lat, lon: pin.lon, zoom: 15 });
  }, []);

  /* Scroll sync: IO ha visto una card → aggiorna solo mappa, NON espande */
  const handleActivateFromScroll = useCallback((id: string) => {
    fromScrollRef.current = true;
    setActiveListId(id);
    const spot = filtered.find(s => s.id === id);
    if (spot) setFlyTarget({ lat: spot.lat, lon: spot.lon, zoom: 15 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

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
        onAddSpot={() => setAddOpen(true)}
        activeType={filterType}
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
          filterRegionCities={filterRegionCities}
          searchQuery={searchQuery}
          onSpotClick={handleSpotClick}
          onAddSpotAt={handleAddSpotAt}
          flyTarget={flyTarget}
          selectedPin={selectedPin}
          radiusMode={radiusMode}
          radiusCenter={radiusCenter}
          radiusKm={radiusKm}
          onMapClick={handleMapClick}
        />
        <RadiusBtn active={radiusMode} onClick={() => radiusMode ? closeRadiusMode() : setRadiusMode(true)} />
        {radiusMode && !radiusCenter && <RadiusToast />}
      </div>

      {/* ── OVERLAY LISTA — galleggia sulla mappa ── */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 10,
        height: 'clamp(270px, 54dvh, 480px)',
        display: 'flex', flexDirection: 'column',
        pointerEvents: 'none',
      }}>
        {/* Gradiente fade */}
        <div style={{
          height: 56, flexShrink: 0,
          background: 'linear-gradient(to bottom, transparent 0%, rgba(10,10,10,0.88) 100%)',
        }} />

        {/* Pannello scroll */}
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
  const [favs,    setFavs]    = useState<Record<string, boolean>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});

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

  /* Scroll programmatico quando richiesto dall'esterno (click su mappa) */
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

  if (spots.length === 0) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--gray-500)', fontSize: 14 }}>
        Nessuno spot trovato.<br />
        <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>Prova a cambiare filtro.</span>
      </div>
    );
  }

  return (
    <div ref={panelRef} style={{ height: '100%', overflowY: 'auto', overscrollBehavior: 'contain' }}>

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
        {!activeId && (
          <span style={{ color: 'var(--orange)', fontSize: 9, opacity: 0.7 }}>
            ↕ scorri per esplorare
          </span>
        )}
      </div>

      {spots.map((spot, idx) => {
        const tipo      = TIPI_SPOT[spot.type];
        const cond      = CONDIZIONI[spot.condition];
        const isAct     = activeId   === spot.id;   // bordo arancione + REC + pin ingrandito
        const isExp     = expandedId === spot.id;   // contenuto espanso (solo click)
        const myFav     = favs[spot.id]    ?? false;
        const myRate    = ratings[spot.id] ?? 0;
        const isLast    = idx === spots.length - 1;
        /* In evidenza: i primi 3 quando nessuno è espanso */
        const featured  = !expandedId && idx < 3;

        return (
          <div
            key={spot.id}
            ref={(el) => setRef(spot.id, el)}
            data-spot-id={spot.id}
            onClick={() => onSpotClick(spot)}
            style={{
              position: 'relative',
              borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
              borderLeft: `3px solid ${
                isAct    ? 'var(--orange)' :
                featured ? 'rgba(255,106,0,0.22)' :
                'transparent'
              }`,
              transition: 'border-color 0.25s, background 0.15s',
              cursor: 'pointer',
              background: isExp ? 'rgba(255,106,0,0.05)' : featured ? 'rgba(255,106,0,0.015)' : 'transparent',
            }}
            onMouseEnter={e => { if (!isExp) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
            onMouseLeave={e => { if (!isExp) (e.currentTarget as HTMLElement).style.background = featured ? 'rgba(255,106,0,0.015)' : 'transparent'; }}
          >
            {/* Featured badge */}
            {featured && (
              <div style={{
                position: 'absolute', top: 6, right: 8,
                fontFamily: 'var(--font-mono)', fontSize: 8,
                color: 'var(--orange)', opacity: 0.55,
                letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                ★ IN EVIDENZA
              </div>
            )}

            {/* Riga principale */}
            <div style={{ display: 'flex', gap: 10, padding: '11px 44px 11px 10px' }}>

              {/* Foto thumbnail */}
              <div style={{
                width: 76, height: 76, flexShrink: 0,
                borderRadius: 4, overflow: 'hidden',
                background: 'var(--gray-700)', position: 'relative',
                boxShadow: isAct ? '0 0 0 2px var(--orange), 0 0 12px rgba(255,106,0,0.3)' : 'none',
                transition: 'box-shadow 0.25s',
              }}>
                {spot.cover_url ? (
                  <img
                    src={spot.cover_url} alt={spot.name}
                    style={{
                      width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                      filter: isAct ? 'contrast(1.08) saturate(1.15)' : 'none',
                      transition: 'filter 0.25s',
                    }}
                    loading="lazy"
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, opacity: 0.4 }}>
                    {tipo.emoji}
                  </div>
                )}
                {isAct && (
                  <>
                    <div style={{
                      position: 'absolute', inset: 0, pointerEvents: 'none',
                      backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.18) 2px,rgba(0,0,0,0.18) 4px)',
                      mixBlendMode: 'multiply',
                    }} />
                    <div style={{
                      position: 'absolute', top: 3, left: 3,
                      background: 'var(--orange)', color: '#000',
                      fontFamily: 'var(--font-mono)', fontSize: 7,
                      padding: '1px 4px', borderRadius: 1, fontWeight: 700,
                    }}>● REC</div>
                  </>
                )}
              </div>

              {/* Info testo */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center' }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
                  color: isAct ? 'var(--orange)' : 'var(--bone)', lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                  transition: 'color 0.25s',
                }}>
                  {spot.name}
                </div>

                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                  {spot.condition === 'alive' ? (
                    <span style={{
                      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                      background: '#00c851', boxShadow: '0 0 5px #00c851aa', flexShrink: 0,
                    }} title="Spot attivo" />
                  ) : (
                    <span style={{
                      background: cond.bg, color: cond.color,
                      fontFamily: 'var(--font-mono)', fontSize: 9,
                      padding: '2px 5px', borderRadius: 2, textTransform: 'uppercase',
                    }}>
                      {cond.label}
                    </span>
                  )}
                  <span style={{
                    color: tipo.color, fontFamily: 'var(--font-mono)', fontSize: 9,
                    padding: '2px 5px', borderRadius: 2,
                    border: `1px solid ${tipo.color}55`,
                    textTransform: 'uppercase', letterSpacing: '0.03em',
                  }}>
                    {tipo.label}
                  </span>
                </div>

                {myRate > 0 && (
                  <div style={{ display: 'flex', gap: 1 }}>
                    {[1,2,3,4,5].map(i => (
                      <span key={i} style={{ fontSize: 9, color: i <= myRate ? '#fbbf24' : 'var(--gray-600)' }}>★</span>
                    ))}
                  </div>
                )}

                {(spot.city || spot.submitted_by_username) && (
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {[spot.city, spot.submitted_by_username ? `@${spot.submitted_by_username}` : null].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            </div>

            {/* Preferiti */}
            <button
              onClick={e => handleFav(e, spot.id)}
              style={{
                position: 'absolute', top: 10, right: 8,
                background: myFav ? 'rgba(255,60,60,0.15)' : 'rgba(20,20,20,0.7)',
                border: myFav ? '1px solid rgba(255,60,60,0.4)' : '1px solid rgba(255,255,255,0.07)',
                borderRadius: '50%', width: 26, height: 26,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 11, padding: 0,
              }}
              aria-label="Preferiti"
            >
              {myFav ? '❤️' : '🤍'}
            </button>

            {/* ── ESPANSIONE INLINE — visibile solo al click esplicito ── */}
            {isExp && (
              <div
                onClick={e => e.stopPropagation()}
                style={{ padding: '0 10px 12px' }}
              >
                {/* Foto grande → tap porta alla scheda spot */}
                <Link
                  href={`/map/spot/${spot.slug}`}
                  style={{
                    display: 'block', borderRadius: 6, overflow: 'hidden',
                    marginBottom: 9, position: 'relative',
                    height: 110, background: '#0a0a0a',
                    border: '1px solid rgba(255,255,255,0.06)',
                    textDecoration: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {spot.cover_url ? (
                    <img
                      src={spot.cover_url} alt={spot.name}
                      style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 40, opacity: 0.2,
                    }}>
                      {tipo.emoji}
                    </div>
                  )}
                  {/* Overlay hint */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)',
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                    paddingBottom: 9,
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10,
                      color: '#fff', letterSpacing: '0.05em', textTransform: 'uppercase',
                      background: 'rgba(0,0,0,0.55)', padding: '3px 12px', borderRadius: 12,
                    }}>
                      tocca per la scheda →
                    </span>
                  </div>
                </Link>

                {/* Bottoni: Nav + Scheda */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lon}`,
                      '_blank'
                    )}
                    style={{
                      flex: 1, padding: '9px 0',
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 6,
                      fontFamily: 'var(--font-mono)', fontSize: 11,
                      color: 'var(--bone)', cursor: 'pointer',
                    }}
                  >
                    🧭 Portami qui
                  </button>
                  <Link
                    href={`/map/spot/${spot.slug}`}
                    style={{
                      flex: 1, padding: '9px 0',
                      background: 'var(--orange)', color: '#000',
                      borderRadius: 6, border: 'none',
                      fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', textDecoration: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      letterSpacing: '0.03em',
                    }}
                  >
                    Scheda →
                  </Link>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div style={{ height: 48 }} />
    </div>
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
