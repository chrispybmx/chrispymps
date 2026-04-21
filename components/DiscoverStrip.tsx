'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SpotMapPin } from '@/lib/types';
import { TIPI_SPOT } from '@/lib/constants';

interface DiscoverStripProps {
  spots:       SpotMapPin[];
  onSpotClick: (pin: SpotMapPin) => void;
}

const MESSAGES = [
  '👀 Hai visto questo spot?',
  '🏴 Spot del momento:',
  '📍 Nuovo da esplorare:',
  '🔥 Spot consigliato:',
  '⚡ Check this out:',
];

export default function DiscoverStrip({ spots, onSpotClick }: DiscoverStripProps) {
  const [current,  setCurrent]  = useState<SpotMapPin | null>(null);
  const [message,  setMessage]  = useState(MESSAGES[0]);
  const [visible,  setVisible]  = useState(false);
  const [sliding,  setSliding]  = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const pickRandom = useCallback(() => {
    if (spots.length === 0) return;
    const alive = spots.filter(s => s.condition === 'alive');
    const pool  = alive.length > 0 ? alive : spots;
    const spot  = pool[Math.floor(Math.random() * pool.length)];
    const msg   = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    return { spot, msg };
  }, [spots]);

  // Prima apparizione dopo 4 secondi
  useEffect(() => {
    if (spots.length === 0 || dismissed) return;
    const t = setTimeout(() => {
      const r = pickRandom();
      if (!r) return;
      setCurrent(r.spot);
      setMessage(r.msg);
      setVisible(true);
    }, 4000);
    return () => clearTimeout(t);
  }, [spots, dismissed]);

  // Ciclo ogni 12 secondi
  useEffect(() => {
    if (!visible || dismissed || spots.length === 0) return;
    const t = setInterval(() => {
      setSliding(true);
      setTimeout(() => {
        const r = pickRandom();
        if (r) { setCurrent(r.spot); setMessage(r.msg); }
        setSliding(false);
      }, 280);
    }, 12000);
    return () => clearInterval(t);
  }, [visible, dismissed, spots, pickRandom]);

  if (!visible || !current || dismissed) return null;

  const tipo = TIPI_SPOT[current.type];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(var(--strip-height, 48px) + env(safe-area-inset-bottom))',
        left: 0, right: 0,
        zIndex: 35,
        padding: '0 12px 8px',
        pointerEvents: 'none',
      }}
    >
      <div
        onClick={() => onSpotClick(current)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(26,26,26,0.97)',
          border: '1px solid var(--orange)',
          borderRadius: 8,
          padding: '10px 14px',
          cursor: 'pointer',
          pointerEvents: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,106,0,0.1)',
          opacity: sliding ? 0 : 1,
          transform: sliding ? 'translateY(8px)' : 'translateY(0)',
          transition: 'opacity 0.28s ease, transform 0.28s ease',
          animation: 'slideUp 0.4s ease-out',
        }}
      >
        {/* Emoji tipo */}
        <div style={{
          width: 40, height: 40, borderRadius: 8,
          background: 'rgba(255,106,0,0.12)',
          border: '1px solid rgba(255,106,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, flexShrink: 0,
        }}>
          {tipo.emoji}
        </div>

        {/* Testo */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>
            {message}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--bone)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {current.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 1 }}>
            {current.city ? `${current.city} · ` : ''}{tipo.label}
          </div>
        </div>

        {/* Arrow */}
        <div style={{ color: 'var(--orange)', fontSize: 22, flexShrink: 0 }}>›</div>

        {/* Dismiss */}
        <button
          onClick={e => { e.stopPropagation(); setDismissed(true); }}
          style={{
            background: 'none', border: 'none',
            color: 'var(--gray-400)', fontSize: 16,
            cursor: 'pointer', padding: '4px',
            flexShrink: 0, lineHeight: 1,
          }}
          aria-label="Chiudi suggerimento"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
