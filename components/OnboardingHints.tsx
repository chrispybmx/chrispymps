'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { COOKIE_KEY, COOKIE_DISMISSED_EVENT } from '@/components/CookieBanner';

const STORAGE_KEY = 'cmaps_onboarding_v2';

interface Props {
  /** Spot pubblicati in totale. 0 finché il fetch non è tornato. */
  totalSpots: number;
  /** Spot entro il raggio locale, se conosciamo la posizione. */
  nearbyCount?: number | null;
  /** Nome e distanza dello spot più vicino, se conosciuti. */
  nearest?: { name: string; km: number } | null;
  /** Porta l'utente sullo spot più vicino. */
  onGoToNearest?: () => void;
}

function formatKm(km: number): string {
  if (km < 1)  return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/**
 * Schermata di benvenuto.
 *
 * Prima erano tre slide di istruzioni ("tocca un pin", "usa la lente", "tocca il +"):
 * tre tap di attenzione chiesti prima di aver dato un solo motivo per restare, e
 * l'ultimo chiedeva già un contributo. Ora è una schermata sola che mostra un
 * risultato — quanti spot ci sono, quanti vicino a te — e un bottone che porta
 * direttamente sul più vicino. Le istruzioni restano ai microhint contestuali
 * (il drag hint del pannello).
 *
 * Compare solo dopo che l'informativa cookie è stata chiusa: i due livelli
 * sovrapposti tagliavano i bottoni di questa card sotto i 400px di larghezza.
 */
export default function OnboardingHints({ totalSpots, nearbyCount, nearest, onGoToNearest }: Props) {
  const user = useUser();
  const [visible, setVisible]     = useState(false);
  const [cookieDone, setCookieDone] = useState(false);

  /* Attende la chiusura dell'informativa cookie (o la sua assenza). */
  useEffect(() => {
    try {
      if (localStorage.getItem(COOKIE_KEY)) { setCookieDone(true); return; }
    } catch { setCookieDone(true); return; }

    const onDismissed = () => setCookieDone(true);
    window.addEventListener(COOKIE_DISMISSED_EVENT, onDismissed);
    return () => window.removeEventListener(COOKIE_DISMISSED_EVENT, onDismissed);
  }, []);

  useEffect(() => {
    if (!cookieDone) return;
    if (user === undefined) return;          // sessione ancora in caricamento
    if (user) {                              // già dentro → mai mostrare
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
      return;
    }
    if (totalSpots === 0) return;            // aspetta di avere un numero da mostrare

    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch { return; }

    /* Ritardo breve: la mappa ha già disegnato, la card non copre uno schermo vuoto. */
    const t = setTimeout(() => setVisible(true), 900);
    return () => clearTimeout(t);
  }, [cookieDone, user, totalSpots]);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
  };

  if (!visible) return null;

  const hasNearest = !!(nearest && onGoToNearest);

  return (
    <>
      <div
        onClick={dismiss}
        style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          background: 'rgba(0,0,0,0.72)',
          animation: 'fadeIn 0.3s ease-out',
        }}
      />

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
        padding: '22px 20px 20px',
        animation: 'slideUp 0.3s ease-out',
        boxShadow: '0 8px 40px rgba(255,106,0,0.15)',
      }}>

        {/* Il numero è il messaggio */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 44, lineHeight: 1,
          color: 'var(--orange)', textAlign: 'center', fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {totalSpots}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 12,
          color: 'var(--gray-400)', textAlign: 'center',
          marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          spot mappati dai rider
        </div>

        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 13,
          color: 'var(--bone)', textAlign: 'center',
          lineHeight: 1.6, margin: '16px 0 18px',
        }}>
          {hasNearest ? (
            <>
              Il più vicino a te è{' '}
              <span style={{ color: 'var(--orange)' }}>{nearest!.name}</span>,
              a {formatKm(nearest!.km)}.
              {typeof nearbyCount === 'number' && nearbyCount > 1 && (
                <> Ce ne sono altri {nearbyCount - 1} nella tua zona.</>
              )}
            </>
          ) : (
            <>Attiva la posizione per vedere quali hai vicino, oppure muovi la mappa per esplorare.</>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {hasNearest ? (
            <>
              <button onClick={dismiss} style={{
                flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12,
                padding: '11px', border: '1px solid var(--gray-600)',
                borderRadius: 6, background: 'transparent',
                color: 'var(--gray-400)', cursor: 'pointer',
              }}>
                ESPLORO
              </button>
              <button
                onClick={() => { dismiss(); onGoToNearest!(); }}
                style={{
                  flex: 2, fontFamily: 'var(--font-mono)', fontSize: 12,
                  padding: '11px', border: 'none',
                  borderRadius: 6, background: 'var(--orange)',
                  color: '#000', cursor: 'pointer', fontWeight: 700,
                  letterSpacing: '0.05em',
                }}
              >
                PORTAMI LÌ →
              </button>
            </>
          ) : (
            <button onClick={dismiss} style={{
              flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12,
              padding: '11px', border: 'none',
              borderRadius: 6, background: 'var(--orange)',
              color: '#000', cursor: 'pointer', fontWeight: 700,
              letterSpacing: '0.05em',
            }}>
              APRI LA MAPPA
            </button>
          )}
        </div>
      </div>
    </>
  );
}
