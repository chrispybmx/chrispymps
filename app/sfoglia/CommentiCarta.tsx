'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Commento {
  id: string;
  username: string;
  text: string;
  created_at: string;
}

interface Props {
  slug: string;
  token: string | null;
  /** Chiuso, il pannello mostra solo il numero. */
  onChiudi: () => void;
}

/**
 * Commenti dentro la carta.
 *
 * Usa lo stesso `/api/comments/[slug]` della scheda spot: le notifiche al
 * proprietario e le risposte esistono già lì, e un secondo sistema di commenti
 * significherebbe una seconda moderazione da tenere in piedi.
 */
export default function CommentiCarta({ slug, token, onChiudi }: Props) {
  const [commenti, setCommenti] = useState<Commento[] | null>(null);
  const [testo, setTesto]       = useState('');
  const [invio, setInvio]       = useState(false);
  const [errore, setErrore]     = useState<string | null>(null);
  const campo = useRef<HTMLInputElement | null>(null);

  const carica = useCallback(() => {
    fetch(`/api/comments/${slug}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      .then(r => r.json())
      .then(j => setCommenti(j.ok ? (j.data ?? []) : []))
      .catch(() => setCommenti([]));
  }, [slug, token]);

  useEffect(() => { carica(); }, [carica]);
  useEffect(() => { campo.current?.focus(); }, []);

  const invia = async () => {
    const pulito = testo.trim();
    if (!pulito || !token || invio) return;
    setInvio(true);
    setErrore(null);
    try {
      const r = await fetch(`/api/comments/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: pulito }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) throw new Error(j?.error ?? 'Commento non inviato');
      setTesto('');
      carica();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Commento non inviato');
    } finally {
      setInvio(false);
    }
  };

  return (
    <div
      /* Il pannello sta sopra la carta: senza fermare qui i gesti, scrivere
         farebbe partire un trascinamento e il commento volerebbe via. */
      onPointerDown={e => e.stopPropagation()}
      onPointerMove={e => e.stopPropagation()}
      onPointerUp={e => e.stopPropagation()}
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, top: '38%',
        background: 'rgba(10,10,10,0.96)', backdropFilter: 'blur(10px)',
        borderTop: '1px solid var(--gray-700)',
        borderRadius: '14px 14px 0 0',
        display: 'flex', flexDirection: 'column',
        zIndex: 5, touchAction: 'auto',
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', borderBottom: '1px solid var(--gray-800)',
        fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)',
      }}>
        <span>Commenti{commenti ? ` · ${commenti.length}` : ''}</span>
        <button onClick={onChiudi} aria-label="Chiudi commenti"
          style={{ background: 'none', border: 'none', color: 'var(--gray-400)', fontSize: 16, cursor: 'pointer' }}>
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
        {commenti === null && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-600)' }}>carico…</div>
        )}
        {commenti?.length === 0 && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.6 }}>
            Nessun commento. Se ci sei stato, scrivi com&apos;è messo: è l&apos;informazione che serve a chi ci va dopo.
          </div>
        )}
        {commenti?.map(c => (
          <div key={c.id} style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)' }}>
              @{c.username}
            </div>
            <div style={{ fontSize: 13, color: 'var(--bone)', lineHeight: 1.5, wordBreak: 'break-word' }}>
              {c.text}
            </div>
          </div>
        ))}
      </div>

      {errore && (
        <div style={{ padding: '0 14px 6px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff8080' }}>
          {errore}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--gray-800)' }}>
        <input
          ref={campo}
          value={testo}
          onChange={e => setTesto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') invia(); }}
          placeholder={token ? 'Scrivi qualcosa…' : 'Accedi per commentare'}
          disabled={!token}
          maxLength={500}
          style={{
            flex: 1, background: 'var(--gray-800)', border: '1px solid var(--gray-700)',
            borderRadius: 8, color: 'var(--bone)', fontSize: 14, padding: '10px 12px',
            fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button
          onClick={invia}
          disabled={!token || !testo.trim() || invio}
          style={{
            padding: '0 16px', borderRadius: 8, border: 'none',
            background: (!token || !testo.trim() || invio) ? 'var(--gray-700)' : 'var(--orange)',
            color: (!token || !testo.trim() || invio) ? 'var(--gray-500)' : '#000',
            fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
            cursor: (!token || !testo.trim() || invio) ? 'default' : 'pointer',
          }}
        >
          {invio ? '…' : 'Invia'}
        </button>
      </div>
    </div>
  );
}
