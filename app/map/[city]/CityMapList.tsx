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

/* ── Mini mappa Leaflet ── */
function CityMiniMap({
  spots, activeId, fillHeight = false,
}: {
  spots: Spot[];
  activeId: string | null;
  fillHeight?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<import('leaflet').Map | null>(null);
  const markersRef   = useRef<Map<string, import('leaflet').CircleMarker>>(new Map());
  const flyTimeout   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: false, attributionControl: false,
        dragging: true, scrollWheelZoom: true,
        doubleClickZoom: true, touchZoom: true, keyboard: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18, className: 'osm-tiles',
      }).addTo(map);

      mapRef.current = map;

      spots.forEach((spot) => {
        const m = L.circleMarker([spot.lat, spot.lon], {
          radius: 7, fillColor: PALETTE.orange,
          color: PALETTE.black, weight: 1.5, fillOpacity: 0.75,
        }).addTo(map);
        markersRef.current.set(spot.id, m);
      });

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => {
      m.setStyle({ fillColor: PALETTE.orange, fillOpacity: 0.75, radius: 7 });
    });

    if (activeId) {
      const active = markersRef.current.get(activeId);
      if (active) {
        active.setStyle({ fillColor: '#ffffff', fillOpacity: 1, radius: 12 });
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
      position: 'relative',
      width: '100%', height: '100%',
      background: 'var(--gray-800)',
      borderBottom: fillHeight ? 'none' : '2px solid var(--orange)',
      borderLeft: fillHeight ? '2px solid var(--orange)' : 'none',
    }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {activeName && (
        <div style={{
          position: 'absolute', bottom: 10, left: 10, pointerEvents: 'none',
          background: 'rgba(10,10,10,0.86)', borderRadius: 4, padding: '4px 10px',
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          backdropFilter: 'blur(4px)', maxWidth: '80%',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {activeName}
        </div>
      )}

      <div style={{
        position: 'absolute', top: 10, right: 10, pointerEvents: 'none',
        background: 'rgba(10,10,10,0.65)', borderRadius: 3, padding: '2px 7px',
        fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--gray-400)',
        textTransform: 'uppercase', letterSpacing: '0.07em',
      }}>
        {spots.length} pin
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
  const [favs,     setFavs]     = useState<Record<string, boolean>>({});
  const [ratings,  setRatings]  = useState<Record<string, number>>({});
  const [activeId, setActiveId] = useState<string | null>(spots[0]?.id ?? null);
  const [isWide,   setIsWide]   = useState(false);

  const cardRefs = useRef<Map<string, Element>>(new Map());
  const ioRef    = useRef<IntersectionObserver | null>(null);

  /* Detect viewport width (desktop vs mobile) */
  useEffect(() => {
    const check = () => setIsWide(window.innerWidth >= 720);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  /* Carica preferiti e rating */
  useEffect(() => {
    const f: Record<string, boolean> = {};
    const r: Record<string, number>  = {};
    spots.forEach(s => { f[s.id] = isFav(s.id); r[s.id] = getMyRating(s.id); });
    setFavs(f); setRatings(r);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots.length]);

  /* IntersectionObserver: attiva il pin sulla mappa mentre scrolli */
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
      { rootMargin: isWide ? '-20% 0px -50% 0px' : '-30% 0px -45% 0px', threshold: 0 }
    );
    cardRefs.current.forEach(el => ioRef.current!.observe(el));
    return () => ioRef.current?.disconnect();
  }, [spots, isWide]);

  const setCardRef = useCallback((id: string, el: Element | null) => {
    if (el) { cardRefs.current.set(id, el); ioRef.current?.observe(el); }
    else    { cardRefs.current.delete(id); }
  }, []);

  const handleFav = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation();
    const added = toggleFav(id);
    setFavs(prev => ({ ...prev, [id]: added }));
  };

  if (spots.length === 0) return null;

  /* ─── DESKTOP: lista sinistra + mappa sticky destra ─── */
  if (isWide) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', minHeight: '100dvh' }}>

        {/* Lista spot (scroll della pagina) */}
        <div style={{ flex: 1, minWidth: 0, padding: '20px 24px 60px' }}>

          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)',
            textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 18,
          }}>
            {spots.length} spot a {cityLabel}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {spots.map((spot, idx) => (
              <SpotRow
                key={spot.id}
                spot={spot}
                isActive={activeId === spot.id}
                myFav={favs[spot.id] ?? false}
                myRating={ratings[spot.id] ?? 0}
                isLast={idx === spots.length - 1}
                onFav={handleFav}
                setRef={(el) => setCardRef(spot.id, el)}
              />
            ))}
          </div>
        </div>

        {/* Mappa sticky destra */}
        <div style={{
          width: 380, flexShrink: 0,
          position: 'sticky', top: 0,
          height: '100dvh', overflow: 'hidden',
        }}>
          <CityMiniMap spots={spots} activeId={activeId} fillHeight />
        </div>
      </div>
    );
  }

  /* ─── MOBILE: mappa in cima sticky + lista sotto ─── */
  return (
    <div>
      {/* Mappa sticky in alto */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, height: 200, overflow: 'hidden' }}>
        <CityMiniMap spots={spots} activeId={activeId} fillHeight={false} />
      </div>

      {/* Lista spot */}
      <div style={{ padding: '14px 16px 48px' }}>

        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)',
          textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14,
        }}>
          {spots.length} spot a {cityLabel}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {spots.map((spot, idx) => (
            <SpotRow
              key={spot.id}
              spot={spot}
              isActive={activeId === spot.id}
              myFav={favs[spot.id] ?? false}
              myRating={ratings[spot.id] ?? 0}
              isLast={idx === spots.length - 1}
              onFav={handleFav}
              setRef={(el) => setCardRef(spot.id, el)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Singolo annuncio (riga orizzontale, stile subito.it) ── */
function SpotRow({
  spot, isActive, myFav, myRating, isLast, onFav, setRef,
}: {
  spot:     Spot;
  isActive: boolean;
  myFav:    boolean;
  myRating: number;
  isLast:   boolean;
  onFav:    (e: React.MouseEvent, id: string) => void;
  setRef:   (el: Element | null) => void;
}) {
  const photos = (spot.spot_photos ?? []).slice().sort((a, b) => a.position - b.position);
  const cover  = photos[0]?.url;
  const tipo   = TIPI_SPOT[spot.type];
  const cond   = CONDIZIONI[spot.condition];

  return (
    <div
      ref={(el) => setRef(el)}
      data-spot-id={spot.id}
      style={{
        position: 'relative',
        borderBottom: isLast ? 'none' : '1px solid var(--gray-700)',
        borderLeft: `3px solid ${isActive ? 'var(--orange)' : 'transparent'}`,
        transition: 'border-color 0.2s',
        paddingLeft: 10,
      }}
    >
      <Link href={`/map/spot/${spot.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
        <div
          style={{
            display: 'flex', gap: 12, padding: '14px 0', paddingRight: 40,
            cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >

          {/* Foto quadrata sinistra */}
          <div style={{
            width: 90, height: 90, flexShrink: 0,
            borderRadius: 6, overflow: 'hidden',
            background: 'var(--gray-700)',
            position: 'relative',
          }}>
            {cover ? (
              <img
                src={cover}
                alt={spot.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                loading="lazy"
              />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, opacity: 0.4,
              }}>
                {tipo.emoji}
              </div>
            )}
            {/* Numero foto */}
            {photos.length > 1 && (
              <div style={{
                position: 'absolute', bottom: 4, right: 4,
                background: 'rgba(0,0,0,0.7)', borderRadius: 3,
                fontFamily: 'var(--font-mono)', fontSize: 9, color: '#fff',
                padding: '1px 5px',
              }}>
                {photos.length}
              </div>
            )}
          </div>

          {/* Info destra */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5, paddingRight: 4 }}>

            {/* Nome (titolo piccolo in cima) */}
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 14,
              color: 'var(--bone)', lineHeight: 1.3,
              fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as const,
            }}>
              {spot.name}
            </div>

            {/* Badges condizione + tipo */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <span style={{
                background: cond.bg, color: cond.color,
                fontFamily: 'var(--font-mono)', fontSize: 9,
                padding: '2px 6px', borderRadius: 3,
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {cond.label}
              </span>
              <span style={{
                color: tipo.color, fontFamily: 'var(--font-mono)', fontSize: 9,
                padding: '2px 6px', borderRadius: 3,
                border: `1px solid ${tipo.color}66`,
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {tipo.label}
              </span>
            </div>

            {/* Città + username */}
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--gray-500)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {[spot.city, spot.submitted_by_username ? `@${spot.submitted_by_username}` : null]
                .filter(Boolean).join(' · ')}
            </div>

            {/* Descrizione (1 riga troncata) */}
            {spot.description && (
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: 'var(--gray-600)', lineHeight: 1.4,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {spot.description}
              </div>
            )}

            {/* Stelline + "Vedi →" */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
              <div style={{ display: 'flex', gap: 1 }}>
                {[1,2,3,4,5].map(s => (
                  <span key={s} style={{ fontSize: 12, color: s <= myRating ? '#ffce4d' : 'var(--gray-700)' }}>★</span>
                ))}
              </div>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: 'var(--orange)', letterSpacing: '0.04em',
              }}>
                Vedi →
              </span>
            </div>
          </div>
        </div>
      </Link>

      {/* Bottone cuore (fuori dal link per evitare navigazione) */}
      <button
        onClick={e => onFav(e, spot.id)}
        style={{
          position: 'absolute', top: 14, right: 4,
          background: myFav ? 'rgba(255,60,60,0.15)' : 'rgba(10,10,10,0.6)',
          border: myFav ? '1px solid rgba(255,60,60,0.4)' : '1px solid var(--gray-600)',
          borderRadius: '50%', width: 30, height: 30,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 14, padding: 0,
          transition: 'transform 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.2)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        aria-label={myFav ? 'Rimuovi dai preferiti' : 'Salva nei preferiti'}
      >
        {myFav ? '❤️' : '🤍'}
      </button>
    </div>
  );
}
