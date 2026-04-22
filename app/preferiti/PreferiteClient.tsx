'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TIPI_SPOT, CONDIZIONI } from '@/lib/constants';
import type { Spot } from '@/lib/types';

const FAVS_KEY = 'cmaps_favs_v1';

function getFavIds(): string[] {
  try { return JSON.parse(localStorage.getItem(FAVS_KEY) ?? '[]') as string[]; }
  catch { return []; }
}
function removeFav(id: string): void {
  try {
    const favs = getFavIds().filter(f => f !== id);
    localStorage.setItem(FAVS_KEY, JSON.stringify(favs));
  } catch {}
}

export default function PreferiteClient() {
  const [spots,   setSpots]   = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [ids,     setIds]     = useState<string[]>([]);

  useEffect(() => {
    const favIds = getFavIds();
    setIds(favIds);
    if (favIds.length === 0) { setLoading(false); return; }

    fetch('/api/spots/by-ids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: favIds }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) setSpots(data.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRemove = (id: string) => {
    removeFav(id);
    setSpots(prev => prev.filter(s => s.id !== id));
    setIds(prev => prev.filter(i => i !== id));
  };

  return (
    <main style={{
      background: 'var(--black)',
      minHeight: '100dvh',
      maxWidth: 680,
      margin: '0 auto',
      paddingBottom: 'calc(var(--strip-height, 48px) + 32px)',
    }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 0' }}>
        <Link href="/map" style={{
          color: 'var(--orange)', fontFamily: 'var(--font-mono)',
          fontSize: 13, textDecoration: 'none',
        }}>
          ← TORNA ALLA MAPPA
        </Link>
        <h1 style={{
          fontFamily: 'var(--font-mono)', fontSize: 28,
          color: 'var(--orange)', margin: '16px 0 4px',
        }}>
          ❤️ I miei preferiti
        </h1>
        <p style={{
          fontFamily: 'var(--font-mono)', fontSize: 12,
          color: 'var(--gray-400)', marginBottom: 24,
        }}>
          {ids.length === 0 ? 'Nessuno spot salvato ancora.' : `${ids.length} spot salvati sul tuo dispositivo`}
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{
          padding: '60px 20px', textAlign: 'center',
          fontFamily: 'var(--font-mono)', color: 'var(--gray-400)', fontSize: 13,
        }}>
          Caricamento...
        </div>
      )}

      {/* Empty state */}
      {!loading && ids.length === 0 && (
        <div style={{
          padding: '60px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🤍</div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 16,
            color: 'var(--bone)', marginBottom: 8,
          }}>
            Nessuno spot nei preferiti
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 13,
            color: 'var(--gray-400)', marginBottom: 28, lineHeight: 1.6,
          }}>
            Premi il cuore 🤍 su uno spot<br />per salvarlo qui.
          </div>
          <Link href="/map" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex' }}>
            Esplora la mappa
          </Link>
        </div>
      )}

      {/* Lista preferiti */}
      {!loading && spots.length > 0 && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {spots.map(spot => {
            const photos = (spot.spot_photos ?? []).slice().sort((a, b) => a.position - b.position);
            const cover  = photos[0]?.url;
            const tipo   = TIPI_SPOT[spot.type];
            const cond   = CONDIZIONI[spot.condition];

            return (
              <div key={spot.id} style={{ position: 'relative' }}>
                <Link href={`/map/spot/${spot.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{
                    background: 'var(--gray-800)',
                    border: '1px solid var(--gray-700)',
                    borderRadius: 10, overflow: 'hidden',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--orange)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--gray-700)'}
                  >
                    {/* Foto */}
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden', background: 'var(--gray-700)' }}>
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
                          fontSize: 48, opacity: 0.4,
                        }}>
                          {tipo.emoji}
                        </div>
                      )}
                      {/* Badges */}
                      <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 }}>
                        <span style={{
                          background: cond.bg, color: cond.color,
                          fontFamily: 'var(--font-mono)', fontSize: 10,
                          padding: '3px 8px', borderRadius: 3, textTransform: 'uppercase',
                        }}>● {cond.label}</span>
                        <span style={{
                          background: 'rgba(0,0,0,0.72)', color: tipo.color,
                          fontFamily: 'var(--font-mono)', fontSize: 10,
                          padding: '3px 8px', borderRadius: 3, textTransform: 'uppercase',
                          border: `1px solid ${tipo.color}55`,
                        }}>{tipo.emoji} {tipo.label}</span>
                      </div>
                    </div>

                    {/* Info */}
                    <div style={{ padding: '14px 14px 14px' }}>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: 20,
                        color: 'var(--orange)', lineHeight: 1.2, marginBottom: 6,
                      }}>
                        {spot.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        {spot.city && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)' }}>
                            📍 {spot.city}
                          </span>
                        )}
                        {spot.submitted_by_username && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-600)' }}>
                            · @{spot.submitted_by_username}
                          </span>
                        )}
                      </div>
                      {spot.description && (
                        <p style={{
                          fontFamily: 'var(--font-mono)', fontSize: 12,
                          color: 'var(--gray-500)', lineHeight: 1.5, margin: '8px 0 0',
                          overflow: 'hidden', textOverflow: 'ellipsis',
                          display: '-webkit-box', WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical' as const,
                        }}>
                          {spot.description}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Remove button */}
                <button
                  onClick={() => handleRemove(spot.id)}
                  style={{
                    position: 'absolute', top: 10, right: 10,
                    background: 'rgba(255,60,60,0.15)',
                    border: '1px solid rgba(255,60,60,0.4)',
                    borderRadius: '50%', width: 34, height: 34,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 16, padding: 0,
                    backdropFilter: 'blur(4px)',
                    transition: 'transform 0.15s',
                    zIndex: 2,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.15)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  aria-label="Rimuovi dai preferiti"
                  title="Rimuovi dai preferiti"
                >
                  ❤️
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Spot non trovati (ids presenti ma API non li ha trovati) */}
      {!loading && ids.length > 0 && spots.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)' }}>
            Errore nel caricamento degli spot. Riprova.
          </div>
        </div>
      )}
    </main>
  );
}
