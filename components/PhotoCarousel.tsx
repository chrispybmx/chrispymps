'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Photo { url: string; credit_name?: string }

export default function PhotoCarousel({ photos }: { photos: Photo[] }) {
  const [idx,      setIdx]      = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const stripRef   = useRef<HTMLDivElement>(null);
  /* Distingue tap da swipe per non aprire il lightbox mentre si scorre */
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping   = useRef(false);

  /* Sincronizza idx ↔ scroll-snap senza causare loop */
  const onScroll = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    const newIdx = Math.round(el.scrollLeft / el.offsetWidth);
    setIdx(i => (i !== newIdx ? newIdx : i));
  }, []);

  /* Naviga programmaticamente (frecce, dots) */
  const scrollTo = useCallback((i: number) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.offsetWidth, behavior: 'smooth' });
    setIdx(i);
  }, []);

  const prev = () => scrollTo((idx - 1 + photos.length) % photos.length);
  const next = () => scrollTo((idx + 1) % photos.length);

  /* Keyboard nel lightbox */
  useEffect(() => {
    if (!lightbox) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     setLightbox(false);
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft')  prev();
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [lightbox, idx]);   // eslint-disable-line

  if (photos.length === 0) return null;

  return (
    <>
      {/* ── LIGHTBOX ── */}
      {lightbox && (
        <div
          onClick={() => setLightbox(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.97)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <button onClick={() => setLightbox(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 48, height: 48, fontSize: 22, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>✕</button>

          {photos.length > 1 && (
            <button onClick={e => { e.stopPropagation(); prev(); }} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 52, height: 52, fontSize: 28, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          )}

          <img src={photos[idx].url} alt="" onClick={e => e.stopPropagation()} style={{ maxWidth: '94vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 6, boxShadow: '0 8px 48px rgba(0,0,0,0.8)' }} />

          {photos.length > 1 && (
            <button onClick={e => { e.stopPropagation(); next(); }} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 52, height: 52, fontSize: 28, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          )}

          {photos.length > 1 && (
            <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
              {photos.map((_, i) => (
                <div key={i} onClick={e => { e.stopPropagation(); scrollTo(i); }} style={{ width: i === idx ? 18 : 6, height: 6, borderRadius: 3, background: i === idx ? 'var(--orange)' : 'rgba(255,255,255,0.35)', transition: 'width 0.2s', cursor: 'pointer' }} />
              ))}
            </div>
          )}

          {photos[idx].credit_name && (
            <div style={{ position: 'absolute', bottom: 16, right: 16, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>📷 {photos[idx].credit_name}</div>
          )}
        </div>
      )}

      {/* ── CAROUSEL principale ── */}
      <div style={{ position: 'relative', background: '#0a0a0a', userSelect: 'none' }}>

        {/* Strip scroll-snap: scorribile con il dito, snap automatico */}
        <div
          ref={stripRef}
          onScroll={onScroll}
          onTouchStart={e => {
            touchStartX.current = e.touches[0].clientX;
            touchStartY.current = e.touches[0].clientY;
            isSwiping.current = false;
          }}
          onTouchMove={e => {
            const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
            const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
            if (dx > 6 || dy > 6) isSwiping.current = true;
          }}
          onClick={() => {
            /* Apre lightbox solo se non era uno swipe */
            if (!isSwiping.current) setLightbox(true);
          }}
          style={{
            display: 'flex',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            scrollBehavior: 'auto',    // smooth gestito da scrollTo()
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            width: '100%',
            height: 'clamp(300px, 75vw, 540px)',
            cursor: 'zoom-in',
          } as React.CSSProperties}
        >
          {photos.map((p, i) => (
            <div
              key={p.url}
              style={{
                flexShrink: 0,
                width: '100%',
                height: '100%',
                scrollSnapAlign: 'start',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#0a0a0a',
                position: 'relative',
              }}
            >
              <img
                src={p.url}
                alt=""
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
                loading={i === 0 ? 'eager' : 'lazy'}
              />
              {/* Credit */}
              {p.credit_name && (
                <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '2px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#aaa', zIndex: 2 }}>
                  📷 {p.credit_name}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Hint zoom */}
        <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.55)', borderRadius: 4, padding: '3px 8px', fontSize: 14, pointerEvents: 'none', zIndex: 2 }}>🔍</div>

        {/* Frecce — solo su desktop dove non c'è swipe naturale */}
        {photos.length > 1 && (
          <>
            <button onClick={e => { e.stopPropagation(); prev(); }} style={arrowStyle('left')} aria-label="Precedente">‹</button>
            <button onClick={e => { e.stopPropagation(); next(); }} style={arrowStyle('right')} aria-label="Successiva">›</button>
          </>
        )}

        {/* Dot indicators */}
        {photos.length > 1 && (
          <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5, zIndex: 2 }}>
            {photos.map((_, i) => (
              <div key={i} onClick={e => { e.stopPropagation(); scrollTo(i); }} style={{ width: i === idx ? 16 : 6, height: 6, borderRadius: 3, background: i === idx ? 'var(--orange)' : 'rgba(255,255,255,0.35)', transition: 'width 0.2s', cursor: 'pointer' }} />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div style={{ display: 'flex', gap: 4, padding: '6px 8px', overflowX: 'auto', background: '#080808', borderTop: '1px solid rgba(255,255,255,0.05)', scrollbarWidth: 'none' } as React.CSSProperties}>
          {photos.map((p, i) => (
            <button key={p.url} onClick={() => scrollTo(i)} style={{ flexShrink: 0, width: 68, height: 50, border: `2px solid ${i === idx ? 'var(--orange)' : 'transparent'}`, borderRadius: 4, padding: 0, cursor: 'pointer', background: '#111', transition: 'border-color 0.15s', overflow: 'hidden' }}>
              <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function arrowStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', top: '50%', [side]: 10,
    transform: 'translateY(-50%)',
    background: 'rgba(0,0,0,0.6)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: '50%', width: 44, height: 44,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 26, cursor: 'pointer',
    fontFamily: 'serif', lineHeight: 1, padding: 0,
    backdropFilter: 'blur(6px)',
    zIndex: 2,
  };
}
