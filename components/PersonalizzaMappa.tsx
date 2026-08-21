'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { DISCIPLINE, ANNO_INIZIO_MINIMO, type DisciplinaKey } from '@/lib/rider-profile';

interface Props {
  username: string;
  /** Chiamata sia se salva sia se salta: da qui in poi il flusso è lo stesso. */
  onFinito: () => void;
}

/**
 * Due domande subito dopo la registrazione.
 *
 * Non è un modulo: è "personalizza la mappa". Sta qui e non nella
 * registrazione perché a quel punto l'utente ha già ottenuto quello per cui
 * era venuto, quindi rispondere non gli costa niente — mentre ogni campo in
 * più prima dell'account costa iscritti.
 *
 * Si può saltare. Un dato mancante vale meno di un iscritto perso.
 */
export default function PersonalizzaMappa({ username, onFinito }: Props) {
  const [scelte, setScelte] = useState<DisciplinaKey[]>([]);
  const [anno,   setAnno]   = useState<number | ''>('');
  const [salvando, setSalvando] = useState(false);

  const annoMax = new Date().getFullYear();
  const anni = Array.from({ length: annoMax - ANNO_INIZIO_MINIMO + 1 }, (_, i) => annoMax - i);

  const attiva = (k: DisciplinaKey) =>
    setScelte(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);

  const salva = async () => {
    setSalvando(true);
    try {
      const { data } = await supabaseBrowser().auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        await fetch('/api/rider/details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            disciplines:     scelte,
            ridingSinceYear: anno || null,
            username,
          }),
        });
      }
    } catch { /* un dato in meno non blocca l'ingresso */ }
    finally { onFinito(); }
  };

  return (
    <div style={{ padding: '28px 24px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>🏴</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--orange)', marginBottom: 6 }}>
          Ci sei, @{username}
        </div>
        <p style={{ color: 'var(--gray-400)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          Due cose e la mappa parla la tua lingua.
        </p>
      </div>

      {/* Discipline */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          Con cosa giri
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DISCIPLINE.map(d => {
            const on = scelte.includes(d.key);
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => attiva(d.key)}
                style={{
                  flex: '1 1 40%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  padding: '13px 10px',
                  border: `1px solid ${on ? 'var(--orange)' : 'var(--gray-600)'}`,
                  background: on ? 'rgba(255,106,0,0.12)' : 'transparent',
                  color: on ? 'var(--orange)' : 'var(--bone)',
                  borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: 14,
                  transition: 'border-color 0.12s, background 0.12s',
                }}
              >
                <span style={{ fontSize: 18 }}>{d.emoji}</span> {d.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)', marginTop: 6 }}>
          Puoi sceglierne più di una.
        </div>
      </div>

      {/* Anno di inizio — una rondella, dato vero */}
      <div style={{ marginBottom: 26 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          Da che anno giri
        </div>
        <select
          aria-label="Anno di inizio"
          value={anno}
          onChange={e => setAnno(e.target.value ? Number(e.target.value) : '')}
          style={{
            width: '100%', background: 'var(--gray-700)',
            border: '1px solid var(--gray-600)', borderRadius: 6,
            color: 'var(--bone)', fontSize: 15, padding: '12px 10px',
            fontFamily: 'inherit', outline: 'none',
            appearance: 'none', WebkitAppearance: 'none',
          }}
        >
          <option value="">Scegli l&apos;anno</option>
          {anni.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <button
        onClick={salva}
        disabled={salvando}
        className="btn-primary"
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {salvando ? 'Salvo…' : 'FATTO →'}
      </button>

      <button
        onClick={onFinito}
        style={{
          width: '100%', marginTop: 10, background: 'none', border: 'none',
          color: 'var(--gray-500)', fontFamily: 'var(--font-mono)', fontSize: 12,
          cursor: 'pointer', padding: '8px',
        }}
      >
        lo faccio dopo
      </button>
    </div>
  );
}
