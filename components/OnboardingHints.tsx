'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';

const STORAGE_KEY = 'cmaps_onboarding_v1';

const HINTS = [
  {
    emoji: '🗺️',
    title: 'Esplora la mappa',
    text: 'Tocca un pin per vedere lo spot. Trascina il pannello in basso per sfogliare la lista.',
  },
  {
    emoji: '🔍',
    title: 'Cerca e filtra',
    text: 'Usa la lente per cercare spot, luoghi o utenti. Il bottone filtri ti aiuta a trovare il tipo di spot giusto.',
  },
  {
    emoji: '📍',
    title: 'Aggiungi uno spot',
    text: 'Tocca il + al centro della barra in basso per aggiungere un nuovo spot alla community.',
  },
];

export default function OnboardingHints() {
  const user = useUser();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Don't show if logged in or already seen
    if (user === undefined) return; // still loading auth
    if (user) {
      // Logged in → mark as seen, never show
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
      return;
    }
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const t = setTimeout(() => setVisible(true), 1500);
        return () => clearTimeout(t);
      }
    } catch {}
  }, [user]);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
  };

  const next = () => {
    if (step < HINTS.length - 1) setStep(s => s + 1);
    else dismiss();
  };

  if (!visible) return null;

  const hint = HINTS[step];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          background: 'rgba(0,0,0,0.7)',
          animation: 'fadeIn 0.3s ease-out',
        }}
      />

      {/* Card */}
      <div style={{
        position: 'fixed',
        bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9991,
        width: 'calc(100% - 40px)',
        maxWidth: 340,
        background: 'var(--gray-800)',
        border: '2px solid var(--orange)',
        borderRadius: 12,
        padding: '20px',
        animation: 'slideUp 0.3s ease-out',
        boxShadow: '0 8px 40px rgba(255,106,0,0.15)',
      }}>
        {/* Emoji */}
        <div style={{ fontSize: 36, marginBottom: 10, textAlign: 'center' }}>
          {hint.emoji}
        </div>

        {/* Title */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 16,
          color: 'var(--orange)', textAlign: 'center',
          marginBottom: 8, textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {hint.title}
        </div>

        {/* Text */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 13,
          color: 'var(--bone)', textAlign: 'center',
          lineHeight: 1.6, marginBottom: 16,
        }}>
          {hint.text}
        </div>

        {/* Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 14 }}>
          {HINTS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 18 : 6, height: 6,
              borderRadius: 3,
              background: i === step ? 'var(--orange)' : 'var(--gray-600)',
              transition: 'width 0.2s',
            }} />
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={dismiss}
            style={{
              flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12,
              padding: '10px', border: '1px solid var(--gray-600)',
              borderRadius: 6, background: 'transparent',
              color: 'var(--gray-400)', cursor: 'pointer',
            }}
          >
            SALTA
          </button>
          <button
            onClick={next}
            style={{
              flex: 2, fontFamily: 'var(--font-mono)', fontSize: 12,
              padding: '10px', border: 'none',
              borderRadius: 6, background: 'var(--orange)',
              color: '#000', cursor: 'pointer', fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            {step < HINTS.length - 1 ? 'AVANTI →' : 'INIZIA!'}
          </button>
        </div>
      </div>
    </>
  );
}
