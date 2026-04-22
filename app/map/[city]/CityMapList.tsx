'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { Spot } from '@/lib/types';
import { TIPI_SPOT, CONDIZIONI, PALETTE } from '@/lib/constants';

/* ── localStorage utils ── */
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

/* ── Mini mappa Leaflet sticky ── */
function CityMiniMap({ spots, activeId }: { spots: Spot[]; activeId: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<import('leaflet').Map | null>(null);
  const markersRef   = useRef<Map<string, import('leaflet').CircleMarker>>(new Map());
  const flyTimeout   = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Init mappa (una volta sola) */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl:      false,
        attributionControl: false,
        dragging:         true,
        scrollWheelZoom:  false,
        doubleClickZoom:  false,
        touchZoom:        true,
        keyboard:         false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18, className: 'osm-tiles',
      }).addTo(map);

      mapRef.current = map;

      /* Aggiungi tutti i pin come cerchi */
      spots.forEach((spot) => {
        const m = L.circleMarker([spot.lat, spot.lon], {
          radius:      6,
          fillColor:   PALETTE.orange,
          color:       PALETTE.black,
          weight:      1.5,
          fillOpacity: 0.65,
        }).addTo(map);
        markersRef.current.set(spot.id, m);
      });

      /* Adatta vista a tutti gli spot */
      if (spots.length === 1) {
        map.setView([spots[0].lat, spots[0].lon], 14);
      } else if (spots.length > 1) {
        const bounds = L.latLngBounds(spots.map(s => [s.lat, s.lon] as [number, number]));
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
      }
    });

    return () => {
      cancelled = true;
      if (flyTimeout.current) clearTimeout(flyTimeout.current);
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      markersRef.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Reagisci al cambio di spot attivo */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    /* Reset tutti i marker */
    markersRef.current.forEach((m) => {
      m.setStyle({ fillColor: PALETTE.orange, fillOpacity: 0.65, radius: 6 });
    });

    if (activeId) {
      const active = markersRef.current.get(activeId);
      if (active) {
        active.setStyle({ fillColor: '#ffffff', fillOpacity: 1, radius: 11 });
        active.bringToFront();
      }
      const spot = spots.find(s => s.id === activeId);
      if (spot) {
        if (flyTimeout.current) clearTimeout(flyTimeout.current);
        flyTimeout.current = setTimeout(() => {
          map.flyTo([spot.lat, spot.lon], 14, { duration: 0.55, easeLinearity: 0.5 });
        }, 60);
      }
    }

    return () => { if (flyTimeout.current) clearTimeout(flyTimeout.current); };
  }, [activeId, spots]);

  const activeName = activeId ? spots.find(s => s.id === activeId)?.name ?? null : null;

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 20,
      height: 220,
      overflow: 'hidden',
      borderBottom: '2px solid var(--orange)',
      background: 'var(--gray-800)',
    }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Etichetta spot attivo */}
      {activeName && (
        <div style={{
          position: 'absolute', bottom: 8, left: 8, pointerEvents: 'none',
          background: 'rgba(10,10,10,0.86)', borderRadius: 4, padding: '4px 10px',
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '0.06em',
          backdropFilter: 'blur(4px)', maxWidth: '70%',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          📍 {activeName}
        </div>
      )}

      {/* Label "MAPPA" */}
      <div style={{
        position: 'absolute', top: 8, right: 8, pointerEvents: 'none',
        background: 'rgba(10,10,10,0.65)', borderRadius: 3, padding: '2px 7px',
        fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--gray-400)',
        textTransform: 'uppercase', letterSpacing: '0.07em',
      }}>
        MAPPA
      </div>
    </div>
  );
}

interface Props {
  spots:     Spot[];
  cityLabel: string;
  city:      string;
}

export default function CityMapList({ spots, cityLabel }: Props) {
  const [favs,    setFavs]    = useState<Record<string, boolean>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [activeId, setActiveId] = useState<string | null>(spots[0]?.id ?? null);

  const cardRefs = useRef<Map<string, Element>>(new Map());
  const ioRef    = useRef<IntersectionObserver | null>(null);

  /* Carica preferiti e rating da localStorage */
  useEffect(() => {
    const f: Record<string, boolean> = {};
    const r: Record<string, number>  = {};
    spots.forEach(s => { f[s.id] = isFav(s.id); r[s.id] = getMyRating(s.id); });
    setFavs(f); setRatings(r);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots.length]);

  /* IntersectionObserver: aggiorna activeId quando una card entra nella fascia centrale */
  useEffect(() => {
    ioRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset.spotId;
            if (id) setActiveId(id);
            break;
          }
        }
      },
      { rootMargin: '-30% 0px -45% 0px', threshold: 0 }
    );
    cardRefs.current.forEach(el => ioRef.current!.observe(el));
    return () => ioRef.current?.disconnect();
  }, [spots]);

  const setCardRef = useCallback((id: string, el: Element | null) => {
    if (el) {
      cardRefs.current.set(id, el);
      ioRef.current?.observe(el);
    } else {
      cardRefs.current.delete(id);
    }
  }, []);

  const handleFav = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation();
    const added = toggleFav(id);
    setFavs(prev => ({ ...prev, [id]: added }));
  };

  if (spots.length === 0) return null;

  return (
    <div>
      {/* Mini mappa sticky — si aggiorna mentre scrolli */}
      <CityMiniMap spots={spots} activeId={activeId} />

      <div style={{ padding: '12px 16px 40px' }}>

        {/* Contatore */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)',
          textTransform: 'uppercase', letterSpacing: '0.07em',
          marginBottom: 16, paddingLeft: 2,
        }}>
          {spots.length} spot verificati a {cityLabel}
        </div>

        {/* Lista verticale */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {spots.map((spot) => {
            const photos   = (spot.spot_photos ?? []).slice().sort((a, b) => a.position - b.position);
            const cover    = photos[0]?.url;
            const tipo     = TIPI_SPOT[spot.type];
            const cond     = CONDIZIONI[spot.condition];
            const myRating = ratings[spot.id] ?? 0;
            const myFav    = favs[spot.id] ?? false;
            const isActive = activeId === spot.id;

            return (
              <div
                key={spot.id}
                ref={(el) => setCardRef(spot.id, el)}
                data-spot-id={spot.id}
                style={{ position: 'relative' }}
              >
                <Link href={`/map/spot/${spot.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div
                    style={{
                      background: 'var(--gray-800)',
                      border: `1px solid ${isActive ? 'var(--orange)' : 'var(--gray-700)'}`,
                      borderRadius: 10,
                      overflow: 'hidden',
                      transition: 'border-color 0.15s, transform 0.12s, box-shadow 0.15s',
                      boxShadow: isActive ? '0 0 0 2px rgba(255,106,0,0.18)' : 'none',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--orange)';
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = isActive ? 'var(--orange)' : 'var(--gray-700)';
                      (e.currentTarget as HTMLElement).style.transform = 'none';
                    }}
                  >
                    {/* Foto hero 16:9 */}
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden', background: 'var(--gray-700)' }}>
                      {cover ? (
                        <img
                          src={cover}
                          alt={`${spot.name} — spot ${tipo.label} a ${cityLabel}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          loading="lazy"
                        />
                      ) : (
                        <div style={{
                          width: '100%', height: '100%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 52, opacity: 0.4,
                        }}>
                          {tipo.emoji}
                        </div>
                      )}

                      {/* Badges overlay */}
                      <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 }}>
                        <span style={{
                          background: cond.bg, color: cond.color,
                          fontFamily: 'var(--font-mono)', fontSize: 10,
                          padding: '3px 8px', borderRadius: 3,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>● {cond.label}</span>
                        <span style={{
                          background: 'rgba(0,0,0,0.72)', color: tipo.color,
                          fontFamily: 'var(--font-mono)', fontSize: 10,
                          padding: '3px 8px', borderRadius: 3,
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                          border: `1px solid ${tipo.color}55`,
                        }}>
                          {tipo.emoji} {tipo.label}
                        </span>
                      </div>

                      {photos.length > 1 && (
                        <div style={{
                          position: 'absolute', top: 10, right: 10,
                          background: 'rgba(0,0,0,0.65)', borderRadius: 12,
                          padding: '3px 8px', fontSize: 10, color: '#fff',
                          fontFamily: 'var(--font-mono)',
                        }}>📷 {photos.length}</div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ padding: '14px 14px 14px' }}>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: 20,
                        color: 'var(--orange)', lineHeight: 1.2, marginBottom: 6,
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as const,
                      }}>
                        {spot.name}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                        {spot.city && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)' }}>
                            📍 {spot.city}
                          </span>
                        )}
                        {spot.submitted_by_username && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-600)' }}>
                            · da @{spot.submitted_by_username}
                          </span>
                        )}
                      </div>

                      {spot.description && (
                        <p style={{
                          fontFamily: 'var(--font-mono)', fontSize: 12,
                          color: 'var(--gray-500)', lineHeight: 1.5,
                          marginBottom: 10, margin: '0 0 10px',
                          overflow: 'hidden', textOverflow: 'ellipsis',
                          display: '-webkit-box', WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical' as const,
                        }}>
                          {spot.description}
                        </p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                        <div style={{ display: 'flex', gap: 2 }}>
                          {[1,2,3,4,5].map(s => (
                            <span key={s} style={{ fontSize: 14, color: s <= myRating ? '#ffce4d' : 'var(--gray-700)' }}>★</span>
                          ))}
                        </div>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 11,
                          color: 'var(--orange)', letterSpacing: '0.04em',
                        }}>VEDI SPOT →</span>
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Cuore preferiti */}
                <button
                  onClick={e => handleFav(e, spot.id)}
                  style={{
                    position: 'absolute', bottom: 14, right: 14,
                    background: myFav ? 'rgba(255,60,60,0.15)' : 'rgba(10,10,10,0.7)',
                    border: myFav ? '1px solid rgba(255,60,60,0.4)' : '1px solid var(--gray-600)',
                    borderRadius: '50%', width: 34, height: 34,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 16, padding: 0,
                    backdropFilter: 'blur(4px)',
                    transition: 'transform 0.15s, background 0.15s',
                    zIndex: 2,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.2)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  aria-label={myFav ? 'Rimuovi dai preferiti' : 'Salva nei preferiti'}
                >
                  {myFav ? '❤️' : '🤍'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
