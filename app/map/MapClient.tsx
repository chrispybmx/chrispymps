'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SpotMapPin, SpotType, Spot } from '@/lib/types';
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

const TOP_OFFSET = 100; // topbar ~56 + chips ~44

/* ════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════ */
export default function MapClient({ initialSpots }: MapClientProps) {
  const router = useRouter();
  const [spots]              = useState<SpotMapPin[]>(initialSpots);
  const [filterType,         setFilterType]         = useState<SpotType | null>(null);
  const [filterRegionLabel,  setFilterRegionLabel]  = useState<string | null>(null);
  const [filterRegionCities, setFilterRegionCities] = useState<string[] | null>(null);
  const [searchQuery,        setSearchQuery]        = useState('');
  const [addOpen,            setAddOpen]            = useState(false);
  const [supportOpen,        setSupportOpen]        = useState(false);
  const [addLat,             setAddLat]             = useState<number | undefined>();
  const [addLon,             setAddLon]             = useState<number | undefined>();
  const [flyTarget,          setFlyTarget]          = useState<{ lat: number; lon: number; zoom?: number } | null>(null);
  const [authOpen,           setAuthOpen]           = useState(false);

  /* ── Mini-sheet ── */
  const [sheetPin, setSheetPin] = useState<SpotMapPin | null>(null);

  /* ── Spot attivo nella lista (IntersectionObserver) ── */
  const [activeListId, setActiveListId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeListId || sheetPin) return;
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

  /* Click su spot: apri mini-sheet + vola sulla mappa */
  const openSheet = useCallback((pin: SpotMapPin) => {
    setSheetPin(pin);
    setFlyTarget({ lat: pin.lat, lon: pin.lon, zoom: 15 });
  }, []);

  const closeSheet = useCallback(() => setSheetPin(null), []);

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
        onSpotSelect={openSheet}
        onOpenAuth={() => setAuthOpen(true)}
      />

      {/* ── LAYOUT fisso sotto topbar+chips ── */}
      <div style={{
        position: 'fixed',
        top: TOP_OFFSET, left: 0, right: 0, bottom: 0,
        display: 'flex', flexDirection: 'column',
        zIndex: 1, background: 'var(--black)',
        overflow: 'hidden',
      }}>

        {/* ── MAPPA — più alta, con gradiente in basso ── */}
        <div style={{
          height: 'clamp(260px, 56dvh, 520px)',
          flexShrink: 0,
          position: 'relative',
        }}>
          <SpotMap
            spots={spots} filterType={filterType} filterRegionCities={filterRegionCities}
            searchQuery={searchQuery} onSpotClick={openSheet} onAddSpotAt={handleAddSpotAt}
            flyTarget={flyTarget} selectedPin={sheetPin}
            radiusMode={radiusMode} radiusCenter={radiusCenter}
            radiusKm={radiusKm} onMapClick={handleMapClick}
          />
          <RadiusBtn active={radiusMode} onClick={() => radiusMode ? closeRadiusMode() : setRadiusMode(true)} />
          {radiusMode && !radiusCenter && <RadiusToast />}

          {/* Gradiente di fusione mappa → lista */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: 72,
            background: 'linear-gradient(to bottom, transparent 0%, var(--black) 100%)',
            pointerEvents: 'none', zIndex: 5,
          }} />
        </div>

        {/* ── LISTA SPOT ── */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          background: 'var(--black)',
          marginTop: -8, // sovrappone leggermente il gradiente
        }}>
          <SpotListPanel
            spots={filtered}
            activeId={activeListId}
            onActivate={setActiveListId}
            onSpotClick={openSheet}
          />
        </div>
      </div>

      {/* ── MINI-SHEET ── */}
      <SpotMiniSheet pin={sheetPin} onClose={closeSheet} />

      {/* Radius sheet */}
      {radiusMode && (
        <RadiusSheet
          radiusKm={radiusKm} center={radiusCenter} spots={spotsInRadius}
          onSetRadius={setRadiusKm} onUseGPS={handleUseGPS} onClose={closeRadiusMode}
          onSpotClick={openSheet} gpsLoading={gpsLoading}
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

const FAVS_KEY   = 'cmaps_favs_v1';
const ratingKey  = (id: string) => `cmaps_rating_${id}`;

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
  spots, activeId, onActivate, onSpotClick,
}: {
  spots:      SpotMapPin[];
  activeId:   string | null;
  onActivate: (id: string) => void;
  onSpotClick:(pin: SpotMapPin) => void;
}) {
  const [favs,    setFavs]    = useState<Record<string, boolean>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});

  useEffect(() => {
    const f: Record<string, boolean> = {};
    const r: Record<string, number>  = {};
    spots.forEach(s => { f[s.id] = isFav(s.id); r[s.id] = getMyRating(s.id); });
    setFavs(f); setRatings(r);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots.length]);

  const cardRefs = useRef<Map<string, Element>>(new Map());
  const ioRef    = useRef<IntersectionObserver | null>(null);

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
      { rootMargin: '-10% 0px -55% 0px', threshold: 0 }
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

  const openNavDirect = (e: React.MouseEvent, pin: SpotMapPin) => {
    e.stopPropagation();
    const url = `https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lon}`;
    window.open(url, '_blank');
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
    <div>
      <div style={{
        padding: '7px 14px 5px',
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        {spots.length} spot
      </div>

      {spots.map((spot, idx) => {
        const tipo   = TIPI_SPOT[spot.type];
        const cond   = CONDIZIONI[spot.condition];
        const isAct  = activeId === spot.id;
        const myFav  = favs[spot.id]    ?? false;
        const myRate = ratings[spot.id] ?? 0;
        const isLast = idx === spots.length - 1;

        return (
          <div
            key={spot.id}
            ref={(el) => setRef(spot.id, el)}
            data-spot-id={spot.id}
            onClick={() => onSpotClick(spot)}
            style={{
              position: 'relative',
              borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
              borderLeft: `3px solid ${isAct ? 'var(--orange)' : 'transparent'}`,
              transition: 'border-color 0.25s, background 0.15s',
              cursor: 'pointer',
              background: isAct ? 'rgba(255,106,0,0.04)' : 'transparent',
            }}
            onMouseEnter={e => { if (!isAct) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
            onMouseLeave={e => { if (!isAct) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <div style={{ display: 'flex', gap: 10, padding: '11px 44px 11px 10px' }}>

              {/* Foto con effetto VHS se attiva */}
              <div style={{
                width: 76, height: 76, flexShrink: 0,
                borderRadius: 4, overflow: 'hidden',
                background: 'var(--gray-700)', position: 'relative',
                boxShadow: isAct ? '0 0 0 2px var(--orange), 0 0 12px rgba(255,106,0,0.3)' : 'none',
                transition: 'box-shadow 0.25s',
              }}>
                {spot.cover_url ? (
                  <img
                    src={spot.cover_url}
                    alt={spot.name}
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

                {/* Scanlines VHS — solo sulla card attiva */}
                {isAct && (
                  <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px)',
                    mixBlendMode: 'multiply',
                  }} />
                )}

                {/* Label VHS REC — solo attiva */}
                {isAct && (
                  <div style={{
                    position: 'absolute', top: 3, left: 3,
                    background: 'var(--orange)', color: '#000',
                    fontFamily: 'var(--font-mono)', fontSize: 7,
                    padding: '1px 4px', borderRadius: 1, letterSpacing: '0.06em',
                    fontWeight: 700,
                  }}>
                    ● REC
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center' }}>

                {/* Nome */}
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
                  color: isAct ? 'var(--orange)' : 'var(--bone)', lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                  transition: 'color 0.25s',
                }}>
                  {spot.name}
                </div>

                {/* Badges */}
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
                      padding: '2px 5px', borderRadius: 2,
                      textTransform: 'uppercase', letterSpacing: '0.04em',
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

                {/* Rating utente (solo se valorizzato) */}
                {myRate > 0 && (
                  <div style={{ display: 'flex', gap: 1 }}>
                    {[1,2,3,4,5].map(i => (
                      <span key={i} style={{ fontSize: 9, color: i <= myRate ? '#fbbf24' : 'var(--gray-600)' }}>★</span>
                    ))}
                  </div>
                )}

                {/* Città + username */}
                {(spot.city || spot.submitted_by_username) && (
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: 'var(--gray-500)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {[spot.city, spot.submitted_by_username ? `@${spot.submitted_by_username}` : null].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            </div>

            {/* Bottone preferiti */}
            <button onClick={e => handleFav(e, spot.id)} style={{
              position: 'absolute', top: 10, right: 8,
              background: myFav ? 'rgba(255,60,60,0.15)' : 'rgba(20,20,20,0.7)',
              border: myFav ? '1px solid rgba(255,60,60,0.4)' : '1px solid rgba(255,255,255,0.07)',
              borderRadius: '50%', width: 26, height: 26,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 11, padding: 0,
            }} aria-label="Preferiti">
              {myFav ? '❤️' : '🤍'}
            </button>

            {/* Bottone navigazione rapida */}
            <button onClick={e => openNavDirect(e, spot)} style={{
              position: 'absolute', bottom: 10, right: 8,
              background: 'rgba(20,20,20,0.7)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '50%', width: 26, height: 26,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 13, padding: 0,
            }} title="Portami qui" aria-label="Portami qui">
              📍
            </button>
          </div>
        );
      })}

      <div style={{ height: 48 }} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   MINI-SHEET — pannello compatto, sempre visibili gli altri spot
   Struttura:
     [header: nome + ❤ + ✕]
     [foto scroll orizzontale]
     [meta: dot + badge + città]
     [descrizione]
     [stelline voto]
     [azioni: portami lì + vedi pagina]
════════════════════════════════════════════════════════ */

function SpotMiniSheet({ pin, onClose }: { pin: SpotMapPin | null; onClose: () => void }) {
  const [spot,     setSpot]     = useState<Spot | null>(null);
  const [navOpen,  setNavOpen]  = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myFav,    setMyFav]    = useState(false);
  const [selPhoto, setSelPhoto] = useState(0);

  const isOpen = !!pin;

  useEffect(() => {
    if (!pin) { setSpot(null); setNavOpen(false); setSelPhoto(0); return; }
    setMyRating(getMyRating(pin.id));
    setMyFav(isFav(pin.id));
    setSelPhoto(0);
    fetch(`/api/spots/${pin.slug}`)
      .then(r => r.json())
      .then(d => setSpot(d.data ?? null))
      .catch(() => setSpot(null));
  }, [pin?.slug]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* Swipe-down to close */
  const startY = useRef(0);

  const tipo = pin ? TIPI_SPOT[pin.type] : null;
  const cond = pin ? CONDIZIONI[pin.condition] : null;

  const photos: string[] = spot
    ? [...(spot.spot_photos ?? [])].sort((a, b) => a.position - b.position).map(p => p.url)
    : (pin?.cover_url ? [pin.cover_url] : []);

  const googleUrl = pin ? `https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lon}` : '';
  const appleMaps = pin ? `http://maps.apple.com/?daddr=${pin.lat},${pin.lon}` : '';
  const wazeUrl   = pin ? `https://waze.com/ul?ll=${pin.lat},${pin.lon}&navigate=yes` : '';
  const openNav   = (url: string) => { window.open(url, '_blank'); setNavOpen(false); };

  const handleRate = (r: number) => {
    if (!pin) return;
    localStorage.setItem(`cmaps_rating_${pin.id}`, String(r));
    setMyRating(r);
  };
  const handleFav = () => {
    if (!pin) return;
    const added = toggleFav(pin.id);
    setMyFav(added);
  };

  return (
    <div
      onTouchStart={e => { startY.current = e.touches[0].clientY; }}
      onTouchEnd={e => { if (e.changedTouches[0].clientY - startY.current > 55) onClose(); }}
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        /* altezza compatta: vedi gli altri spot sopra */
        maxHeight: 'min(320px, 46dvh)',
        transform: isOpen ? 'translateY(0)' : 'translateY(110%)',
        transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
        background: '#0e0e0e',
        borderTop: '2px solid var(--orange)',
        borderRadius: '14px 14px 0 0',
        zIndex: 45,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 -12px 48px rgba(0,0,0,0.7)',
        overflow: 'hidden',
      }}
    >
      {/* ── HEADER ── sempre visibile, X sempre accessibile */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px 8px',
        flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Drag handle */}
        <div style={{ width: 32, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />

        {/* Tipo badge */}
        {tipo && (
          <span style={{
            color: tipo.color, fontFamily: 'var(--font-mono)', fontSize: 10,
            padding: '2px 6px', borderRadius: 2,
            border: `1px solid ${tipo.color}55`,
            textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0,
          }}>
            {tipo.emoji} {tipo.label}
          </span>
        )}

        {/* Nome */}
        <div style={{
          flex: 1, minWidth: 0,
          fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
          color: 'var(--bone)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {pin?.name}
        </div>

        {/* Preferiti */}
        <button onClick={handleFav} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 16, padding: '2px 4px', flexShrink: 0,
          color: myFav ? '#ff4d4d' : 'var(--gray-500)',
        }} aria-label="Preferiti">
          {myFav ? '❤️' : '🤍'}
        </button>

        {/* CHIUDI — sempre visibile */}
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '50%', width: 28, height: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 13, color: 'var(--bone)',
          flexShrink: 0, padding: 0,
        }} aria-label="Chiudi">✕</button>
      </div>

      {/* ── BODY scrollabile ── */}
      <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}>

        {/* Foto — swipeable con frecce */}
        {photos.length > 0 && (
          <SheetPhotoViewer photos={photos} idx={selPhoto} onIdx={setSelPhoto} />
        )}

        {/* Meta + info */}
        <div style={{ padding: '4px 12px 16px' }}>

          {/* Condizione + città + user */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {pin?.condition === 'alive' ? (
              <span style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                background: '#00c851', boxShadow: '0 0 5px #00c851aa', flexShrink: 0,
              }} />
            ) : cond ? (
              <span style={{
                background: cond.bg, color: cond.color,
                fontFamily: 'var(--font-mono)', fontSize: 9,
                padding: '2px 5px', borderRadius: 2, textTransform: 'uppercase',
              }}>{cond.label}</span>
            ) : null}

            {(pin?.city || pin?.submitted_by_username) && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)' }}>
                {[pin.city, pin.submitted_by_username ? `@${pin.submitted_by_username}` : null].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>

          {/* Descrizione */}
          {spot?.description && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)',
              lineHeight: 1.55, marginBottom: 8,
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const,
              overflow: 'hidden',
            }}>
              {spot.description}
            </div>
          )}

          {/* Stelline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 12 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Voto
            </span>
            {[1,2,3,4,5].map(i => (
              <button key={i} onClick={() => handleRate(i)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 16, padding: 0, lineHeight: 1,
                color: i <= myRating ? '#fbbf24' : 'var(--gray-700)',
                transition: 'color 0.1s',
              }}>★</button>
            ))}
          </div>

          {/* Azioni — solo link pagina completa, sottile */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Nav rapida — non invasiva */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setNavOpen(o => !o)} style={{
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                📍 Nav
              </button>
              {navOpen && (
                <div style={{
                  position: 'absolute', bottom: 'calc(100% + 6px)', left: 0,
                  background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, overflow: 'hidden', zIndex: 10,
                  boxShadow: '0 -6px 20px rgba(0,0,0,0.6)', whiteSpace: 'nowrap',
                }}>
                  {[['Google Maps', googleUrl], ['Apple Maps', appleMaps], ['Waze', wazeUrl]].map(([label, url], i) => (
                    <button key={label} onClick={() => openNav(url)} style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '10px 14px',
                      fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)',
                      background: 'none', border: 'none',
                      borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,106,0,0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >{label}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Vedi pagina — link principale */}
            {pin && (
              <Link href={`/map/spot/${pin.slug}`} style={{
                flex: 1, padding: '8px 0',
                background: 'var(--orange)', color: '#000',
                border: 'none', borderRadius: 6,
                fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                textDecoration: 'none', letterSpacing: '0.04em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}>
                Vedi spot completo →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   SHEET PHOTO VIEWER — foto swipeable con frecce nel mini-sheet
════════════════════════════════════════════════════════ */
function SheetPhotoViewer({
  photos, idx, onIdx,
}: { photos: string[]; idx: number; onIdx: (i: number) => void }) {
  const startX = useRef(0);
  const prev = () => onIdx((idx - 1 + photos.length) % photos.length);
  const next = () => onIdx((idx + 1) % photos.length);

  return (
    <div
      style={{ position: 'relative', background: '#111' }}
      onTouchStart={e => { startX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        const dx = e.changedTouches[0].clientX - startX.current;
        if (Math.abs(dx) > 36) dx < 0 ? next() : prev();
      }}
    >
      <img
        key={idx}
        src={photos[idx]}
        alt=""
        style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }}
      />
      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.1) 3px,rgba(0,0,0,0.1) 5px)',
      }} />
      {/* Frecce — solo se più di una foto */}
      {photos.length > 1 && (
        <>
          <button onClick={prev} style={miniArrow('left')}>‹</button>
          <button onClick={next} style={miniArrow('right')}>›</button>
          {/* Counter */}
          <div style={{
            position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.6)', borderRadius: 10,
            padding: '2px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#fff',
          }}>
            {idx + 1}/{photos.length}
          </div>
        </>
      )}
    </div>
  );
}

function miniArrow(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', top: '50%', [side]: 6,
    transform: 'translateY(-50%)',
    background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '50%', width: 28, height: 28,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 18, cursor: 'pointer', padding: 0,
    fontFamily: 'serif', lineHeight: 1,
  };
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
