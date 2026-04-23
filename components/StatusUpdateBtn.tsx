'use client';

import { useState } from 'react';
import type { SpotCondition } from '@/lib/types';

const CONDITIONS: { value: SpotCondition; label: string; color: string; bg: string; desc: string }[] = [
  { value: 'alive',    label: 'Alive',    color: '#000',    bg: '#00c851', desc: 'Spot funzionante, tutto ok' },
  { value: 'bustato',  label: 'Bustato',  color: '#000',    bg: '#ff6a00', desc: 'Parzialmente dannegiato o con limitazioni' },
  { value: 'demolito', label: 'Demolito', color: '#f3ead8', bg: '#3a3a3a', desc: 'Non più accessibile o distrutto' },
];

export default function StatusUpdateBtn({
  spotId, spotName, currentCondition,
}: {
  spotId: string;
  spotName: string;
  currentCondition: SpotCondition;
}) {
  const [open,    setOpen]    = useState(false);
  const [sel,     setSel]     = useState<SpotCondition | null>(null);
  const [note,    setNote]    = useState('');
  const [sending, setSending] = useState(false);
  const [done,    setDone]    = useState(false);

  const handleSend = async () => {
    if (!sel) return;
    setSending(true);
    try {
      await fetch('/api/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spot_id: spotId,
          reason:  `[STATO: ${sel.toUpperCase()}] ${note || '—'}`,
        }),
      });
      setDone(true);
      setTimeout(() => { setOpen(false); setDone(false); setSel(null); setNote(''); }, 2000);
    } catch {
      setSending(false);
    }
  };

  return (
    <div style={{ padding: '0 20px 32px' }}>

      {/* Bottone principale — stiloso, non invasivo */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            cursor: 'pointer',
            transition: 'border-color 0.2s, background 0.2s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,106,0,0.4)';
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,106,0,0.04)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)',
              letterSpacing: '0.04em', marginBottom: 2,
            }}>
              Segnala aggiornamento
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)' }}>
              Lo spot è cambiato? Dillo alla community
            </div>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--orange)', letterSpacing: '0.04em',
            opacity: 0.8,
          }}>
            AGGIORNA →
          </div>
        </button>
      )}

      {/* Pannello aggiornamento */}
      {open && (
        <div style={{
          border: '1px solid rgba(255,106,0,0.3)',
          borderRadius: 10, overflow: 'hidden',
          background: 'rgba(255,106,0,0.03)',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--orange)', letterSpacing: '0.04em' }}>
              AGGIORNA STATO
            </div>
            <button onClick={() => setOpen(false)} style={{
              background: 'none', border: 'none', color: 'var(--gray-500)',
              fontSize: 18, cursor: 'pointer', padding: '0 4px',
            }}>✕</button>
          </div>

          <div style={{ padding: '14px 16px' }}>
            {done ? (
              <div style={{
                textAlign: 'center', padding: '20px 0',
                fontFamily: 'var(--font-mono)', fontSize: 14, color: '#00c851',
              }}>
                ✓ Grazie! Segnalazione inviata.
              </div>
            ) : (
              <>
                {/* Scelta condizione */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {CONDITIONS.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setSel(c.value)}
                      style={{
                        flex: 1, padding: '10px 6px',
                        borderRadius: 7, cursor: 'pointer',
                        border: sel === c.value
                          ? `2px solid ${c.bg}`
                          : '2px solid rgba(255,255,255,0.07)',
                        background: sel === c.value
                          ? `${c.bg}22`
                          : 'rgba(255,255,255,0.03)',
                        transition: 'all 0.15s',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      }}
                    >
                      {/* Dot */}
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%', background: c.bg,
                        boxShadow: sel === c.value ? `0 0 8px ${c.bg}88` : 'none',
                      }} />
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 10,
                        color: sel === c.value ? c.bg : 'var(--gray-500)',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>
                        {c.label}
                      </span>
                    </button>
                  ))}
                </div>

                {sel && (
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)',
                    marginBottom: 12, textAlign: 'center',
                  }}>
                    {CONDITIONS.find(c => c.value === sel)?.desc}
                  </div>
                )}

                {/* Nota opzionale */}
                <textarea
                  placeholder="Note aggiuntive (opzionale)..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 6, padding: '8px 10px',
                    fontFamily: 'var(--font-mono)', fontSize: 12,
                    color: 'var(--bone)', resize: 'none',
                    outline: 'none', marginBottom: 12,
                  }}
                />

                <button
                  onClick={handleSend}
                  disabled={!sel || sending}
                  style={{
                    width: '100%', padding: '11px 0',
                    background: sel ? 'var(--orange)' : 'rgba(255,255,255,0.05)',
                    color: sel ? '#000' : 'var(--gray-600)',
                    border: 'none', borderRadius: 7,
                    fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                    letterSpacing: '0.04em', cursor: sel ? 'pointer' : 'default',
                    transition: 'all 0.2s',
                  }}
                >
                  {sending ? 'INVIO...' : 'INVIA AGGIORNAMENTO'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
