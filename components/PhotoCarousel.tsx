'use client';

import { useState, useRef, useCallback } from 'react';

interface Photo { url: string; credit_name?: string }

export default function PhotoCarousel({ photos }: { photos: Photo[] }) {
  const [idx, setIdx] = useState(0);
  const startX = useRef(0);
  const dragging = useRef(false);

  const prev = useCallback(() => setIdx(i => (i - 1 + photos.length) % photos.length), [photos.length]);
  const next = useCallback(() => setIdx(i => (i + 1) % photos.length), [photos.length]);

  const onTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; dragging.current = true; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
  };

  if (photos.length === 0) return null;

  return (
    <div style={{ position: 'relative', userSelect: 'none', background: '#0a0a0a' }}>

      {/* Foto principale — altezza fissa, contain per non tagliare */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 'clamp(220px, 55vw, 420px)',
          background: '#0a0a0a',
          cursor: photos.length > 1 ? 'grab' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <img
          key={idx}
          src={photos[idx].url}
          alt=""
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            display: 'block',
          }}
        />

        {/* Scanlines leggere */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.06) 3px,rgba(0,0,0,0.06) 5px)',
        }} />

        {/* Frecce — solo se più foto */}
        {photos.length > 1 && (
          <>
            <button onClick={prev} style={arrowStyle('left')} aria-label="Precedente">‹</button>
            <button onClick={next} style={arrowStyle('right')} aria-label="Successiva">›</button>
          </>
        )}

        {/* Counter */}
        {photos.length > 1 && (
          <div style={{
            position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.65)', borderRadius: 12,
            padding: '3px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#fff',
            letterSpacing: '0.04em',
          }}>
            {idx + 1} / {photos.length}
          </div>
        )}

        {/* Credit */}
        {photos[idx].credit_name && <Credit name={photos[idx].credit_name!} />}
      </div>

      {/* Thumbnail strip — solo se più foto */}
      {photos.length > 1 && (
        <div
          style={{
            display: 'flex', gap: 3, padding: '4px 6px',
            overflowX: 'auto', background: '#080808',
            borderTop: '1px solid rgba(255,255,255,0.05)',
          }}
          ref={el => { if (el) el.style.setProperty('scrollbar-width', 'none'); }}
        >
          {photos.map((p, i) => (
            <button key={i} onClick={() => setIdx(i)} style={{
              flexShrink: 0, width: 52, height: 36,
              border: i === idx ? '2px solid var(--orange)' : '2px solid transparent',
              borderRadius: 3, padding: 0, cursor: 'pointer',
              background: '#111', transition: 'border-color 0.15s',
              overflow: 'hidden',
            }}>
              <img
                src={p.url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#111' }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function arrowStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', top: '50%', [side]: 10,
    transform: 'translateY(-50%)',
    background: 'rgba(0,0,0,0.6)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: '50%', width: 38, height: 38,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 24, cursor: 'pointer',
    fontFamily: 'serif', lineHeight: 1, padding: 0,
    backdropFilter: 'blur(6px)',
    zIndex: 2,
  };
}

function Credit({ name }: { name: string }) {
  return (
    <div style={{
      position: 'absolute', bottom: 10, right: 10,
      background: 'rgba(0,0,0,0.6)', borderRadius: 4,
      padding: '2px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#aaa',
      zIndex: 2,
    }}>
      📷 {name}
    </div>
  );
}
