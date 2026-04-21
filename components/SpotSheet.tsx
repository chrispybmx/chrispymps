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
  const [photoIdx, setPhotoIdx] = useState(0);
  const sheetRef  = useRef<HTMLDivElement>(null);
  const startY    = useRef(0);
  const currentY  = useRef(0);
  const isDragging = useRef(false);

  // Reset photo index quando cambia lo spot
  useEffect(() => { setPhotoIdx(0); }, [spot?.id]);

  // Swipe-to-close touch gesture
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || !sheetRef.current) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
      currentY.current = delta;
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    isDragging.current = false;
    if (!sheetRef.current) return;
    if (currentY.current > 120) {
      onClose();
    } else {
      sheetRef.current.style.transform = '';
      currentY.current = 0;
    }
  }, [onClose]);

  if (!spot) return null;

  const photos = spot.spot_photos ?? [];
  const tipo   = TIPI_SPOT[spot.type];
  const cond   = CONDIZIONI[spot.condition];

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lon}`;
  const shareUrl = `https://chrispybmx.com/map/spot/${spot.slug}`;

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: `${spot.name} — ChrispyMPS`,
        text:  `Guarda questo spot BMX: ${spot.name} a ${spot.city ?? 'Italia'}`,
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
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          zIndex: 44,
          background: 'transparent',
        }}
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
          maxHeight: '85dvh',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          animation: 'slideUp 0.3s ease-out',
          paddingBottom: 'calc(var(--strip-height) + env(safe-area-inset-bottom))',
          transition: 'transform 0.1s ease-out',
        }}
      >
        {/* Handle drag */}
        <div className="bottom-sheet-handle" />

        {/* Foto gallery */}
        {photos.length > 0 && (
          <div style={{ position: 'relative', height: 220, overflow: 'hidden', marginTop: 8 }}>
            <img
              src={photos[photoIdx].url}
              alt={`Foto ${photoIdx + 1} di ${spot.name}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              loading="lazy"
            />
            {/* Thumbnails */}
            {photos.length > 1 && (
              <div style={{
                position: 'absolute', bottom: 8, left: 0, right: 0,
                display: 'flex', justifyContent: 'center', gap: 6,
              }}>
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoIdx(i)}
                    style={{
                      width: i === photoIdx ? 20 : 8,
                      height: 8,
                      borderRadius: 4,
                      border: 'none',
                      background: i === photoIdx ? 'var(--orange)' : 'rgba(255,255,255,0.4)',
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'width 0.2s, background 0.2s',
                    }}
                    aria-label={`Foto ${i + 1}`}
                  />
                ))}
              </div>
            )}
            {/* Condition overlay */}
            <div style={{
              position: 'absolute', top: 10, right: 10,
              background: cond.bg, color: cond.color,
              fontFamily: 'var(--font-mono)',
              fontSize: 12, padding: '3px 8px',
              borderRadius: 2, textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              {cond.label}
            </div>
          </div>
        )}

        {/* Contenuto */}
        <div style={{ padding: '16px 20px' }}>
          {/* Nome + tipo */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <h2 style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 24,
                color: 'var(--orange)',
                margin: 0,
                lineHeight: 1.2,
              }}>
                {spot.name}
              </h2>
              {spot.city && (
                <div style={{ color: 'var(--gray-400)', fontSize: 14, marginTop: 2 }}>
                  📍 {spot.city}{spot.region ? `, ${spot.region}` : ''}
                </div>
              )}
            </div>
            <span
              className="badge-tipo"
              style={{ color: tipo.color, borderColor: tipo.color, flexShrink: 0 }}
            >
              {tipo.emoji} {tipo.label}
            </span>
          </div>

          {/* Dettagli */}
          {spot.description && (
            <p style={{ color: 'var(--bone)', fontSize: 15, lineHeight: 1.5, marginBottom: 12 }}>
              {spot.description}
            </p>
          )}

          {/* Meta grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '8px 12px', marginBottom: 16,
          }}>
            {spot.surface && <MetaRow label="Superficie" value={spot.surface} />}
            {spot.difficulty && <MetaRow label="Livello" value={spot.difficulty} />}
            {spot.wax_needed && <MetaRow label="Cera" value="Necessaria 🕯️" />}
            {spot.guardians && (
              <div style={{ gridColumn: '1/-1' }}>
                <MetaRow label="Note accesso" value={spot.guardians} />
              </div>
            )}
          </div>

          {/* YouTube embed */}
          {spot.youtube_url && (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12, color: 'var(--gray-400)',
                marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
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

          {/* Azioni */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              style={{ flex: 1, justifyContent: 'center', textDecoration: 'none' }}
            >
              🧭 Portami qui
            </a>
            <button
              onClick={handleShare}
              className="btn-secondary"
              style={{ flex: 1, justifyContent: 'center' }}
            >
              📤 Condividi
            </button>
          </div>

          {/* Link pagina + segnala */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <a
              href={`/map/spot/${spot.slug}`}
              style={{ color: 'var(--gray-400)', fontSize: 13, textDecoration: 'none' }}
            >
              Pagina completa →
            </a>
            <button
              onClick={() => onFlag(spot.id)}
              style={{ background: 'none', border: 'none', color: 'var(--gray-400)', fontSize: 12, cursor: 'pointer' }}
            >
              ⚑ Segnala
            </button>
          </div>

          {/* Timestamp */}
          {spot.condition_updated_at && (
            <div style={{
              marginTop: 12,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--gray-400)',
            }}>
              Condizione aggiornata: {new Date(spot.condition_updated_at).toLocaleDateString('it-IT')}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: 'var(--bone)', marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

function youtubeEmbedUrl(url: string): string {
  // Supporta youtube.com/watch?v=ID e youtu.be/ID
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/\s]+)/);
  if (!match) return url;
  return `https://www.youtube.com/embed/${match[1]}?rel=0`;
}
