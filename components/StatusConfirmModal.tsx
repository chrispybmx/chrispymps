'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/LanguageProvider';
import { conditionText } from '@/lib/spot-trust';
import AuthModal from '@/components/AuthModal';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/components/Toast';
import type { SpotCondition } from '@/lib/types';

interface StatusConfirmModalProps {
  open: boolean;
  onClose: () => void;
  spotId: string;
  spotName: string;
  currentCondition: SpotCondition;
}

export default function StatusConfirmModal({ open, onClose, spotId, spotName, currentCondition }: StatusConfirmModalProps) {
  const user = useUser();
  const router = useRouter();
  const { language, text } = useLanguage();
  const [authOpen, setAuthOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open && !authOpen, dialogRef, onClose);
  const conditions: { value: SpotCondition; label: string; color: string; desc: string }[] = [
    { value: 'alive', label: conditionText('alive', language), color: '#00c851', desc: text('Si può girare: lo spot è in buone condizioni.', 'Rideable: the spot is in good condition.') },
    { value: 'bustato', label: conditionText('bustato', language), color: '#ff6a00', desc: text('Accesso problematico: ti fanno andare via o ci sono limitazioni.', 'Access is restricted or riders are asked to leave.') },
    { value: 'demolito', label: text('Demolito', 'Demolished'), color: '#a2a2a2', desc: text('Lo spot non esiste più o è stato reso inutilizzabile.', 'The spot is gone or has been made unusable.') },
  ];
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
        toast(json.message || text('Segnalazione registrata.', 'Report saved.'), 'success');

        // XP toast after a short delay
        if (json.xp) {
          setTimeout(() => {
            if (json.xp.leveledUp) {
              toast(text(`Nuovo livello: ${json.xp.level}`, `New level: ${json.xp.level}`), 'success');
            } else {
              toast(text(`+${json.xp.awarded} XP · Livello ${json.xp.level}`, `+${json.xp.awarded} XP · Level ${json.xp.level}`), 'success');
            }
          }, 400);
        }

        setSelected(null);
        setNote('');
        onClose();
        router.refresh();
      } else {
        toast(json.error || text('Errore durante il salvataggio.', 'Could not save your report.'), 'error');
      }
    } catch {
      toast(text('Errore di rete. Riprova.', 'Network error. Please try again.'), 'error');
    } finally {
      setSubmitting(false);
    }
  }, [user, selected, note, spotId, toast, onClose, router, text]);

  if (!open) return null;

  return (
    <>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onSuccess={() => setAuthOpen(false)} />
      <div onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 69, backdropFilter: 'none' }}
      />

      <div ref={dialogRef} role="dialog" aria-modal aria-label={text("Segnala lo stato dello spot", "Report spot condition")} style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--gray-800)', borderTop: '2px solid var(--orange)',
        borderRadius: '8px 8px 0 0', zIndex: 70,
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
              {text('Come hai trovato lo spot?', 'How was the spot?')}
            </h2>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)', marginTop: 2 }}>
              {spotName}
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" aria-label={text("Chiudi", "Close")} style={{ fontSize: 20 }}>✕</button>
        </div>

        <div style={{ padding: '20px' }}>

          {!user ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)' }}>
                {text('Accedi per segnalare lo stato', 'Sign in to report the condition')}
              </div>
              <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setAuthOpen(true)}>{text('Accedi', 'Sign in')}</button>
            </div>
          ) : (
            <>
              {/* Current status */}
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-500)',
                marginBottom: 14, textAlign: 'center',
              }}>
                {text('Stato sulla mappa: ', 'Current map status: ')}<strong style={{ color: conditions.find(c => c.value === currentCondition)?.color }}>
                  {conditionText(currentCondition, language)}
                </strong>
              </div>

              {/* Condition buttons */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {conditions.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setSelected(c.value)}
                    aria-pressed={selected === c.value}
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
                    <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: '50%', background: c.color }} />
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 14,
                      color: selected === c.value ? c.color : 'var(--gray-400)',
                      letterSpacing: '0',
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
                  fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-500)',
                  marginBottom: 12, textAlign: 'center',
                }}>
                  {conditions.find(c => c.value === selected)?.desc}
                </div>
              )}

              <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--gray-400)', margin: '0 0 12px' }}>
                {text('La segnalazione e la nota saranno visibili sulla scheda. Per cambiare lo stato servono due rider diversi.', 'Your report and note will appear on the spot page. Two different riders must agree before the status changes.')}
              </p>
              {/* Optional note */}
              <textarea
                aria-label={text("Cosa è cambiato? (facoltativo)", "What changed? (optional)")}
                placeholder={text("Cosa è cambiato? Aggiungi una nota utile a chi viene dopo.", "What changed? Leave a useful note for the next rider.")}
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
                maxLength={300}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8, padding: '10px 12px',
                  fontFamily: 'var(--font-mono)', fontSize: 16,
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
                  ? text('Invio…', 'Sending…')
                  : selected === currentCondition
                    ? text('Conferma stato', 'Confirm condition')
                    : selected
                      ? text('Invia segnalazione', 'Send report')
                      : text('Seleziona uno stato', 'Choose a condition')
                }
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
