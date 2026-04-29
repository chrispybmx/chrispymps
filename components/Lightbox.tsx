'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface LightboxProps {
  urls:       string[];
  initialIdx: number;
  onClose:    () => void;
}

export default function Lightbox({ urls, initialIdx, onClose }: LightboxProps) {
  const [idx, setIdx] = useState(initialIdx);
  const stripRef = useRef<HTMLDivElement>(null);

  /* Scroll to initial photo on mount */
  useEffect(() => {
    const el = stripRef.current;
    if (el) el.scrollLeft = initialIdx * el.offsetWidth;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Keyboard navigation */
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') scrollTo(idx === urls.length - 1 ? 0 : idx + 1);
      if (e.key === 'ArrowLeft')  scrollTo(idx === 0 ? urls.length - 1 : idx - 1);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [idx, urls.length, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    const newIdx = Math.round(el.scrollLeft / el.offsetWidth);
    setIdx(i => i !== newIdx ? newIdx : i);
  }, []);

  const scrollTo = useCallback((i: number) => {
    const el = stripRef.current;
    if (el) el.scrollTo({ left: i * el.offsetWidth, behavior: 'smooth' });
    setIdx(i);
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.97)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        background: 'linear-gradient(rgba(0,0,0,0.6),transparent)',
        pointerEvents: 'none',
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
          {idx + 1} / {urls.length}
        </div>
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onClose(); }}
          style={{
            background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%',
            width: 40, height: 40, fontSize: 20, color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'all',
          }}
        >✕</button>
      </div>

      {/* Scrollable strip */}
      <div
        ref={stripRef}
        onScroll={onScroll}
        onClick={onClose}
        style={{
          display: 'flex', flex: 1,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollBehavior: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          touchAction: 'pan-x',
        } as React.CSSProperties}
      >
        {urls.map((url, i) => (
          <div
            key={url + i}
            style={{
              flexShrink: 0, width: '100vw', height: '100%',
              scrollSnapAlign: 'start',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <img
              src={url}
              alt={`Foto ${i + 1}`}
              style={{
                maxWidth: '96vw', maxHeight: '88vh',
                objectFit: 'contain', borderRadius: 4,
                boxShadow: '0 8px 40px rgba(0,0,0,0.9)',
              }}
              loading={Math.abs(i - idx) <= 1 ? 'eager' : 'lazy'}
            />
          </div>
        ))}
      </div>

      {/* Desktop arrows */}
      {urls.length > 1 && idx > 0 && (
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); scrollTo(idx - 1); }}
          style={arrowStyle('left')}
        >‹</button>
      )}
      {urls.length > 1 && idx < urls.length - 1 && (
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); scrollTo(idx + 1); }}
          style={arrowStyle('right')}
        >›</button>
      )}

      {/* Dots */}
      {urls.length > 1 && (
        <div style={{
          position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 6,
        }}>
          {urls.map((_, i) => (
            <div key={i} style={{
              width: i === idx ? 18 : 6, height: 6, borderRadius: 3,
              background: i === idx ? 'var(--orange)' : 'rgba(255,255,255,0.35)',
              transition: 'width 0.2s',
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

function arrowStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    [side]: 10,
    background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
    width: 52, height: 52, fontSize: 30, color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}
