'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { TIPI_SPOT } from '@/lib/constants';
import type { SpotType } from '@/lib/types';

interface Carta {
  id: string;
  slug: string;
  name: string;
  type: SpotType;
  city: string | null;
  region: string | null;
  description: string | null;
  autore: string | null;
  foto: string[];
  km: number | null;
}

type Direzione = 'like' | 'pass';

/** Oltre questo trascinamento la carta parte. */
const SOGLIA = 90;

export default function SfogliaClient() {
  const [carte,   setCarte]   = useState<Carta[]>([]);
  const [stato,   setStato]   = useState<'carico' | 'pronto' | 'anonimo' | 'finito'>('carico');
  const [piaciuti, setPiaciuti] = useState(0);
  const [token,   setToken]   = useState<string | null>(null);

  /* Trascinamento della carta in cima. Tenuto in ref durante il gesto e
     riversato nello stato solo per il render: muovere lo stato a ogni
     pixel farebbe scattare l'animazione. */
  const [drag, setDrag] = useState({ x: 0, y: 0, attivo: false });
  const [erroreSalvataggio, setErroreSalvataggio] = useState(false);
  const partenza = useRef<{ x: number; y: number } | null>(null);
  const [uscita, setUscita] = useState<Direzione | null>(null);

  /* ── Mazzo ── */
  const caricaMazzo = useCallback(async (tk: string) => {
    const chiedi = (qs: string) =>
      fetch(`/api/swipe${qs}`, { headers: { Authorization: `Bearer ${tk}` } }).then(r => r.json());

    const conPosizione = () => new Promise<string>(resolve => {
      if (!navigator.geolocation) return resolve('');
      navigator.geolocation.getCurrentPosition(
        p => resolve(`?lat=${p.coords.latitude}&lon=${p.coords.longitude}`),
        () => resolve(''),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 },
      );
    });

    const j = await chiedi(await conPosizione()).catch(() => null);
    if (!j?.ok) { setStato('finito'); return; }
    setCarte(j.data ?? []);
    setStato((j.data ?? []).length ? 'pronto' : 'finito');
  }, []);

  useEffect(() => {
    supabaseBrowser().auth.getSession().then(({ data }) => {
      const tk = data.session?.access_token;
      if (!tk) { setStato('anonimo'); return; }
      setToken(tk);
      caricaMazzo(tk);
    });
  }, [caricaMazzo]);

  /* ── Voto ── */
  const vota = useCallback((direzione: Direzione) => {
    const carta = carte[0];
    if (!carta || !token) return;

    setUscita(direzione);
    if (direzione === 'like') setPiaciuti(n => n + 1);

    /* Se il salvataggio fallisce la carta torna nel mazzo.
       Farla sparire lasciando credere di aver salvato e' peggio che mostrare
       un errore: il voto sarebbe perso e l'utente non lo saprebbe mai. */
    fetch('/api/swipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ spotId: carta.id, direction: direzione }),
    })
      .then(r => r.json().catch(() => null))
      .then(j => { if (!j?.ok) throw new Error(j?.error ?? 'salvataggio non riuscito'); })
      .catch(() => {
        if (direzione === 'like') setPiaciuti(n => Math.max(0, n - 1));
        setErroreSalvataggio(true);
        setCarte(prev => (prev.some(c => c.id === carta.id) ? prev : [carta, ...prev]));
        setStato('pronto');
      });

    /* Aspetta la fine dell'animazione prima di togliere la carta. */
    setTimeout(() => {
      setUscita(null);
      setDrag({ x: 0, y: 0, attivo: false });
      setCarte(prev => {
        const resto = prev.slice(1);
        if (!resto.length) setStato('finito');
        return resto;
      });
    }, 260);
  }, [carte, token]);

  /* ── Gesto ── */
  const giu = (e: React.PointerEvent) => {
    if (uscita) return;
    partenza.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0, attivo: true });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const muovi = (e: React.PointerEvent) => {
    if (!partenza.current) return;
    setDrag({ x: e.clientX - partenza.current.x, y: e.clientY - partenza.current.y, attivo: true });
  };
  const su = () => {
    if (!partenza.current) return;
    const dx = drag.x;
    partenza.current = null;
    if (dx > SOGLIA) vota('like');
    else if (dx < -SOGLIA) vota('pass');
    else setDrag({ x: 0, y: 0, attivo: false });
  };

  /* Frecce da tastiera: la stessa cosa, senza dito. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (stato !== 'pronto') return;
      if (e.key === 'ArrowRight') vota('like');
      if (e.key === 'ArrowLeft')  vota('pass');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stato, vota]);

  /* ── Stati non-carta ── */
  if (stato === 'carico') return <Messaggio titolo="Preparo il mazzo…" />;

  if (stato === 'anonimo') return (
    <Messaggio
      emoji="🔑"
      titolo="Serve un account"
      testo="I tuoi mi piace finiscono nella tua cartella, quindi serve sapere di chi sono."
      azione={{ href: '/map', testo: 'Vai alla mappa e accedi' }}
    />
  );

  if (stato === 'finito') return (
    <Messaggio
      emoji="🏁"
      titolo={piaciuti ? `${piaciuti} spot salvati` : 'Per ora è tutto'}
      testo={piaciuti
        ? 'Li trovi nella tua cartella. Torna quando la community aggiunge spot nuovi.'
        : 'Hai già visto tutti gli spot con una foto. Torna quando ne arrivano di nuovi.'}
      azione={{ href: '/preferiti', testo: '❤️ Apri la cartella' }}
    />
  );

  const carta   = carte[0];
  const sotto   = carte[1];
  const rot     = drag.x / 18;
  const versoLike = drag.x > 40;
  const versoPass = drag.x < -40;

  const trasformazione = uscita
    ? `translateX(${uscita === 'like' ? 700 : -700}px) rotate(${uscita === 'like' ? 22 : -22}deg)`
    : `translate(${drag.x}px, ${drag.y * 0.25}px) rotate(${rot}deg)`;

  return (
    <div style={{ padding: '12px 16px 0', maxWidth: 520, margin: '0 auto' }}>

      {erroreSalvataggio && (
        <div role="alert" style={{
          background: 'rgba(255,77,77,0.1)', border: '1px solid rgba(255,77,77,0.4)',
          borderRadius: 8, padding: '9px 12px', marginBottom: 10,
          fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff8080',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
        }}>
          <span>Voto non salvato: la carta e' tornata nel mazzo.</span>
          <button onClick={() => setErroreSalvataggio(false)}
            style={{ background: 'none', border: 'none', color: '#ff8080', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}

      {/* Contatore */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)',
        marginBottom: 10,
      }}>
        <span>{carte.length} da vedere</span>
        {piaciuti > 0 && <Link href="/preferiti" style={{ color: 'var(--orange)', textDecoration: 'none' }}>❤️ {piaciuti} salvati</Link>}
      </div>

      {/* Pila */}
      <div style={{ position: 'relative', height: 'min(66vh, 520px)' }}>
        {sotto && <Carta dati={sotto} dietro />}
        <Carta
          dati={carta}
          trasformazione={trasformazione}
          animata={!drag.attivo || !!uscita}
          onPointerDown={giu}
          onPointerMove={muovi}
          onPointerUp={su}
          onPointerCancel={su}
          etichetta={versoLike ? 'like' : versoPass ? 'pass' : null}
        />
      </div>

      {/* Bottoni: lo swipe non si scopre da solo */}
      <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 18 }}>
        <button onClick={() => vota('pass')} aria-label="Passo" style={tondo('#3a3a3a')}>✕</button>
        <button onClick={() => vota('like')} aria-label="Mi piace" style={tondo('var(--orange)')}>❤️</button>
      </div>
      <div style={{
        textAlign: 'center', marginTop: 10, marginBottom: 16,
        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-600)',
      }}>
        trascina la foto, o usa i bottoni
      </div>
    </div>
  );
}

/* ── Carta ── */
function Carta({
  dati, dietro, trasformazione, animata, etichetta, ...handlers
}: {
  dati: Carta;
  dietro?: boolean;
  trasformazione?: string;
  animata?: boolean;
  etichetta?: 'like' | 'pass' | null;
} & React.HTMLAttributes<HTMLDivElement>) {
  const tipo = TIPI_SPOT[dati.type];

  return (
    <div
      {...handlers}
      style={{
        position: 'absolute', inset: 0,
        borderRadius: 16, overflow: 'hidden',
        background: 'var(--gray-800)',
        border: '1px solid var(--gray-700)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        transform: dietro ? 'scale(0.95) translateY(10px)' : trasformazione,
        transition: animata ? 'transform 0.26s ease-out' : 'none',
        touchAction: 'none',
        cursor: dietro ? 'default' : 'grab',
        zIndex: dietro ? 1 : 2,
        userSelect: 'none',
      }}
    >
      <img
        src={dati.foto[0]}
        alt=""
        draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
      />

      {/* Timbro mentre trascini */}
      {etichetta && (
        <div style={{
          position: 'absolute', top: 24,
          [etichetta === 'like' ? 'left' : 'right']: 24,
          transform: `rotate(${etichetta === 'like' ? -14 : 14}deg)`,
          border: `3px solid ${etichetta === 'like' ? 'var(--orange)' : '#888'}`,
          color: etichetta === 'like' ? 'var(--orange)' : '#888',
          padding: '4px 14px', borderRadius: 8,
          fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700,
          letterSpacing: '0.08em', background: 'rgba(0,0,0,0.45)',
        } as React.CSSProperties}>
          {etichetta === 'like' ? 'MI PIACE' : 'PASSO'}
        </div>
      )}

      {/* Dati in basso */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '40px 16px 16px',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.9))',
        pointerEvents: 'none',
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: tipo.color, marginBottom: 4 }}>
          {tipo.emoji} {tipo.label.toUpperCase()}
          {dati.km !== null && <span style={{ color: 'var(--gray-400)' }}> · {dati.km < 10 ? dati.km.toFixed(1) : Math.round(dati.km)} km</span>}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 19, color: 'var(--bone)', lineHeight: 1.2 }}>
          {dati.name}
        </div>
        {dati.city && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', marginTop: 3 }}>
            📍 {dati.city}{dati.autore ? ` · @${dati.autore}` : ''}
          </div>
        )}
      </div>
    </div>
  );
}

function Messaggio({ emoji, titolo, testo, azione }: {
  emoji?: string; titolo: string; testo?: string;
  azione?: { href: string; testo: string };
}) {
  return (
    <div style={{ padding: '64px 24px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
      {emoji && <div style={{ fontSize: 44, marginBottom: 14 }}>{emoji}</div>}
      <div style={{ fontSize: 17, color: 'var(--orange)', marginBottom: 10 }}>{titolo}</div>
      {testo && <p style={{ fontSize: 13, color: 'var(--gray-400)', lineHeight: 1.6, maxWidth: 320, margin: '0 auto 22px' }}>{testo}</p>}
      {azione && (
        <Link href={azione.href} className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
          {azione.testo}
        </Link>
      )}
    </div>
  );
}

function tondo(colore: string): React.CSSProperties {
  return {
    width: 62, height: 62, borderRadius: '50%',
    border: `2px solid ${colore}`,
    background: 'rgba(0,0,0,0.3)',
    fontSize: 24, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent',
  };
}
