'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Spot } from '@/lib/types';
import { TIPI_SPOT, CONDIZIONI } from '@/lib/constants';

interface SpotSheetProps {
  spot:    Spot | null;
  onClose: () => void;
  onFlag:  (spotId: string) => void;
}

export default function SpotSheet({ spot, onClose, onFlag }: SpotSheetProps) {
  const [photoIdx,  setPhotoIdx]  = useState(0);
  const [navOpen,   setNavOpen]   = useState(false);
  const sheetRef   = useRef<HTMLDivElement>(null);
  const startY     = useRef(0);
  const currentY   = useRef(0);
  const isDragging = useRef(false);

  useEffect(() => { setPhotoIdx(0); setNavOpen(false); }, [spot?.id]);

  // Swipe-to-close
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current   = e.touches[0].clientY;
    isDragging.current = true;
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

  const photos   = spot.spot_photos ?? [];
  const tipo     = TIPI_SPOT[spot.type];
  const cond     = CONDIZIONI[spot.condition];

  // URL navigatori
  const lat = spot.lat, lon = spot.lon;
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
  const appleMaps = `maps://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
  const wazeUrl   = `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
  const shareUrl  = `https://chrispybmx.com/map/spot/${spot.slug}`;

  const openNav = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    setNavOpen(false);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: `${spot.name} — Chrispy Maps`,
        text:  `Spot BMX: ${spot.name}${spot.city ? ` · ${spot.city}` : ''}`,
        url:   shareUrl,
      }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copiato!');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => { setNavOpen(false); onClose(); }}
        style={{ position: 'fixed', inset: 0, zIndex: 44, background: 'transparent' }}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Scheda spot: ${spot.name}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          background: 'var(--gray-800)',
          borderTop: '2px solid var(--orange)',
          borderRadius: '16px 16px 0 0',
          zIndex: 45,
          maxHeight: '88dvh',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          animation: 'slideUp 0.3s ease-out',
          paddingBottom: 'calc(var(--strip-height) + env(safe-area-inset-bottom))',
          transition: 'transform 0.1s ease-out',
        }}
      >
        <div className="bottom-sheet-handle" />

        {/* Foto */}
        {photos.length > 0 ? (
          <div style={{ position: 'relative', height: 220, overflow: 'hidden', marginTop: 8 }}>
            <img
              src={photos[photoIdx].url}
              alt={`Foto ${photoIdx + 1} di ${spot.name}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              loading="lazy"
            />
            {photos.length > 1 && (
              <>
                {/* Arrow prev */}
                {photoIdx > 0 && (
                  <button onClick={() => setPhotoIdx(i => i - 1)} style={arrowBtn('left')}>‹</button>
                )}
                {/* Arrow next */}
                {photoIdx < photos.length - 1 && (
                  <button onClick={() => setPhotoIdx(i => i + 1)} style={arrowBtn('right')}>›</button>
                )}
                {/* Dots */}
                <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5 }}>
                  {photos.map((_, i) => (
                    <button key={i} onClick={() => setPhotoIdx(i)} style={{
                      width: i === photoIdx ? 20 : 8, height: 8, borderRadius: 4,
                      border: 'none', padding: 0, cursor: 'pointer',
                      background: i === photoIdx ? 'var(--orange)' : 'rgba(255,255,255,0.4)',
                      transition: 'width 0.2s, background 0.2s',
                    }} aria-label={`Foto ${i + 1}`} />
                  ))}
                </div>
              </>
            )}
            {/* Condition badge */}
            <div style={{
              position: 'absolute', top: 10, right: 10,
              background: cond.bg, color: cond.color,
              fontFamily: 'var(--font-mono)', fontSize: 12,
              padding: '3px 8px', borderRadius: 2,
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {cond.label}
            </div>
          </div>
        ) : (
          /* Placeholder no-foto con condition badge */
          <div style={{
            height: 80, background: 'var(--gray-700)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: 8, position: 'relative',
          }}>
            <span style={{ fontSize: 36 }}>{tipo.emoji}</span>
            <div style={{
              position: 'absolute', top: 10, right: 10,
              background: cond.bg, color: cond.color,
              fontFamily: 'var(--font-mono)', fontSize: 12,
              padding: '3px 8px', borderRadius: 2,
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {cond.label}
            </div>
          </div>
        )}

        {/* Contenuto */}
        <div style={{ padding: '16px 20px' }}>
          {/* Nome + tipo */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 24, color: 'var(--orange)', margin: 0, lineHeight: 1.2 }}>
                {spot.name}
              </h2>
              {spot.city && (
                <div style={{ color: 'var(--gray-400)', fontSize: 14, marginTop: 3 }}>
                  📍 {spot.city}{spot.region ? `, ${spot.region}` : ''}
                </div>
              )}
            </div>
            <span className="badge-tipo" style={{ color: tipo.color, borderColor: tipo.color, flexShrink: 0 }}>
              {tipo.emoji} {tipo.label}
            </span>
          </div>

          {/* Inviato da @username */}
          {spot.submitted_by_username && (
            <a href={`/u/${spot.submitted_by_username}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12, textDecoration: 'none' }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--orange)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#000', flexShrink: 0 }}>
                {spot.submitted_by_username[0].toUpperCase()}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)' }}>
                inviato da <strong style={{ color: 'var(--orange)' }}>@{spot.submitted_by_username}</strong>
              </span>
            </a>
          )}

          {spot.description && (
            <p style={{ color: 'var(--bone)', fontSize: 15, lineHeight: 1.55, marginBottom: 12 }}>
              {spot.description}
            </p>
          )}

          {spot.guardians && (
            <div style={{
              background: 'rgba(255,106,0,0.08)',
              border: '1px solid rgba(255,106,0,0.2)',
              borderRadius: 4, padding: '8px 12px', marginBottom: 14,
              fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)',
            }}>
              ⚠️ {spot.guardians}
            </div>
          )}

          {/* YouTube */}
          {spot.youtube_url && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ▶ Video @chrispy_bmx
              </div>
              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 4 }}>
                <iframe
                  src={youtubeEmbedUrl(spot.youtube_url)}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={`Video dello spot ${spot.name}`}
                  loading="lazy"
                />
              </div>
            </div>
          )}

          {/* Azioni principali */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {/* Portami qui — apre picker */}
            <div style={{ flex: 2, position: 'relative' }}>
              <button
                onClick={() => setNavOpen(o => !o)}
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                🧭 Portami qui ▾
              </button>

              {/* Nav picker dropdown */}
              {navOpen && (
                <div onClick={e => e.stopPropagation()} style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 8px)',
                  left: 0, right: 0,
                  background: 'var(--gray-700)',
                  border: '1px solid var(--orange)',
                  borderRadius: 8,
                  overflow: 'hidden',
                  zIndex: 50,
                  boxShadow: '0 -4px 20px rgba(0,0,0,0.6)',
                }}>
                  <div style={{ padding: '8px 12px 4px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Apri con…
                  </div>
                  <NavOption icon="🗺️" label="Google Maps" onClick={() => openNav(googleUrl)} />
                  <NavOption icon="🍎" label="Apple Maps"  onClick={() => openNav(appleMaps)} />
                  <NavOption icon="🔵" label="Waze"        onClick={() => openNav(wazeUrl)} />
                </div>
              )}
            </div>

            <button onClick={handleShare} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
              📤 Condividi
            </button>
          </div>

          {/* Link pagina completa + segnala */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <a href={`/map/spot/${spot.slug}`} style={{ color: 'var(--gray-400)', fontSize: 13, textDecoration: 'none' }}>
              Pagina completa →
            </a>
            <button
              onClick={() => onFlag(spot.id)}
              style={{ background: 'none', border: 'none', color: 'var(--gray-400)', fontSize: 12, cursor: 'pointer' }}
            >
              ⚑ Segnala
            </button>
          </div>

          {spot.condition_updated_at && (
            <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)' }}>
              Aggiornato: {new Date(spot.condition_updated_at).toLocaleDateString('it-IT')}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ── sub-components ── */

function NavOption({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '12px 16px',
        background: 'none', border: 'none',
        borderTop: '1px solid var(--gray-600)',
        color: 'var(--bone)', fontSize: 16,
        cursor: 'pointer', textAlign: 'left',
        fontFamily: 'var(--font-mono)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,106,0,0.1)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      {label}
    </button>
  );
}

function arrowBtn(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: '50%', transform: 'translateY(-50%)',
    [side]: 8,
    background: 'rgba(10,10,10,0.7)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 4,
    color: 'var(--bone)',
    fontSize: 22,
    width: 32, height: 40,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  };
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: 'var(--bone)', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function youtubeEmbedUrl(url: string): string {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/\s]+)/);
  if (!match) return url;
  return `https://www.youtube.com/embed/${match[1]}?rel=0`;
}
