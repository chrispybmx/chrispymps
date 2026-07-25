'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Photo { url: string; credit_name?: string }

/* Easing "move" della skill ui-animation: usato solo DOPO il rilascio del dito.
   Durante il drag l'immagine resta agganciata al puntatore (nessuna transizione). */
const MOVE_EASE = 'cubic-bezier(0.25, 1, 0.5, 1)';
const SWIPE_DISTANCE = 60;   // px minimi per cambiare foto
const DISMISS_DISTANCE = 110; // px verso il basso per chiudere
const VELOCITY = 0.5;         // px/ms: un flick veloce basta anche sotto soglia

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

  if (photos.length === 0) return null;

  return (
    <>
      {lightbox && (
        <Lightbox
          photos={photos}
          startIdx={idx}
          onIndexChange={(i) => { setIdx(i); scrollTo(i); }}
          onClose={() => setLightbox(false)}
        />
      )}

      {/* ── CAROUSEL principale ── */}
      <div className="spot-carousel-wrap" style={{ position: 'relative', background: '#0a0a0a', userSelect: 'none' }}>

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

        {/* Hint tap-per-ingrandire */}
        <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.55)', borderRadius: 4, padding: '3px 8px', fontSize: 14, pointerEvents: 'none', zIndex: 2 }}>🔍</div>

        {/* Frecce — solo dove c'è un puntatore fine (desktop). Su touch c'è lo swipe. */}
        {photos.length > 1 && (
          <>
            <button onClick={e => { e.stopPropagation(); prev(); }} className="carousel-arrow" style={arrowStyle('left')} aria-label="Precedente">‹</button>
            <button onClick={e => { e.stopPropagation(); next(); }} className="carousel-arrow" style={arrowStyle('right')} aria-label="Successiva">›</button>
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

      {/* Thumbnail strip — solo con più foto */}
      {photos.length > 1 && (
        <div style={{ display: 'flex', gap: 3, padding: '4px 8px', background: '#050505', overflowX: 'auto', scrollbarWidth: 'none' } as React.CSSProperties}>
          {photos.map((p, i) => (
            <button key={p.url} onClick={() => scrollTo(i)}
              style={{ flexShrink: 0, width: 44, height: 34, border: `2px solid ${i === idx ? 'var(--orange)' : 'transparent'}`, borderRadius: 3, padding: 0, cursor: 'pointer', background: '#111', overflow: 'hidden', opacity: i === idx ? 1 : 0.55, transition: 'opacity 0.15s, border-color 0.15s' }}>
              <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {/* Frecce nascoste su touch (ridondanti col dito) + keyframe entrata lightbox */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes lbIn { from { opacity: 0 } to { opacity: 1 } }
        @media (hover: none) and (pointer: coarse) {
          .carousel-arrow { display: none !important; }
        }
      ` }} />
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   LIGHTBOX fullscreen swipeable
   - swipe orizzontale: cambia foto (segue il dito, snap con momentum)
   - swipe verticale giù: chiude (iOS-like), lo sfondo si dissolve
   - resistenza (damping) ai bordi invece di stop netto
   Manipola il DOM via ref durante il drag (nessun re-render per frame),
   commit dello stato solo al rilascio. Anima solo transform/opacity.
══════════════════════════════════════════════════════════════ */
function Lightbox({
  photos, startIdx, onIndexChange, onClose,
}: {
  photos: Photo[];
  startIdx: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIdx);
  const idxRef = useRef(startIdx);
  const overlayRef = useRef<HTMLDivElement>(null);
  const trackRef   = useRef<HTMLDivElement>(null);

  // stato del gesto (in ref: non deve causare render)
  const drag = useRef({
    active: false, pointerId: -1,
    startX: 0, startY: 0, dx: 0, dy: 0,
    axis: '' as '' | 'x' | 'y',
    startT: 0, w: 0,
  });

  const commitIdx = useCallback((i: number) => {
    idxRef.current = i;
    setIdx(i);
    onIndexChange(i);
  }, [onIndexChange]);

  /* Posiziona la track su una foto con o senza animazione */
  const place = useCallback((i: number, animate: boolean) => {
    const t = trackRef.current;
    if (!t) return;
    t.style.transition = animate ? `transform 0.32s ${MOVE_EASE}` : 'none';
    t.style.transform = `translate3d(${-i * 100}%, 0, 0)`;
    const o = overlayRef.current;
    if (o) {
      o.style.transition = animate ? `opacity 0.32s ${MOVE_EASE}` : 'none';
      o.style.background = 'rgba(0,0,0,0.97)';
    }
  }, []);

  useEffect(() => { place(startIdx, false); }, [startIdx, place]);

  /* Tastiera (desktop) — azioni istantanee, nessuna animazione forzata */
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && idxRef.current < photos.length - 1) { const n = idxRef.current + 1; commitIdx(n); place(n, true); }
      if (e.key === 'ArrowLeft'  && idxRef.current > 0)                 { const n = idxRef.current - 1; commitIdx(n); place(n, true); }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [photos.length, onClose, commitIdx, place]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (drag.current.active) return;                 // multi-touch: ignora il 2°
    const d = drag.current;
    d.active = true; d.pointerId = e.pointerId;
    d.startX = e.clientX; d.startY = e.clientY;
    d.dx = 0; d.dy = 0; d.axis = ''; d.startT = Date.now();
    d.w = overlayRef.current?.offsetWidth || window.innerWidth;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    if (trackRef.current) trackRef.current.style.transition = 'none';
    if (overlayRef.current) overlayRef.current.style.transition = 'none';
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active || e.pointerId !== d.pointerId) return;
    d.dx = e.clientX - d.startX;
    d.dy = e.clientY - d.startY;
    // Blocca l'asse alla prima soglia: evita ambiguità tra scorrere e chiudere
    if (!d.axis && (Math.abs(d.dx) > 8 || Math.abs(d.dy) > 8)) {
      d.axis = Math.abs(d.dx) > Math.abs(d.dy) ? 'x' : 'y';
    }
    const t = trackRef.current, o = overlayRef.current;
    if (!t || !o) return;

    if (d.axis === 'x') {
      // Resistenza ai bordi (prima/ultima foto): il movimento diminuisce
      let dx = d.dx;
      const atStart = idxRef.current === 0 && dx > 0;
      const atEnd   = idxRef.current === photos.length - 1 && dx < 0;
      if (atStart || atEnd) dx = dx * 0.3;
      t.style.transform = `translate3d(calc(${-idxRef.current * 100}% + ${dx}px), 0, 0)`;
    } else if (d.axis === 'y') {
      // Swipe giù per chiudere: la foto segue, lo sfondo si dissolve
      const dy = Math.max(0, d.dy);
      t.style.transform = `translate3d(${-idxRef.current * 100}%, ${dy}px, 0)`;
      const fade = Math.max(0.4, 0.97 - dy / 400);
      o.style.background = `rgba(0,0,0,${fade})`;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active || e.pointerId !== d.pointerId) return;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    const dt = Math.max(1, Date.now() - d.startT);

    if (d.axis === 'y') {
      const vy = d.dy / dt;
      if (d.dy > DISMISS_DISTANCE || vy > VELOCITY) { animateClose(d.dy); return; }
      place(idxRef.current, true); // torna su
    } else if (d.axis === 'x') {
      const vx = d.dx / dt;
      const goNext = (d.dx < -SWIPE_DISTANCE || vx < -VELOCITY) && idxRef.current < photos.length - 1;
      const goPrev = (d.dx >  SWIPE_DISTANCE || vx >  VELOCITY) && idxRef.current > 0;
      const n = goNext ? idxRef.current + 1 : goPrev ? idxRef.current - 1 : idxRef.current;
      if (n !== idxRef.current) commitIdx(n);
      place(n, true);
    }
    d.active = false; d.pointerId = -1; d.axis = '';
  };

  const animateClose = (fromDy: number) => {
    const t = trackRef.current, o = overlayRef.current;
    if (t) {
      t.style.transition = `transform 0.25s ${MOVE_EASE}`;
      t.style.transform = `translate3d(${-idxRef.current * 100}%, ${Math.max(fromDy, 0) + 400}px, 0)`;
    }
    if (o) { o.style.transition = 'opacity 0.25s ease-out'; o.style.opacity = '0'; }
    setTimeout(onClose, 220);
    drag.current.active = false;
  };

  return (
    <div
      ref={overlayRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.97)',
        overflow: 'hidden', touchAction: 'none',
        animation: 'lbIn 0.2s ease-out',
      }}
    >
      {/* Track: tutte le foto in fila, traslata per foto corrente */}
      <div
        ref={trackRef}
        style={{
          display: 'flex', height: '100%', width: '100%',
          willChange: 'transform',
        }}
      >
        {photos.map((p) => (
          <div key={p.url} style={{ flexShrink: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={p.url} alt="" draggable={false}
              style={{ maxWidth: '96vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 6, pointerEvents: 'none', userSelect: 'none' }} />
          </div>
        ))}
      </div>

      {/* Chiudi */}
      <button onClick={onClose} aria-label="Chiudi"
        style={{ position: 'absolute', top: 'calc(12px + env(safe-area-inset-top,0))', right: 14, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 44, height: 44, fontSize: 20, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, backdropFilter: 'blur(6px)' }}>✕</button>

      {/* Frecce desktop (nascoste su touch) */}
      {photos.length > 1 && (
        <>
          <button className="carousel-arrow" aria-label="Precedente"
            onClick={() => { if (idxRef.current > 0) { const n = idxRef.current - 1; commitIdx(n); place(n, true); } }}
            style={lbArrow('left')}>‹</button>
          <button className="carousel-arrow" aria-label="Successiva"
            onClick={() => { if (idxRef.current < photos.length - 1) { const n = idxRef.current + 1; commitIdx(n); place(n, true); } }}
            style={lbArrow('right')}>›</button>
        </>
      )}

      {/* Dots */}
      {photos.length > 1 && (
        <div style={{ position: 'absolute', bottom: 'calc(24px + env(safe-area-inset-bottom,0))', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, zIndex: 2 }}>
          {photos.map((_, i) => (
            <div key={i} style={{ width: i === idx ? 20 : 6, height: 6, borderRadius: 3, background: i === idx ? 'var(--orange)' : 'rgba(255,255,255,0.35)', transition: `width 0.2s ${MOVE_EASE}` }} />
          ))}
        </div>
      )}

      {/* Credit + contatore */}
      <div style={{ position: 'absolute', top: 'calc(16px + env(safe-area-inset-top,0))', left: 16, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.55)', zIndex: 2 }}>
        {idx + 1} / {photos.length}{photos[idx]?.credit_name ? `  ·  📷 ${photos[idx].credit_name}` : ''}
      </div>
    </div>
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

function lbArrow(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', top: '50%', [side]: 12,
    transform: 'translateY(-50%)',
    background: 'rgba(255,255,255,0.1)', border: 'none',
    borderRadius: '50%', width: 52, height: 52,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 28, cursor: 'pointer', lineHeight: 1, padding: 0,
    zIndex: 2,
  };
}
