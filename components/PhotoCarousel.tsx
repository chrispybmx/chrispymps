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
  if (photos.length === 1) return (
    <div style={{ position: 'relative', width: '100%', background: '#111' }}>
      <img src={photos[0].url} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
      {photos[0].credit_name && <Credit name={photos[0].credit_name} />}
    </div>
  );

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      {/* Foto principale */}
      <div
        style={{ position: 'relative', overflow: 'hidden', background: '#111', cursor: 'grab' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={photos[idx].url}
          alt=""
          style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block', transition: 'opacity 0.2s' }}
          key={idx}
        />
        {/* Scanlines leggere */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.06) 3px,rgba(0,0,0,0.06) 5px)',
        }} />
        {/* Freccia sinistra */}
        <button onClick={prev} style={arrowStyle('left')} aria-label="Foto precedente">‹</button>
        {/* Freccia destra */}
        <button onClick={next} style={arrowStyle('right')} aria-label="Foto successiva">›</button>
        {/* Counter */}
        <div style={{
          position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.6)', borderRadius: 12,
          padding: '3px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#fff',
          letterSpacing: '0.04em',
        }}>
          {idx + 1} / {photos.length}
        </div>
        {photos[idx].credit_name && <Credit name={photos[idx].credit_name!} />}
      </div>

      {/* Thumbnail strip */}
      <div style={{
        display: 'flex', gap: 4, padding: '6px 0',
        overflowX: 'auto', background: '#0a0a0a',
      }}
      ref={el => { if (el) el.style.setProperty('scrollbar-width', 'none'); }}
      >
        {photos.map((p, i) => (
          <button key={i} onClick={() => setIdx(i)} style={{
            flexShrink: 0, width: 56, height: 40,
            border: i === idx ? '2px solid var(--orange)' : '2px solid transparent',
            borderRadius: 3, padding: 0, cursor: 'pointer',
            background: 'none', transition: 'border-color 0.15s',
            overflow: 'hidden',
          }}>
            <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function arrowStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', top: '50%', [side]: 10,
    transform: 'translateY(-50%)',
    background: 'rgba(0,0,0,0.55)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '50%', width: 36, height: 36,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 22, cursor: 'pointer',
    fontFamily: 'serif', lineHeight: 1, padding: 0,
    backdropFilter: 'blur(4px)',
    transition: 'background 0.15s',
  };
}

function Credit({ name }: { name: string }) {
  return (
    <div style={{
      position: 'absolute', bottom: 10, right: 10,
      background: 'rgba(0,0,0,0.55)', borderRadius: 4,
      padding: '2px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#aaa',
    }}>
      📷 {name}
    </div>
  );
}
