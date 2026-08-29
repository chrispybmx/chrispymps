'use client';

import { useEffect, useState, useCallback } from 'react';
import { TIPI_SPOT, TIPI_SPOT_SELEZIONABILI, OSTACOLI } from '@/lib/constants';
import { miniatura } from '@/lib/immagini';
import type { Ostacolo, SpotType } from '@/lib/types';

/**
 * Assegna il contesto agli spot rimasti a meta' dalla riforma del 24/08.
 *
 * Quando `type` e' stato separato in «dove sei» e «cosa c'e'», 39 spot erano
 * catalogati per OSTACOLO invece che per contesto: `rail`, `ledge`, `gap`,
 * `bowl`. La migration ha spostato quel valore in `ostacoli`, dove sta bene,
 * ma NON ha toccato `type` — perche' capire se un bowl e' dentro un park o e'
 * un DIY richiede di guardare la foto, e quella e' una decisione di chi
 * conosce gli spot, non una regola da scrivere.
 *
 * Quindi questa schermata fa una cosa sola: mostra la foto grande e sei
 * bottoni. Niente moduli, niente campi. La foto e' l'unica informazione che
 * serve per decidere, quindi occupa quasi tutto lo spazio.
 *
 * Non aggiunge nessuna rotta: legge da /api/spots e scrive con
 * /api/admin/edit-spot, che accetta gia' `type` ed e' gia' validata.
 */

interface Spot {
  id: string;
  name: string;
  slug: string;
  type: SpotType;
  city?: string;
  cover_url?: string;
  photo_urls?: string[];
  ostacoli?: Ostacolo[];
}

/** I valori che erano ostacoli finiti nel campo sbagliato. */
const DA_SISTEMARE: SpotType[] = ['rail', 'ledge', 'gap', 'bowl', 'transition'];

const mono = 'var(--font-mono)';

export default function AdminContesti() {
  const [coda,     setCoda]     = useState<Spot[]>([]);
  const [i,        setI]        = useState(0);
  const [foto,     setFoto]     = useState(0);
  const [inCorso,  setInCorso]  = useState<SpotType | null>(null);
  const [errore,   setErrore]   = useState<string | null>(null);
  const [fatti,    setFatti]    = useState(0);
  const [caricando,setCaricando]= useState(true);

  useEffect(() => {
    fetch('/api/spots')
      .then(r => r.json())
      .then(j => {
        if (!j.ok) return;
        setCoda((j.data ?? []).filter((s: Spot) => DA_SISTEMARE.includes(s.type)));
      })
      .catch(() => {})
      .finally(() => setCaricando(false));
  }, []);

  const spot = coda[i];

  const assegna = useCallback(async (tipo: SpotType) => {
    if (!spot) return;
    setInCorso(tipo);
    setErrore(null);
    try {
      const res = await fetch('/api/admin/edit-spot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: spot.id, type: tipo }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.ok === false) throw new Error(j.error ?? 'Non è andata.');
      setFatti(n => n + 1);
      setFoto(0);
      setI(n => n + 1);
    } catch (e) {
      /* Se il salvataggio fallisce lo spot NON avanza: altrimenti spariva
         dalla coda senza essere stato salvato, ed e' il modo migliore per
         perdere lavoro senza accorgersene. */
      setErrore(e instanceof Error ? e.message : 'Errore. Riprova.');
    } finally {
      setInCorso(null);
    }
  }, [spot]);

  if (caricando) {
    return <div style={{ padding: 40, textAlign: 'center', fontFamily: mono, color: 'var(--gray-500)' }}>Caricamento...</div>;
  }

  if (coda.length === 0) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', fontFamily: mono }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
        <div style={{ color: 'var(--bone)', fontSize: 15 }}>Nessuno spot da sistemare.</div>
        <div style={{ color: 'var(--gray-500)', fontSize: 12, marginTop: 8 }}>
          Tutti hanno già un contesto.
        </div>
      </div>
    );
  }

  if (!spot) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', fontFamily: mono }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🏁</div>
        <div style={{ color: 'var(--orange)', fontSize: 18 }}>Finito.</div>
        <div style={{ color: 'var(--gray-400)', fontSize: 13, marginTop: 8 }}>
          {fatti} spot sistemati. Ricarica per vedere se ne restano.
        </div>
      </div>
    );
  }

  const tutte  = spot.photo_urls?.length ? spot.photo_urls : spot.cover_url ? [spot.cover_url] : [];
  const attuale = tutte[foto];
  const vecchio = TIPI_SPOT[spot.type];

  return (
    <div style={{ padding: '16px 20px 0', maxWidth: 620, margin: '0 auto' }}>

      {/* Avanzamento */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 4, background: 'var(--gray-700)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${(i / coda.length) * 100}%`, height: '100%', background: 'var(--orange)', transition: 'width .2s' }} />
        </div>
        <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--gray-400)', fontVariantNumeric: 'tabular-nums' }}>
          {i + 1} di {coda.length}
        </span>
      </div>

      {/* La foto: e' l'unica cosa che serve per decidere, quindi comanda lei. */}
      {attuale && (
        <div style={{ position: 'relative', background: '#000', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
          <img
            src={miniatura(attuale, 800)}
            alt={spot.name}
            style={{ width: '100%', height: 'clamp(220px, 42vh, 380px)', objectFit: 'cover', display: 'block' }}
          />
          {tutte.length > 1 && (
            <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5 }}>
              {tutte.map((_, k) => (
                <button
                  key={k}
                  onClick={() => setFoto(k)}
                  aria-label={`Foto ${k + 1}`}
                  style={{
                    width: k === foto ? 20 : 7, height: 7, borderRadius: 4, border: 'none', padding: 0,
                    background: k === foto ? 'var(--orange)' : 'rgba(255,255,255,0.45)',
                    cursor: 'pointer', transition: 'all .2s',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cosa stiamo guardando */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: mono, fontSize: 17, color: 'var(--bone)', lineHeight: 1.25 }}>
          {spot.name}
        </div>
        <div style={{ fontFamily: mono, fontSize: 12, color: 'var(--gray-500)', marginTop: 5, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {spot.city && <span>📍 {spot.city}</span>}
          <span>era: {vecchio?.label ?? spot.type}</span>
          {spot.ostacoli?.length ? (
            <span style={{ color: 'var(--gray-400)' }}>
              ostacoli: {spot.ostacoli.map(o => OSTACOLI[o]?.label ?? o).join(', ')}
            </span>
          ) : null}
          <a href={`/map/spot/${spot.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--orange)' }}>
            apri la scheda →
          </a>
        </div>
      </div>

      {errore && (
        <div style={{
          fontFamily: mono, fontSize: 13, color: '#e08c7e', marginBottom: 12,
          background: 'rgba(217,106,90,0.08)', border: '1px solid rgba(217,106,90,0.4)',
          borderRadius: 8, padding: '10px 12px',
        }}>
          {errore} — lo spot resta qui, non è stato saltato.
        </div>
      )}

      {/* Sei bottoni, uno per contesto */}
      <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
        Dove si trova?
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 8 }}>
        {TIPI_SPOT_SELEZIONABILI.map(([t, info]) => (
          <button
            key={t}
            onClick={() => assegna(t)}
            disabled={inCorso !== null}
            style={{
              padding: '14px 8px', borderRadius: 10,
              border: `1px solid ${inCorso === t ? info.color : 'var(--gray-600)'}`,
              background: inCorso === t ? info.color : 'transparent',
              color: inCorso === t ? '#000' : 'var(--bone)',
              fontFamily: mono, fontSize: 13,
              cursor: inCorso ? 'default' : 'pointer',
              opacity: inCorso && inCorso !== t ? 0.4 : 1,
              transition: 'all .12s',
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 3 }}>{info.emoji}</div>
            {info.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
        <button
          onClick={() => { setFoto(0); setErrore(null); setI(n => n + 1); }}
          disabled={inCorso !== null}
          style={{
            fontFamily: mono, fontSize: 12, padding: '9px 14px', borderRadius: 8,
            border: '1px solid var(--gray-700)', background: 'transparent',
            color: 'var(--gray-400)', cursor: 'pointer',
          }}
        >
          Salta →
        </button>
        {i > 0 && (
          <button
            onClick={() => { setFoto(0); setErrore(null); setI(n => Math.max(0, n - 1)); }}
            disabled={inCorso !== null}
            style={{
              fontFamily: mono, fontSize: 12, padding: '9px 14px', borderRadius: 8,
              border: '1px solid var(--gray-700)', background: 'transparent',
              color: 'var(--gray-400)', cursor: 'pointer',
            }}
          >
            ← Indietro
          </button>
        )}
        <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--gray-600)', marginLeft: 'auto' }}>
          {fatti} sistemati
        </span>
      </div>
    </div>
  );
}
