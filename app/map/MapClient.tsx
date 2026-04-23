'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { SpotMapPin, SpotType, Spot } from '@/lib/types';
import { REGIONI_ITALIA, TIPI_SPOT, CONDIZIONI } from '@/lib/constants';
import TopBar from '@/components/TopBar';
import SpotSheet from '@/components/SpotSheet';
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

/* ════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════ */
export default function MapClient({ initialSpots }: MapClientProps) {
  const [spots]              = useState<SpotMapPin[]>(initialSpots);
  const [filterType,         setFilterType]         = useState<SpotType | null>(null);
  const [filterRegionLabel,  setFilterRegionLabel]  = useState<string | null>(null);
  const [filterRegionCities, setFilterRegionCities] = useState<string[] | null>(null);
  const [searchQuery,        setSearchQuery]        = useState('');
  const [selectedSpot,       setSelectedSpot]       = useState<Spot | null>(null);
  const [selectedIdx,        setSelectedIdx]        = useState<number>(-1);
  const [addOpen,            setAddOpen]            = useState(false);
  const [supportOpen,        setSupportOpen]        = useState(false);
  const [addLat,             setAddLat]             = useState<number | undefined>();
  const [addLon,             setAddLon]             = useState<number | undefined>();
  const [loadingSpot,        setLoadingSpot]        = useState(false);
  const [flyTarget,          setFlyTarget]          = useState<{ lat: number; lon: number; zoom?: number } | null>(null);
  const [authOpen,           setAuthOpen]           = useState(false);

  /* ── Layout ── */
  const [isWide, setIsWide] = useState(false);
  useEffect(() => {
    const check = () => setIsWide(window.innerWidth >= 720);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  /* ── Spot attivo nella lista (IntersectionObserver) ── */
  const [activeListId, setActiveListId] = useState<string | null>(null);

  /* Quando la lista scorre → mappa vola allo spot visibile */
  useEffect(() => {
    if (!activeListId || selectedSpot) return;
    const spot = filtered.find(s => s.id === activeListId);
    if (spot) setFlyTarget({ lat: spot.lat, lon: spot.lon, zoom: 14 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeListId]);

  /* ── Radius search ── */
  const [radiusMode,   setRadiusMode]   = useState(false);
  const [radiusCenter, setRadiusCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [radiusKm,     setRadiusKm]     = useState(50);
  const [gpsLoading,   setGpsLoading]   = useState(false);

  const handleFilterRegion = useCallback((label: string | null) => {
    setFilterRegionLabel(label);
    if (!label) { setFilterRegionCities(null); return; }
    const region = REGIONI_ITALIA.find(r => r.label === label);
    setFilterRegionCities(region?.cities ?? null);
  }, []);

  const filtered = useMemo(() => spots.filter((s) => {
    if (filterType && s.type !== filterType) return false;
    if (filterRegionCities && s.city && !filterRegionCities.includes(s.city)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) || (s.city ?? '').toLowerCase().includes(q);
    }
    return true;
  }), [spots, filterType, filterRegionCities, searchQuery]);

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
      () => { setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const closeRadiusMode = useCallback(() => { setRadiusMode(false); setRadiusCenter(null); }, []);

  const openSpot = useCallback(async (pin: SpotMapPin) => {
    setLoadingSpot(true);
    setFlyTarget({ lat: pin.lat, lon: pin.lon, zoom: 16 });
    const idx = filtered.findIndex(s => s.id === pin.id);
    setSelectedIdx(idx);
    try {
      const res = await fetch(`/api/spots/${pin.slug}`);
      if (res.ok) { setSelectedSpot((await res.json()).data); }
      else        { setSelectedSpot(pin as unknown as Spot); }
    } catch { setSelectedSpot(pin as unknown as Spot); }
    finally { setLoadingSpot(false); }
  }, [filtered]);

  const handleNavigate = useCallback(async (idx: number) => {
    if (idx < 0 || idx >= filtered.length) return;
    await openSpot(filtered[idx]);
  }, [filtered, openSpot]);

  const handleCitySelect = useCallback((city: string, lat: number, lon: number) => {
    setFlyTarget({ lat, lon, zoom: 14 });
    setSearchQuery(city);
  }, []);

  const handleAddSpotAt = useCallback((lat: number, lon: number) => {
    setAddLat(lat); setAddLon(lon); setAddOpen(true);
  }, []);

  const handleFlag = useCallback(async (spotId: string) => {
    const reason = window.prompt('Perché segnali questo spot?');
    if (!reason) return;
    await fetch('/api/flag', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spot_id: spotId, reason }),
    });
    alert('Segnalazione inviata. Grazie!');
  }, []);

  /* Altezza contenuto fisso sotto topbar+chips */
  const TOP_OFFSET = 100; // px — topbar ~56 + filter chips ~44

  /* Altezza mappa mobile */
  const MAP_H_MOBILE = 240;

  /* Larghezza mappa desktop */
  const MAP_W_DESKTOP = '46%';

  return (
    <div style={{ height: '100dvh', overflow: 'hidden' }}>

      {/* TopBar */}
      <TopBar
        onSearch={setSearchQuery}
        onFilterType={setFilterType}
        onAddSpot={() => setAddOpen(true)}
        activeType={filterType}
        spots={spots}
        filteredCount={filtered.length}
        onCitySelect={handleCitySelect}
        onSpotSelect={openSpot}
        onOpenAuth={() => setAuthOpen(true)}
      />

      {/* ── LAYOUT PRINCIPALE ── */}
      <div style={{
        position: 'fixed',
        top: TOP_OFFSET,
        left: 0, right: 0, bottom: 0,
        display: 'flex',
        flexDirection: isWide ? 'row' : 'column',
        zIndex: 1,
        background: 'var(--black)',
      }}>

        {/* ── MAPPA (mobile: top, desktop: right) ── */}
        {!isWide ? (
          /* Mobile: mappa in cima, altezza fissa */
          <div style={{ height: MAP_H_MOBILE, flexShrink: 0, position: 'relative', borderBottom: '2px solid var(--orange)' }}>
            <SpotMap
              spots={spots} filterType={filterType} filterRegionCities={filterRegionCities}
              searchQuery={searchQuery} onSpotClick={openSpot} onAddSpotAt={handleAddSpotAt}
              flyTarget={flyTarget} radiusMode={radiusMode} radiusCenter={radiusCenter}
              radiusKm={radiusKm} onMapClick={handleMapClick}
            />
            <RadiusBtn active={radiusMode} onClick={() => radiusMode ? closeRadiusMode() : setRadiusMode(true)} />
            {radiusMode && !radiusCenter && <RadiusToast />}
          </div>
        ) : null}

        {/* ── LISTA SPOT (scrollabile) ── */}
        <div style={{
          flex: isWide ? 1 : undefined,
          width: isWide ? undefined : '100%',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          background: 'var(--black)',
        }}>
          <SpotListPanel
            spots={filtered}
            activeId={activeListId}
            onActivate={setActiveListId}
            onSpotClick={openSpot}
          />
        </div>

        {/* ── MAPPA desktop (destra, occupa altezza piena) ── */}
        {isWide && (
          <div style={{ width: MAP_W_DESKTOP, flexShrink: 0, position: 'relative', borderLeft: '2px solid var(--orange)' }}>
            <SpotMap
              spots={spots} filterType={filterType} filterRegionCities={filterRegionCities}
              searchQuery={searchQuery} onSpotClick={openSpot} onAddSpotAt={handleAddSpotAt}
              flyTarget={flyTarget} radiusMode={radiusMode} radiusCenter={radiusCenter}
              radiusKm={radiusKm} onMapClick={handleMapClick}
            />
            <RadiusBtn active={radiusMode} onClick={() => radiusMode ? closeRadiusMode() : setRadiusMode(true)} />
            {radiusMode && !radiusCenter && <RadiusToast />}
          </div>
        )}
      </div>

      {/* Loading */}
      {loadingSpot && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(10,10,10,0.9)', color: 'var(--orange)',
          fontFamily: 'var(--font-mono)', fontSize: 13, padding: '7px 16px',
          borderRadius: 4, zIndex: 50, border: '1px solid var(--gray-600)',
        }}>
          CARICAMENTO...
        </div>
      )}

      {/* Radius sheet */}
      {radiusMode && (
        <RadiusSheet
          radiusKm={radiusKm} center={radiusCenter} spots={spotsInRadius}
          onSetRadius={setRadiusKm} onUseGPS={handleUseGPS} onClose={closeRadiusMode}
          onSpotClick={openSpot} gpsLoading={gpsLoading}
        />
      )}

      {/* SpotSheet */}
      <SpotSheet
        spot={selectedSpot}
        onClose={() => { setSelectedSpot(null); setSelectedIdx(-1); }}
        onFlag={handleFlag}
        allSpots={filtered}
        currentIdx={selectedIdx >= 0 ? selectedIdx : undefined}
        onNavigate={handleNavigate}
      />

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
   SPOT LIST PANEL — lista stile subito.it
════════════════════════════════════════════════════════ */

const FAVS_KEY = 'cmaps_favs_v1';
function isFav(id: string) { try { return (JSON.parse(localStorage.getItem(FAVS_KEY) ?? '[]') as string[]).includes(id); } catch { return false; } }
function toggleFav(id: string) {
  try {
    const favs: string[] = JSON.parse(localStorage.getItem(FAVS_KEY) ?? '[]');
    const i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1); else favs.push(id);
    localStorage.setItem(FAVS_KEY, JSON.stringify(favs));
    return i < 0;
  } catch { return false; }
}

function SpotListPanel({
  spots, activeId, onActivate, onSpotClick,
}: {
  spots:      SpotMapPin[];
  activeId:   string | null;
  onActivate: (id: string) => void;
  onSpotClick:(pin: SpotMapPin) => void;
}) {
  const [favs, setFavs] = useState<Record<string, boolean>>({});

  /* Carica preferiti */
  useEffect(() => {
    const f: Record<string, boolean> = {};
    spots.forEach(s => { f[s.id] = isFav(s.id); });
    setFavs(f);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots.length]);

  const cardRefs = useRef<Map<string, Element>>(new Map());
  const ioRef    = useRef<IntersectionObserver | null>(null);

  /* IntersectionObserver: aggiorna activeId mentre scorri */
  useEffect(() => {
    ioRef.current?.disconnect();
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
      { rootMargin: '-25% 0px -50% 0px', threshold: 0 }
    );
    cardRefs.current.forEach(el => ioRef.current!.observe(el));
    return () => ioRef.current?.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots]);

  const setRef = useCallback((id: string, el: Element | null) => {
    if (el) { cardRefs.current.set(id, el); ioRef.current?.observe(el); }
    else    { cardRefs.current.delete(id); }
  }, []);

  const handleFav = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const added = toggleFav(id);
    setFavs(prev => ({ ...prev, [id]: added }));
  };

  if (spots.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--gray-500)', fontSize: 14 }}>
        Nessuno spot trovato.<br />
        <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>Prova a cambiare filtro.</span>
      </div>
    );
  }

  return (
    <div>
      {/* Contatore */}
      <div style={{
        padding: '10px 14px 6px',
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em',
        borderBottom: '1px solid var(--gray-800)',
      }}>
        {spots.length} spot
      </div>

      {/* Cards */}
      {spots.map((spot, idx) => {
        const tipo   = TIPI_SPOT[spot.type];
        const cond   = CONDIZIONI[spot.condition];
        const isAct  = activeId === spot.id;
        const myFav  = favs[spot.id] ?? false;
        const isLast = idx === spots.length - 1;

        return (
          <div
            key={spot.id}
            ref={(el) => setRef(spot.id, el)}
            data-spot-id={spot.id}
            style={{
              position: 'relative',
              borderBottom: isLast ? 'none' : '1px solid var(--gray-800)',
              borderLeft: `3px solid ${isAct ? 'var(--orange)' : 'transparent'}`,
              transition: 'border-color 0.2s',
              cursor: 'pointer',
            }}
            onClick={() => onSpotClick(spot)}
          >
            <div style={{
              display: 'flex', gap: 11, padding: '12px 12px 12px 10px',
              paddingRight: 42, // spazio per il cuore
              transition: 'opacity 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >

              {/* Foto quadrata */}
              <div style={{
                width: 82, height: 82, flexShrink: 0,
                borderRadius: 5, overflow: 'hidden',
                background: 'var(--gray-700)', position: 'relative',
              }}>
                {spot.cover_url ? (
                  <img
                    src={spot.cover_url}
                    alt={spot.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    loading="lazy"
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, opacity: 0.4 }}>
                    {tipo.emoji}
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>

                {/* Nome */}
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
                  color: 'var(--bone)', lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                }}>
                  {spot.name}
                </div>

                {/* Badges */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <span style={{
                    background: cond.bg, color: cond.color,
                    fontFamily: 'var(--font-mono)', fontSize: 9,
                    padding: '2px 5px', borderRadius: 2,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {cond.label}
                  </span>
                  <span style={{
                    color: tipo.color, fontFamily: 'var(--font-mono)', fontSize: 9,
                    padding: '2px 5px', borderRadius: 2,
                    border: `1px solid ${tipo.color}55`,
                    textTransform: 'uppercase', letterSpacing: '0.03em',
                  }}>
                    {tipo.label}
                  </span>
                </div>

                {/* Città + username */}
                {(spot.city || spot.submitted_by_username) && (
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    color: 'var(--gray-500)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {[spot.city, spot.submitted_by_username ? `@${spot.submitted_by_username}` : null]
                      .filter(Boolean).join(' · ')}
                  </div>
                )}

                {/* Link pagina completa */}
                <Link
                  href={`/map/spot/${spot.slug}`}
                  onClick={e => e.stopPropagation()}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: 'var(--orange)', letterSpacing: '0.04em',
                    textDecoration: 'none', alignSelf: 'flex-start',
                  }}
                >
                  Vedi pagina →
                </Link>
              </div>
            </div>

            {/* Cuore preferiti */}
            <button
              onClick={e => handleFav(e, spot.id)}
              style={{
                position: 'absolute', top: 12, right: 8,
                background: myFav ? 'rgba(255,60,60,0.15)' : 'rgba(20,20,20,0.7)',
                border: myFav ? '1px solid rgba(255,60,60,0.4)' : '1px solid var(--gray-700)',
                borderRadius: '50%', width: 28, height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 13, padding: 0,
              }}
              aria-label={myFav ? 'Rimuovi preferiti' : 'Aggiungi preferiti'}
            >
              {myFav ? '❤️' : '🤍'}
            </button>
          </div>
        );
      })}

      <div style={{ height: 40 }} />
    </div>
  );
}

/* ── Bottone raggio ── */
function RadiusBtn({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Ricerca per raggio"
      style={{
        position: 'absolute', bottom: 'calc(12px + env(safe-area-inset-bottom))', left: 12,
        width: 40, height: 40,
        background: active ? 'var(--orange)' : 'var(--gray-800)',
        border: `1px solid ${active ? 'var(--orange)' : 'var(--gray-600)'}`,
        borderRadius: 4,
        color: active ? '#000' : 'var(--bone)',
        fontSize: 20, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 12px rgba(0,0,0,0.5)', zIndex: 10,
      }}
    >
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
