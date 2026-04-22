'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Spot } from '@/lib/types';
import { TIPI_SPOT, CONDIZIONI } from '@/lib/constants';

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
function saveRating(id: string, r: number): void {
  try { localStorage.setItem(ratingKey(id), String(r)); } catch {}
}

interface Props {
  spots:     Spot[];
  cityLabel: string;
  city:      string;
}

export default function CityMapList({ spots, cityLabel }: Props) {
  const [favs,      setFavs]      = useState<Record<string, boolean>>({});
  const [ratings,   setRatings]   = useState<Record<string, number>>({});
  const [hoverStar, setHoverStar] = useState<{ id: string; star: number } | null>(null);

  useEffect(() => {
    const f: Record<string, boolean> = {};
    const r: Record<string, number>  = {};
    spots.forEach(s => { f[s.id] = isFav(s.id); r[s.id] = getMyRating(s.id); });
    setFavs(f); setRatings(r);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots.length]); // dipendenza sulla lunghezza, non sul riferimento dell'array

  const handleFav = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation();
    const added = toggleFav(id);
    setFavs(prev => ({ ...prev, [id]: added }));
  };

  const handleStar = (e: React.MouseEvent, id: string, star: number) => {
    e.preventDefault(); e.stopPropagation();
    const next = star === ratings[id] ? 0 : star;
    saveRating(id, next);
    setRatings(prev => ({ ...prev, [id]: next }));
  };

  if (spots.length === 0) return null;

  return (
    <div style={{ padding: '12px 12px 32px' }}>

      {/* Header contatore */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)',
        textTransform: 'uppercase', letterSpacing: '0.07em',
        marginBottom: 14, paddingLeft: 2,
      }}>
        {spots.length} spot verificati a {cityLabel}
      </div>

      {/* Grid 2 colonne */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 10,
      }}>
        {spots.map((spot) => {
          const photos   = (spot.spot_photos ?? []).slice().sort((a, b) => a.position - b.position);
          const cover    = photos[0]?.url;
          const tipo     = TIPI_SPOT[spot.type];
          const cond     = CONDIZIONI[spot.condition];
          const myRating = ratings[spot.id] ?? 0;
          const myFav    = favs[spot.id] ?? false;

          return (
            <div key={spot.id} style={{ position: 'relative' }}>
              <Link
                href={`/map/spot/${spot.slug}`}
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <div style={{
                  background: 'var(--gray-800)',
                  border: '1px solid var(--gray-700)',
                  borderRadius: 8,
                  overflow: 'hidden',
                  transition: 'border-color 0.15s, transform 0.1s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--orange)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--gray-700)';
                  (e.currentTarget as HTMLElement).style.transform = 'none';
                }}
                >
                  {/* Foto */}
                  <div style={{ position: 'relative', aspectRatio: '4/3', overflow: 'hidden', background: 'var(--gray-700)' }}>
                    {cover ? (
                      <img
                        src={cover}
                        alt={`${spot.name} — spot ${tipo.label} a ${cityLabel}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        loading="lazy"
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
                        {tipo.emoji}
                      </div>
                    )}

                    {/* Condition badge top-left */}
                    <div style={{
                      position: 'absolute', top: 6, left: 6,
                      background: cond.bg, color: cond.color,
                      fontFamily: 'var(--font-mono)', fontSize: 9,
                      padding: '2px 5px', borderRadius: 2, textTransform: 'uppercase',
                      letterSpacing: '0.05em', lineHeight: 1.4,
                    }}>
                      {cond.label}
                    </div>

                    {/* Numero foto top-right */}
                    {photos.length > 1 && (
                      <div style={{
                        position: 'absolute', top: 6, right: 6,
                        background: 'rgba(0,0,0,0.65)', borderRadius: 10,
                        padding: '2px 6px', fontSize: 9, color: '#fff',
                        fontFamily: 'var(--font-mono)',
                      }}>
                        📷 {photos.length}
                      </div>
                    )}
                  </div>

                  {/* Info strip */}
                  <div style={{ padding: '8px 9px 10px' }}>
                    {/* Tipo */}
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10,
                      color: tipo.color, marginBottom: 4,
                      display: 'flex', alignItems: 'center', gap: 3,
                    }}>
                      <span>{tipo.emoji}</span>
                      <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>{tipo.label}</span>
                    </div>

                    {/* Titolo */}
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 14,
                      color: 'var(--orange)', lineHeight: 1.2,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                      marginBottom: 7,
                    }}>
                      {spot.name}
                    </div>

                    {/* Stelle (non-interactive preview) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          onClick={e => handleStar(e, spot.id, star)}
                          onMouseEnter={() => setHoverStar({ id: spot.id, star })}
                          onMouseLeave={() => setHoverStar(null)}
                          style={{
                            background: 'none', border: 'none', padding: '1px 0',
                            cursor: 'pointer', fontSize: 13, lineHeight: 1,
                            color: star <= ((hoverStar?.id === spot.id ? hoverStar.star : 0) || myRating)
                              ? '#ffce4d' : 'var(--gray-600)',
                            transition: 'color 0.1s',
                          }}
                        >★</button>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>

              {/* Favoriti (fuori dal Link per evitare navigazione) */}
              <button
                onClick={e => handleFav(e, spot.id)}
                style={{
                  position: 'absolute', bottom: 38, right: 7,
                  background: 'rgba(10,10,10,0.7)', border: 'none',
                  borderRadius: '50%', width: 26, height: 26,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 13, padding: 0,
                  backdropFilter: 'blur(4px)',
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
        })}
      </div>
    </div>
  );
}
