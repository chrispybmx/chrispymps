'use client';

import { useState, useCallback } from 'react';
import { useUser } from '@/hooks/useUser';
import { useToast } from './Toast';
import type { SpotCondition } from '@/lib/types';

interface StatusConfirmModalProps {
  open: boolean;
  onClose: () => void;
  spotId: string;
  spotName: string;
  currentCondition: SpotCondition;
}

const CONDITIONS: { value: SpotCondition; label: string; emoji: string; color: string; desc: string }[] = [
  { value: 'alive',    label: 'Alive',    emoji: '🟢', color: '#00c851', desc: 'Spot funzionante, tutto ok' },
  { value: 'bustato',  label: 'Bustato',  emoji: '🟠', color: '#ff6a00', desc: 'Parzialmente danneggiato' },
  { value: 'demolito', label: 'Demolito', emoji: '⚫', color: '#666',    desc: 'Non più accessibile o distrutto' },
];

export default function StatusConfirmModal({ open, onClose, spotId, spotName, currentCondition }: StatusConfirmModalProps) {
  const user = useUser();
  const { toast } = useToast();
  const [selected, setSelected] = useState<SpotCondition | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!user || !selected) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/status-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spot_id: spotId,
          condition: selected,
          note: note.trim() || undefined,
          access_token: user.accessToken,
        }),
      });
      const json = await res.json();

      if (json.ok) {
        toast(json.message, 'success');

        // XP toast after a short delay
        if (json.xp) {
          setTimeout(() => {
            if (json.xp.leveledUp) {
              toast(`\ud83c\udf89 LEVEL UP! Sei ora ${json.xp.level}!`, 'success');
            } else {
              toast(`\u26a1 +${json.xp.awarded} XP \u2014 Livello: ${json.xp.level} (${json.xp.total} XP)`, 'success');
            }
          }, 400);
        }

        setSelected(null);
        setNote('');
        onClose();
      } else {
        toast(json.error || 'Errore', 'error');
      }
    } catch {
      toast('Errore di rete. Riprova.', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [user, selected, note, spotId, toast, onClose]);

  if (!open) return null;

  return (
    <>
      <div onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 69, backdropFilter: 'blur(4px)' }}
      />

      <div role="dialog" aria-modal aria-label="Conferma stato spot" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--gray-800)', borderTop: '2px solid var(--orange)',
        borderRadius: '16px 16px 0 0', zIndex: 70,
        maxHeight: '70dvh', overflowY: 'auto',
        animation: 'slideUp 0.3s ease-out',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
      }}>
        <div className="bottom-sheet-handle" />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px 14px',
          borderBottom: '1px solid var(--gray-700)',
        }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--orange)', margin: 0 }}>
              ✓ CONFERMA STATO
            </h2>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
              {spotName}
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" aria-label="Chiudi" style={{ fontSize: 20 }}>✕</button>
        </div>

        <div style={{ padding: '20px' }}>

          {!user ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔑</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)' }}>
                Accedi per confermare lo stato
              </div>
            </div>
          ) : (
            <>
              {/* Current status */}
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-500)',
                marginBottom: 14, textAlign: 'center',
              }}>
                Stato attuale: <strong style={{ color: CONDITIONS.find(c => c.value === currentCondition)?.color }}>
                  {CONDITIONS.find(c => c.value === currentCondition)?.emoji} {currentCondition.toUpperCase()}
                </strong>
              </div>

              {/* Condition buttons */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {CONDITIONS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setSelected(c.value)}
                    style={{
                      flex: 1, padding: '14px 6px',
                      borderRadius: 10, cursor: 'pointer',
                      border: selected === c.value
                        ? `2px solid ${c.color}`
                        : '2px solid rgba(255,255,255,0.07)',
                      background: selected === c.value
                        ? `${c.color}18`
                        : 'rgba(255,255,255,0.03)',
                      transition: 'all 0.15s',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 24 }}>{c.emoji}</span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 11,
                      color: selected === c.value ? c.color : 'var(--gray-400)',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                      fontWeight: selected === c.value ? 700 : 400,
                    }}>
                      {c.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Description of selected */}
              {selected && (
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)',
                  marginBottom: 12, textAlign: 'center',
                }}>
                  {CONDITIONS.find(c => c.value === selected)?.desc}
                </div>
              )}

              {/* Optional note */}
              <textarea
                placeholder="Note aggiuntive (opzionale)..."
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
                maxLength={300}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8, padding: '10px 12px',
                  fontFamily: 'var(--font-mono)', fontSize: 13,
                  color: 'var(--bone)', resize: 'none',
                  outline: 'none', marginBottom: 16,
                }}
              />

              <button
                onClick={handleSubmit}
                disabled={!selected || submitting}
                className="btn-primary"
                style={{
                  width: '100%', justifyContent: 'center',
                  opacity: (!selected || submitting) ? 0.4 : 1,
                }}
              >
                {submitting
                  ? '⏳ INVIO...'
                  : selected === currentCondition
                    ? '✓ CONFERMO — ANCORA ' + currentCondition.toUpperCase()
                    : selected
                      ? `AGGIORNA A ${selected.toUpperCase()}`
                      : 'SELEZIONA UNO STATO'
                }
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
