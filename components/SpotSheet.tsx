'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Spot, SpotMapPin } from '@/lib/types';
import { TIPI_SPOT, CONDIZIONI } from '@/lib/constants';

interface SpotSheetProps {
  spot:        Spot | null;
  onClose:     () => void;
  onFlag:      (spotId: string) => void;
  // Navigazione tra spot (opzionale)
  allSpots?:   SpotMapPin[];
  currentIdx?: number;
  onNavigate?: (idx: number) => void;
}

/* ── localStorage utils ── */
const FAVS_KEY   = 'cmaps_favs_v1';
const ratingKey  = (id: string) => `cmaps_rating_${id}`;

function isFav(id: string): boolean {
  try { return (JSON.parse(localStorage.getItem(FAVS_KEY) ?? '[]') as string[]).includes(id); }
  catch { return false; }
}
function toggleFav(id: string): boolean {
  try {
    const favs: string[] = JSON.parse(localStorage.getItem(FAVS_KEY) ?? '[]');
    const i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1); else favs.push(id);
    localStorage.setItem(FAVS_KEY, JSON.stringify(favs));
    return i < 0; // true = aggiunto
  } catch { return false; }
}
function getMyRating(id: string): number {
  try { return Math.min(5, Math.max(0, parseInt(localStorage.getItem(ratingKey(id)) ?? '0', 10) || 0)); }
  catch { return 0; }
}
function saveRating(id: string, r: number): void {
  try { localStorage.setItem(ratingKey(id), String(r)); } catch {}
}

export default function SpotSheet({ spot, onClose, onFlag, allSpots, currentIdx, onNavigate }: SpotSheetProps) {
  const [photoIdx,  setPhotoIdx]  = useState(0);
  const [navOpen,   setNavOpen]   = useState(false);
  const [myRating,  setMyRating]  = useState(0);
  const [hoverStar, setHoverStar] = useState(0);
  const [fav,       setFav]       = useState(false);
  const sheetRef   = useRef<HTMLDivElement>(null);
  const startY     = useRef(0);
  const currentY   = useRef(0);
  const isDragging = useRef(false);

  useEffect(() => {
    if (!spot) return;
    setPhotoIdx(0); setNavOpen(false);
    setMyRating(getMyRating(spot.id));
    setFav(isFav(spot.id));
  }, [spot?.id]);

  /* ── swipe-to-close ── */
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY; isDragging.current = true;
  }, []);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || !sheetRef.current) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) { sheetRef.current.style.transform = `translateY(${delta}px)`; currentY.current = delta; }
  }, []);
  const onTouchEnd = useCallback(() => {
    isDragging.current = false;
    if (!sheetRef.current) return;
    if (currentY.current > 120) { onClose(); }
    else { sheetRef.current.style.transform = ''; currentY.current = 0; }
  }, [onClose]);

  if (!spot) return null;

  const photos   = (spot.spot_photos ?? []).slice().sort((a, b) => a.position - b.position);
  const tipo     = TIPI_SPOT[spot.type];
  const cond     = CONDIZIONI[spot.condition];
  const lat = spot.lat, lon = spot.lon;
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
  const appleMaps = `maps://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
  const wazeUrl   = `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
  const shareUrl  = `https://chrispybmx.com/map/spot/${spot.slug}`;

  const openNav    = (url: string) => { window.open(url, '_blank', 'noopener,noreferrer'); setNavOpen(false); };
  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: `${spot.name} — Chrispy Maps`, text: `Spot BMX: ${spot.name}`, url: shareUrl }).catch(() => {});
    } else { await navigator.clipboard.writeText(shareUrl); alert('Link copiato!'); }
  };
  const handleRating = (r: number) => {
    const next = r === myRating ? 0 : r;
    saveRating(spot.id, next); setMyRating(next);
  };
  const handleFav = () => { const added = toggleFav(spot.id); setFav(added); };

  const hasPrev = currentIdx != null && currentIdx > 0;
  const hasNext = currentIdx != null && allSpots != null && currentIdx < allSpots.length - 1;

  return (
    <>
      {/* Backdrop */}
      <div onClick={() => { setNavOpen(false); onClose(); }}
        style={{ position: 'fixed', inset: 0, zIndex: 44, background: 'transparent' }} aria-hidden="true" />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog" aria-modal="true" aria-label={`Scheda spot: ${spot.name}`}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--gray-800)',
          borderTop: '2px solid var(--orange)',
          borderRadius: '16px 16px 0 0',
          zIndex: 45, maxHeight: '91dvh', overflowY: 'auto',
          overscrollBehavior: 'contain',
          animation: 'slideUp 0.3s ease-out',
          paddingBottom: 'calc(var(--strip-height) + env(safe-area-inset-bottom))',
          transition: 'transform 0.1s ease-out',
        }}
      >
        <div className="bottom-sheet-handle" />

        {/* ══ FOTO ══ */}
        {photos.length > 0 ? (
          <div style={{ position: 'relative', height: 280, overflow: 'hidden', background: '#111' }}>
            <img
              src={photos[photoIdx].url}
              alt={`Foto ${photoIdx + 1} — ${spot.name}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              loading="lazy"
            />
            {/* gradient per leggibilità testo */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
              background: 'linear-gradient(transparent, rgba(10,10,10,0.88))' }} />

            {/* Titolo sopra la foto */}
            <div style={{ position: 'absolute', bottom: 12, left: 16, right: 48 }}>
              <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 21, color: '#fff', margin: 0,
                lineHeight: 1.2, textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>
                {spot.name}
              </h2>
              {spot.city && (
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 3 }}>
                  📍 {spot.city}
                </div>
              )}
            </div>

            {/* Condition badge top-left */}
            <div style={{
              position: 'absolute', top: 12, left: 12,
              background: cond.bg, color: cond.color,
              fontFamily: 'var(--font-mono)', fontSize: 11,
              padding: '3px 8px', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {cond.label}
            </div>

            {/* Photo dots top-right */}
            {photos.length > 1 && (
              <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
                {photos.map((_, i) => (
                  <button key={i} onClick={() => setPhotoIdx(i)} style={{
                    width: i === photoIdx ? 18 : 6, height: 6, borderRadius: 3,
                    border: 'none', padding: 0, cursor: 'pointer',
                    background: i === photoIdx ? 'var(--orange)' : 'rgba(255,255,255,0.5)',
                    transition: 'width 0.2s, background 0.2s',
                  }} aria-label={`Foto ${i + 1}`} />
                ))}
              </div>
            )}

            {/* Arrow prev/next */}
            {photos.length > 1 && photoIdx > 0 && (
              <button onClick={() => setPhotoIdx(i => i - 1)} style={arrowBtn('left')}>‹</button>
            )}
            {photos.length > 1 && photoIdx < photos.length - 1 && (
              <button onClick={() => setPhotoIdx(i => i + 1)} style={arrowBtn('right')}>›</button>
            )}
          </div>
        ) : (
          /* No photo: placeholder compatto */
          <div style={{ height: 80, background: 'var(--gray-700)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', position: 'relative', marginTop: 8 }}>
            <span style={{ fontSize: 36 }}>{tipo.emoji}</span>
            <div style={{ position: 'absolute', top: 8, left: 12 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--orange)' }}>{spot.name}</div>
              {spot.city && <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>📍 {spot.city}</div>}
            </div>
            <div style={{ position: 'absolute', top: 8, right: 12, background: cond.bg, color: cond.color,
              fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 8px', borderRadius: 2, textTransform: 'uppercase' }}>
              {cond.label}
            </div>
          </div>
        )}

        {/* ══ CONTENUTO ══ */}
        <div style={{ padding: '12px 18px' }}>

          {/* ── Stelle + Tipo + Preferiti ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            {/* Stars */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => handleRating(star)}
                  onMouseEnter={() => setHoverStar(star)}
                  onMouseLeave={() => setHoverStar(0)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '2px 1px',
                    fontSize: 23, lineHeight: 1,
                    color: star <= (hoverStar || myRating) ? '#ffce4d' : 'var(--gray-600)',
                    transition: 'color 0.1s, transform 0.1s',
                    transform: star <= (hoverStar || myRating) ? 'scale(1.15)' : 'scale(1)',
                  }}
                  aria-label={`${star} stelle`}
                >★</button>
              ))}
              {myRating > 0 && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', marginLeft: 3 }}>
                  {myRating}/5
                </span>
              )}
            </div>

            {/* Tipo + Favoriti */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge-tipo" style={{ color: tipo.color, borderColor: tipo.color, fontSize: 11 }}>
                {tipo.emoji} {tipo.label}
              </span>
              <button onClick={handleFav} style={{
                background: fav ? 'rgba(255,106,0,0.12)' : 'transparent',
                border: `1px solid ${fav ? 'var(--orange)' : 'var(--gray-600)'}`,
                borderRadius: 6, padding: '5px 9px', cursor: 'pointer',
                fontSize: 17, lineHeight: 1, transition: 'all 0.15s',
                display: 'flex', alignItems: 'center',
              }} aria-label={fav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'} title={fav ? 'Salvato' : 'Salva'}>
                {fav ? '❤️' : '🤍'}
              </button>
            </div>
          </div>

          {/* ── @username ── */}
          {spot.submitted_by_username && (
            <a href={`/u/${spot.submitted_by_username}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10, textDecoration: 'none',
            }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--orange)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 10, color: '#000', flexShrink: 0 }}>
                {spot.submitted_by_username[0].toUpperCase()}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)' }}>
                @<strong style={{ color: 'var(--orange)' }}>{spot.submitted_by_username}</strong>
              </span>
            </a>
          )}

          {/* ── Descrizione ── */}
          {spot.description && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)',
                textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                Descrizione
              </div>
              <p style={{ color: 'var(--bone)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                {spot.description}
              </p>
            </div>
          )}

          {/* ── Avvisi ── */}
          {spot.guardians && (
            <div style={{
              background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.2)',
              borderRadius: 4, padding: '7px 11px', marginBottom: 12,
              fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--bone)',
            }}>
              ⚠️ {spot.guardians}
            </div>
          )}

          {/* ── YouTube ── */}
          {spot.youtube_url && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)',
                marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                ▶ Video
              </div>
              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 4 }}>
                <iframe
                  src={youtubeEmbedUrl(spot.youtube_url)}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen title={`Video ${spot.name}`} loading="lazy"
                />
              </div>
            </div>
          )}

          {/* ── Azioni ── */}
          <div style={{ display: 'flex', gap: 7, marginBottom: 6 }}>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setNavOpen(o => !o)} className="btn-secondary"
                style={{ padding: '8px 12px', fontSize: 13, gap: 5, whiteSpace: 'nowrap' }}>
                🧭 Portami qui ▾
              </button>
              {navOpen && (
                <div onClick={e => e.stopPropagation()} style={{
                  position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
                  background: 'var(--gray-700)', border: '1px solid var(--orange)',
                  borderRadius: 8, overflow: 'hidden', zIndex: 50, minWidth: 155,
                  boxShadow: '0 -4px 20px rgba(0,0,0,0.6)',
                }}>
                  <div style={{ padding: '5px 12px 2px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Apri con…</div>
                  <NavOption label="Google Maps" onClick={() => openNav(googleUrl)} />
                  <NavOption label="Apple Maps"  onClick={() => openNav(appleMaps)} />
                  <NavOption label="Waze"        onClick={() => openNav(wazeUrl)} />
                </div>
              )}
            </div>
            <button onClick={handleShare} className="btn-secondary"
              style={{ padding: '8px 11px', fontSize: 16, flexShrink: 0 }}
              title="Condividi spot">
              📤
            </button>
            <a href={`/map/spot/${spot.slug}`} className="btn-secondary"
              style={{ fontSize: 13, padding: '8px 12px', textDecoration: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Pagina completa">
              ↗
            </a>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            {spot.condition_updated_at && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)' }}>
                Aggiornato: {new Date(spot.condition_updated_at).toLocaleDateString('it-IT')}
              </div>
            )}
            <button onClick={() => onFlag(spot.id)} style={{
              background: 'none', border: 'none', color: 'var(--gray-400)', fontSize: 11, cursor: 'pointer', marginLeft: 'auto',
            }}>
              ⚑ Segnala
            </button>
          </div>

          {/* ── Prev / Next navigation ── */}
          {allSpots && allSpots.length > 1 && currentIdx != null && (
            <div style={{
              display: 'flex', borderTop: '1px solid var(--gray-700)', marginTop: 10, paddingTop: 10,
            }}>
              {/* PREV */}
              <button
                onClick={() => hasPrev && onNavigate?.(currentIdx - 1)}
                disabled={!hasPrev}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                  background: 'none', border: 'none',
                  color: hasPrev ? 'var(--bone)' : 'var(--gray-700)',
                  cursor: hasPrev ? 'pointer' : 'default',
                  padding: '8px 0', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 20 }}>←</span>
                {hasPrev && (
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Precedente</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--orange)', marginTop: 1 }}>
                      {allSpots[currentIdx - 1]?.name}
                    </div>
                  </div>
                )}
              </button>

              <div style={{ width: 1, background: 'var(--gray-700)', margin: '0 10px', flexShrink: 0 }} />

              {/* NEXT */}
              <button
                onClick={() => hasNext && onNavigate?.(currentIdx + 1)}
                disabled={!hasNext}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
                  background: 'none', border: 'none',
                  color: hasNext ? 'var(--bone)' : 'var(--gray-700)',
                  cursor: hasNext ? 'pointer' : 'default',
                  padding: '8px 0', textAlign: 'right',
                }}
              >
                {hasNext && (
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Successivo</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--orange)', marginTop: 1 }}>
                      {allSpots[currentIdx + 1]?.name}
                    </div>
                  </div>
                )}
                <span style={{ fontSize: 20 }}>→</span>
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

/* ── Sub-components ── */

function NavOption({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center',
      width: '100%', padding: '10px 14px',
      background: 'none', border: 'none', borderTop: '1px solid var(--gray-600)',
      color: 'var(--bone)', fontSize: 14, cursor: 'pointer', textAlign: 'left',
      fontFamily: 'var(--font-mono)', transition: 'background 0.1s',
    }}
    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,106,0,0.1)')}
    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      {label}
    </button>
  );
}

function arrowBtn(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    [side]: 8,
    background: 'rgba(10,10,10,0.65)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 4, color: 'var(--bone)', fontSize: 22,
    width: 32, height: 44,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', padding: 0, lineHeight: 1,
  };
}

function youtubeEmbedUrl(url: string): string {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/\s]+)/);
  if (!match) return url;
  return `https://www.youtube.com/embed/${match[1]}?rel=0`;
}
