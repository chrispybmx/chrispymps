'use client';

import { useEffect, useState } from 'react';
import type { NearbyEvent } from '@/app/api/events/nearby/route';

interface Props {
  /** Posizione dell'utente; senza questa non sappiamo cosa gli è vicino. */
  userPos: { lat: number; lon: number } | null;
}

/**
 * Striscia "c'è un jam vicino" sulla mappa.
 *
 * Sostituisce JamBanner, che era cablato su un singolo evento (Colle del Cemento
 * V4, 6 giugno 2026) e si auto-nascondeva a evento passato: da metà giugno era
 * uno slot morto. Nel frattempo il calendario conteneva un jam a Mestre a dieci
 * giorni di distanza, raggiungibile solo passando dal menu laterale.
 *
 * Regola: si mostra solo se c'è un evento davvero vicino e davvero imminente.
 * Un banner che compare sempre smette di essere un segnale.
 */
export default function NearbyEventBanner({ userPos }: Props) {
  const [event, setEvent]         = useState<NearbyEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!userPos) return;
    let cancelled = false;

    fetch(`/api/events/nearby?lat=${userPos.lat}&lon=${userPos.lon}`)
      .then(r => r.json())
      .then((j: { ok: boolean; data?: NearbyEvent[] }) => {
        if (cancelled || !j.ok || !j.data?.length) return;
        const next = j.data[0];
        try {
          if (sessionStorage.getItem(`cmaps_event_banner_off_${next.id}`)) return;
        } catch { /* sessionStorage non disponibile → mostriamo comunque */ }
        setEvent(next);
      })
      .catch(() => { /* nessun banner, nessun rumore */ });

    return () => { cancelled = true; };
  }, [userPos]);

  if (!event || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(`cmaps_event_banner_off_${event.id}`, '1'); } catch {}
  };

  const when =
    event.daysAway === 0 ? 'oggi'
    : event.daysAway === 1 ? 'domani'
    : `fra ${event.daysAway} giorni`;

  const distance = event.km < 1
    ? 'qui vicino'
    : `${event.km < 10 ? event.km.toFixed(1) : Math.round(event.km)} km da te`;

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(68px + env(safe-area-inset-bottom, 0px))',
      left: 12, right: 12,
      zIndex: 50,
      animation: 'slideUp 0.35s ease-out',
    }}>
      <a
        href={event.link_url || '/events'}
        {...(event.link_url ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'linear-gradient(135deg, #1c1208 0%, #0f0f0f 100%)',
          border: '1px solid rgba(255,106,0,0.42)',
          borderRadius: 14, padding: '10px 14px',
          textDecoration: 'none', color: 'var(--bone)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 30px rgba(255,106,0,0.12)',
        }}
      >
        {event.cover_url ? (
          <img
            src={event.cover_url} alt=""
            style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div style={{
            width: 44, height: 44, borderRadius: 8, flexShrink: 0,
            background: 'rgba(255,106,0,0.12)', border: '1px solid rgba(255,106,0,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>
            🏴
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, lineHeight: 1.2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {event.title}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)', marginTop: 2 }}>
            {when}
            {event.city ? ` · ${event.city}` : ''}
            {' · '}{distance}
          </div>
        </div>

        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
          background: 'var(--orange)', color: '#000',
          borderRadius: 6, padding: '6px 12px',
          whiteSpace: 'nowrap', textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          Vedi
        </div>
      </a>

      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismiss(); }}
        aria-label="Nascondi evento"
        style={{
          position: 'absolute', top: -6, right: -2,
          width: 22, height: 22, borderRadius: '50%',
          background: 'var(--gray-800)', border: '1px solid var(--gray-600)',
          color: 'var(--gray-400)', fontSize: 12, lineHeight: 1,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ✕
      </button>
    </div>
  );
}
