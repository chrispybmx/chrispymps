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
/** Sotto questo movimento è un tocco, non un trascinamento. */
const TOLLERANZA_TOCCO = 10;

export default function SfogliaClient() {
  const [carte,    setCarte]    = useState<Carta[]>([]);
  const [stato,    setStato]    = useState<'carico' | 'pronto' | 'anonimo' | 'finito'>('carico');
  const [piaciuti, setPiaciuti] = useState(0);
  const [token,    setToken]    = useState<string | null>(null);
  const [erroreSalvataggio, setErroreSalvataggio] = useState(false);
  const [indiceFoto, setIndiceFoto] = useState(0);

  /* Il trascinamento NON passa da React.
     Aggiornare lo stato a ogni pixel fa ridisegnare il componente decine di
     volte al secondo e il gesto si sente a scatti. Qui la carta viene spostata
     scrivendo direttamente sul nodo; lo stato torna in gioco solo quando il
     dito si stacca. */
  const cartaRef    = useRef<HTMLDivElement | null>(null);
  const timbroSi    = useRef<HTMLDivElement | null>(null);
  const timbroNo    = useRef<HTMLDivElement | null>(null);
  const partenza    = useRef<{ x: number; y: number } | null>(null);
  const spostamento = useRef({ x: 0, y: 0 });
  const inUscita    = useRef(false);

  const disegna = (dx: number, dy: number) => {
    const el = cartaRef.current;
    if (!el) return;
    el.style.transition = 'none';
    el.style.transform  = `translate(${dx}px, ${dy * 0.25}px) rotate(${dx / 18}deg)`;
    if (timbroSi.current) timbroSi.current.style.opacity = String(Math.min(1, Math.max(0, (dx - 20) / 70)));
    if (timbroNo.current) timbroNo.current.style.opacity = String(Math.min(1, Math.max(0, (-dx - 20) / 70)));
  };

  const riposiziona = () => {
    const el = cartaRef.current;
    if (el) { el.style.transition = 'transform 0.26s ease-out'; el.style.transform = ''; }
    if (timbroSi.current) timbroSi.current.style.opacity = '0';
    if (timbroNo.current) timbroNo.current.style.opacity = '0';
  };

  /* ── Mazzo ── */
  const caricaMazzo = useCallback(async (tk: string) => {
    const posizione = () => new Promise<string>(resolve => {
      if (!navigator.geolocation) return resolve('');
      navigator.geolocation.getCurrentPosition(
        p => resolve(`?lat=${p.coords.latitude}&lon=${p.coords.longitude}`),
        () => resolve(''),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 },
      );
    });

    const j = await fetch(`/api/swipe${await posizione()}`, {
      headers: { Authorization: `Bearer ${tk}` },
    }).then(r => r.json()).catch(() => null);

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
    if (inUscita.current) return;
    const carta = carte[0];
    if (!carta || !token) return;

    inUscita.current = true;
    const el = cartaRef.current;
    if (el) {
      el.style.transition = 'transform 0.26s ease-out';
      el.style.transform  = `translateX(${direzione === 'like' ? 700 : -700}px) rotate(${direzione === 'like' ? 22 : -22}deg)`;
    }
    if (direzione === 'like') setPiaciuti(n => n + 1);

    /* Se il salvataggio fallisce la carta torna nel mazzo: farla sparire
       lasciando credere di aver salvato è peggio che mostrare un errore. */
    fetch('/api/swipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ spotId: carta.id, direction: direzione }),
    })
      .then(r => r.json().catch(() => null))
      .then(j => { if (!j?.ok) throw new Error('salvataggio non riuscito'); })
      .catch(() => {
        if (direzione === 'like') setPiaciuti(n => Math.max(0, n - 1));
        setErroreSalvataggio(true);
        setCarte(prev => (prev.some(c => c.id === carta.id) ? prev : [carta, ...prev]));
        setStato('pronto');
      });

    setTimeout(() => {
      spostamento.current = { x: 0, y: 0 };
      inUscita.current = false;
      setIndiceFoto(0);
      if (cartaRef.current) { cartaRef.current.style.transition = 'none'; cartaRef.current.style.transform = ''; }
      if (timbroSi.current) timbroSi.current.style.opacity = '0';
      if (timbroNo.current) timbroNo.current.style.opacity = '0';
      setCarte(prev => {
        const resto = prev.slice(1);
        if (!resto.length) setStato('finito');
        return resto;
      });
    }, 260);
  }, [carte, token]);

  /* ── Gesto ── */
  const giu = (e: React.PointerEvent<HTMLDivElement>) => {
    if (inUscita.current) return;
    partenza.current = { x: e.clientX, y: e.clientY };
    spostamento.current = { x: 0, y: 0 };
  };

  const muovi = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!partenza.current) return;
    spostamento.current = {
      x: e.clientX - partenza.current.x,
      y: e.clientY - partenza.current.y,
    };
    disegna(spostamento.current.x, spostamento.current.y);
  };

  const su = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!partenza.current) return;
    const { x: dx, y: dy } = spostamento.current;
    const inizio = partenza.current;
    partenza.current = null;

    if (dx > SOGLIA)  { vota('like'); return; }
    if (dx < -SOGLIA) { vota('pass'); return; }

    /* Movimento minimo: è un tocco. Metà destra avanti, metà sinistra
       indietro, come su Tinder. */
    if (Math.abs(dx) < TOLLERANZA_TOCCO && Math.abs(dy) < TOLLERANZA_TOCCO) {
      const quante = carte[0]?.foto.length ?? 0;
      if (quante > 1) {
        const r = e.currentTarget.getBoundingClientRect();
        const versoDestra = inizio.x - r.left > r.width / 2;
        setIndiceFoto(i => (versoDestra ? (i + 1) % quante : (i - 1 + quante) % quante));
      }
    }
    riposiziona();
  };

  /* Frecce da tastiera: stessa cosa, senza dito. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (stato !== 'pronto') return;
      if (e.key === 'ArrowRight') vota('like');
      if (e.key === 'ArrowLeft')  vota('pass');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stato, vota]);

  /* ── Stati senza carte ── */
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
      emoji="🗺️"
      titolo={piaciuti ? `${piaciuti} spot salvati` : 'Li hai visti tutti'}
      testo="Ora vai a esplorare la città e trovane di nuovi: quelli che aggiungi tu finiscono qui per tutti gli altri."
      azione={{ href: '/map', testo: 'Apri la mappa' }}
      azioneSecondaria={piaciuti ? { href: '/preferiti', testo: '❤️ Vedi quelli che hai salvato' } : undefined}
    />
  );

  const carta = carte[0];
  const sotto = carte[1];

  return (
    <div style={{ padding: '12px 16px 0', maxWidth: 520, margin: '0 auto' }}>

      {erroreSalvataggio && (
        <div role="alert" style={{
          background: 'rgba(255,77,77,0.1)', border: '1px solid rgba(255,77,77,0.4)',
          borderRadius: 8, padding: '9px 12px', marginBottom: 10,
          fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff8080',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
        }}>
          <span>Voto non salvato: la carta è tornata nel mazzo.</span>
          <button onClick={() => setErroreSalvataggio(false)}
            style={{ background: 'none', border: 'none', color: '#ff8080', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)',
        marginBottom: 10,
      }}>
        <span>{carte.length} da vedere</span>
        {piaciuti > 0 && <Link href="/preferiti" style={{ color: 'var(--orange)', textDecoration: 'none' }}>❤️ {piaciuti} salvati</Link>}
      </div>

      <div style={{ position: 'relative', height: 'min(66vh, 520px)' }}>
        {sotto && <CartaVista dati={sotto} dietro />}
        <CartaVista
          key={carta.id}
          dati={carta}
          indiceFoto={indiceFoto}
          riferimento={cartaRef}
          timbroSi={timbroSi}
          timbroNo={timbroNo}
          onPointerDown={giu}
          onPointerMove={muovi}
          onPointerUp={su}
          onPointerCancel={su}
        />
      </div>

      <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 18 }}>
        <button onClick={() => vota('pass')} aria-label="Passo" style={tondo('#3a3a3a')}>✕</button>
        <button onClick={() => vota('like')} aria-label="Mi piace" style={tondo('var(--orange)')}>❤️</button>
      </div>
      <div style={{
        textAlign: 'center', marginTop: 10, marginBottom: 16,
        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-600)', lineHeight: 1.6,
      }}>
        trascina per votare · tocca la foto per vederle tutte · tocca il nome per aprire lo spot
      </div>
    </div>
  );
}

/* ── Carta ── */
function CartaVista({
  dati, dietro, indiceFoto = 0, riferimento, timbroSi, timbroNo, ...handlers
}: {
  dati: Carta;
  dietro?: boolean;
  indiceFoto?: number;
  riferimento?: React.RefObject<HTMLDivElement>;
  timbroSi?: React.RefObject<HTMLDivElement>;
  timbroNo?: React.RefObject<HTMLDivElement>;
} & React.HTMLAttributes<HTMLDivElement>) {
  const tipo   = TIPI_SPOT[dati.type];
  const quante = dati.foto.length;
  const foto   = dati.foto[Math.min(indiceFoto, quante - 1)] ?? dati.foto[0];

  return (
    <div
      ref={dietro ? undefined : riferimento}
      {...handlers}
      style={{
        position: 'absolute', inset: 0,
        borderRadius: 16, overflow: 'hidden',
        background: 'var(--gray-800)',
        border: '1px solid var(--gray-700)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        transform: dietro ? 'scale(0.95) translateY(10px)' : undefined,
        touchAction: 'none',
        cursor: dietro ? 'default' : 'grab',
        zIndex: dietro ? 1 : 2,
        userSelect: 'none',
        willChange: dietro ? undefined : 'transform',
      }}
    >
      <img
        src={foto}
        alt=""
        draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
      />

      {/* Puntini: senza, nessuno scopre che ci sono altre foto */}
      {quante > 1 && !dietro && (
        <div style={{
          position: 'absolute', top: 10, left: 10, right: 10,
          display: 'flex', gap: 4, pointerEvents: 'none',
        }}>
          {dati.foto.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i === Math.min(indiceFoto, quante - 1) ? '#fff' : 'rgba(255,255,255,0.35)',
            }} />
          ))}
        </div>
      )}

      {/* Timbri sempre presenti: l'opacità la muove il gesto, senza render */}
      {!dietro && (
        <>
          <div ref={timbroSi} style={timbro('like')}>MI PIACE</div>
          <div ref={timbroNo} style={timbro('pass')}>PASSO</div>
        </>
      )}

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
        <Link
          href={`/map/spot/${dati.slug}`}
          onPointerDown={e => e.stopPropagation()}
          style={{
            fontFamily: 'var(--font-mono)', fontSize: 19, color: 'var(--bone)',
            lineHeight: 1.2, textDecoration: 'none', pointerEvents: 'auto',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          {dati.name}
          <span style={{ fontSize: 12, color: 'var(--orange)' }}>↗</span>
        </Link>
        {dati.city && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', marginTop: 3 }}>
            📍 {dati.city}{dati.autore ? ` · @${dati.autore}` : ''}
          </div>
        )}
      </div>
    </div>
  );
}

function timbro(tipo: 'like' | 'pass'): React.CSSProperties {
  return {
    position: 'absolute', top: 26,
    [tipo === 'like' ? 'left' : 'right']: 22,
    transform: `rotate(${tipo === 'like' ? -14 : 14}deg)`,
    border: `3px solid ${tipo === 'like' ? 'var(--orange)' : '#999'}`,
    color: tipo === 'like' ? 'var(--orange)' : '#999',
    padding: '4px 14px', borderRadius: 8,
    fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700,
    letterSpacing: '0.08em', background: 'rgba(0,0,0,0.45)',
    opacity: 0, pointerEvents: 'none',
  } as React.CSSProperties;
}

function Messaggio({ emoji, titolo, testo, azione, azioneSecondaria }: {
  emoji?: string; titolo: string; testo?: string;
  azione?: { href: string; testo: string };
  azioneSecondaria?: { href: string; testo: string };
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
      {azioneSecondaria && (
        <div style={{ marginTop: 14 }}>
          <Link href={azioneSecondaria.href} style={{ fontSize: 12, color: 'var(--gray-400)' }}>
            {azioneSecondaria.testo}
          </Link>
        </div>
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
