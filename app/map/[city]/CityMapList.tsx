'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useRef, useEffect } from 'react';
import type { Spot, SpotMapPin } from '@/lib/types';
import { TIPI_SPOT, CONDIZIONI } from '@/lib/constants';
import Link from 'next/link';

/* ── localStorage utils (condivisi con SpotSheet) ── */
const FAVS_KEY  = 'cmaps_favs_v1';
const ratingKey = (id: string) => `cmaps_rating_${id}`;
function isFav(id: string): boolean {
  try { return (JSON.parse(localStorage.getItem(FAVS_KEY) ?? '[]') as string[]).includes(id); } catch { return false; }
}
function toggleFav(id: string): boolean {
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
function saveRating(id: string, r: number): void {
  try { localStorage.setItem(ratingKey(id), String(r)); } catch {}
}

/* ── Mini SpotMap per la city page (no strip, no radius, no filter) ── */
const CityMap = dynamic(() => import('./CityMapInner'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', background: 'var(--gray-800)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-mono)', color: 'var(--orange)', fontSize: 14 }}>
      CARICAMENTO MAPPA...
    </div>
  ),
});

interface Props {
  spots:     Spot[];
  cityLabel: string;
  city:      string;
}

export default function CityMapList({ spots, cityLabel, city }: Props) {
  const [flyTarget,     setFlyTarget]     = useState<{ lat: number; lon: number; zoom?: number } | null>(null);
  const [activeIdx,     setActiveIdx]     = useState<number | null>(null);
  const [favs,          setFavs]          = useState<Record<string, boolean>>({});
  const [ratings,       setRatings]       = useState<Record<string, number>>({});
  const [hoverStar,     setHoverStar]     = useState<{ id: string; star: number } | null>(null);
  const listRef         = useRef<HTMLDivElement>(null);
  const cardRefs        = useRef<(HTMLDivElement | null)[]>([]);

  /* Carica preferiti e rating da localStorage al mount */
  useEffect(() => {
    const f: Record<string, boolean> = {};
    const r: Record<string, number>  = {};
    spots.forEach(s => { f[s.id] = isFav(s.id); r[s.id] = getMyRating(s.id); });
    setFavs(f); setRatings(r);
  }, [spots]);

  /* Centra la mappa sul primo spot all'avvio */
  useEffect(() => {
    if (spots.length > 0) {
      const avgLat = spots.reduce((s, p) => s + p.lat, 0) / spots.length;
      const avgLon = spots.reduce((s, p) => s + p.lon, 0) / spots.length;
      setFlyTarget({ lat: avgLat, lon: avgLon, zoom: 14 });
    }
  }, [spots]);

  const pins: SpotMapPin[] = spots.map(s => ({
    id: s.id, slug: s.slug, name: s.name, type: s.type,
    lat: s.lat, lon: s.lon, city: s.city, condition: s.condition,
    cover_url: (s.spot_photos ?? [])[0]?.url,
  }));

  const handlePinClick = useCallback((pin: SpotMapPin) => {
    const idx = spots.findIndex(s => s.id === pin.id);
    setActiveIdx(idx);
    // Scroll alla card
    cardRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [spots]);

  const handleCardHover = (idx: number) => {
    const s = spots[idx];
    setFlyTarget({ lat: s.lat, lon: s.lon, zoom: 16 });
    setActiveIdx(idx);
  };

  const handleFav = (id: string) => {
    const added = toggleFav(id);
    setFavs(prev => ({ ...prev, [id]: added }));
  };

  const handleRating = (id: string, r: number) => {
    const next = r === ratings[id] ? 0 : r;
    saveRating(id, next);
    setRatings(prev => ({ ...prev, [id]: next }));
  };

  if (spots.length === 0) return null;

  return (
    <div>
      {/* ── MAPPA ── sticky top, 300px */}
      <div style={{
        position: 'sticky', top: 'var(--topbar-height, 56px)',
        height: 300, zIndex: 10,
        borderBottom: '2px solid var(--orange)',
        background: 'var(--gray-800)',
      }}>
        <CityMap
          spots={pins}
          activeId={activeIdx !== null ? spots[activeIdx]?.id : null}
          flyTarget={flyTarget}
          onPinClick={handlePinClick}
        />
      </div>

      {/* ── LISTA SPOT ── */}
      <div ref={listRef} style={{ padding: '16px 16px 24px' }}>
        {spots.map((spot, idx) => {
          const photos  = (spot.spot_photos ?? []).slice().sort((a, b) => a.position - b.position);
          const cover   = photos[0]?.url;
          const tipo    = TIPI_SPOT[spot.type];
          const cond    = CONDIZIONI[spot.condition];
          const isActive = idx === activeIdx;
          const myRating = ratings[spot.id] ?? 0;
          const myFav    = favs[spot.id] ?? false;

          return (
            <div
              key={spot.id}
              ref={el => { cardRefs.current[idx] = el; }}
              onMouseEnter={() => handleCardHover(idx)}
              style={{
                marginBottom: 16,
                background: 'var(--gray-800)',
                border: `1px solid ${isActive ? 'var(--orange)' : 'var(--gray-700)'}`,
                borderRadius: 10, overflow: 'hidden',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxShadow: isActive ? '0 0 0 1px var(--orange)' : 'none',
                scrollMarginTop: 'calc(var(--topbar-height, 56px) + 316px)',
              }}
            >
              {/* Foto */}
              {cover ? (
                <div style={{ height: 200, overflow: 'hidden', position: 'relative' }}>
                  <img src={cover} alt={spot.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <div style={{ position: 'absolute', top: 8, left: 8,
                    background: cond.bg, color: cond.color,
                    fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 7px', borderRadius: 2,
                    textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {cond.label}
                  </div>
                  {photos.length > 1 && (
                    <div style={{ position: 'absolute', top: 8, right: 8,
                      background: 'rgba(0,0,0,0.6)', borderRadius: 10, padding: '2px 7px',
                      fontFamily: 'var(--font-mono)', fontSize: 10, color: '#fff' }}>
                      +{photos.length - 1} 📷
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ height: 60, background: 'var(--gray-700)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
                  {tipo.emoji}
                </div>
              )}

              {/* Contenuto */}
              <div style={{ padding: '12px 14px' }}>
                {/* Titolo + tipo */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Link href={`/map/spot/${spot.slug}`} style={{ textDecoration: 'none', flex: 1, marginRight: 8 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--orange)', lineHeight: 1.2 }}>
                      {spot.name}
                    </div>
                  </Link>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: tipo.color,
                    border: `1px solid ${tipo.color}`, padding: '2px 6px', borderRadius: 2, flexShrink: 0 }}>
                    {tipo.emoji} {tipo.label}
                  </span>
                </div>

                {/* Stelle + preferiti */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star}
                        onClick={() => handleRating(spot.id, star)}
                        onMouseEnter={() => setHoverStar({ id: spot.id, star })}
                        onMouseLeave={() => setHoverStar(null)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '1px', fontSize: 18, lineHeight: 1,
                          color: star <= ((hoverStar?.id === spot.id ? hoverStar.star : 0) || myRating)
                            ? '#ffce4d' : 'var(--gray-600)',
                          transition: 'color 0.1s',
                        }}>★</button>
                    ))}
                    {myRating > 0 && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', marginLeft: 3 }}>
                        {myRating}/5
                      </span>
                    )}
                  </div>
                  <button onClick={() => handleFav(spot.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 18, padding: '2px', lineHeight: 1,
                  }} aria-label={myFav ? 'Rimuovi' : 'Salva'}>
                    {myFav ? '❤️' : '🤍'}
                  </button>
                </div>

                {/* Descrizione */}
                {spot.description && (
                  <p className="truncate-2" style={{ color: 'var(--gray-400)', fontSize: 13, lineHeight: 1.45, margin: '0 0 8px' }}>
                    {spot.description}
                  </p>
                )}

                {/* Footer: @username + link */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {spot.submitted_by_username && (
                    <a href={`/u/${spot.submitted_by_username}`} style={{
                      fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textDecoration: 'none',
                    }}>
                      @{spot.submitted_by_username}
                    </a>
                  )}
                  <Link href={`/map/spot/${spot.slug}`} style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)',
                    textDecoration: 'none', marginLeft: 'auto',
                  }}>
                    Dettagli →
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
