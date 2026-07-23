'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { useToast } from './Toast';
import { TIPI_SPOT, DIFFICOLTA } from '@/lib/constants';
import type { SpotType } from '@/lib/types';

interface Props {
  spotId:       string;
  ownerId:      string | null;
  name:         string;
  type:         SpotType;
  description:  string | null;
  guardians:    string | null;
  difficulty:   string | null;
}

const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--gray-700)', border: '1px solid var(--gray-600)',
  borderRadius: 4, color: 'var(--bone)', fontFamily: 'var(--font-mono)',
  fontSize: 15, padding: '10px 12px', outline: 'none',
};
const lbl: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)',
  textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6,
};

export default function SpotOwnerActions(props: Props) {
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Campi editabili — precompilati
  const [name, setName]               = useState(props.name);
  const [type, setType]               = useState<SpotType>(props.type);
  const [description, setDescription] = useState(props.description ?? '');
  const [guardians, setGuardians]     = useState(props.guardians ?? '');
  const [difficulty, setDifficulty]   = useState(props.difficulty ?? '');

  // Owner-gate: niente da mostrare se non è il proprietario loggato
  if (!user || !props.ownerId || user.id !== props.ownerId) return null;

  const close = () => { setOpen(false); setConfirmDelete(false); setError(null); };

  const handleSave = async () => {
    if (!name.trim() || !type) { setError('Nome e tipo sono obbligatori.'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/spots/${props.spotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
          description: description.trim() || null,
          guardians: guardians.trim() || null,
          difficulty: difficulty || null,
          access_token: user.accessToken,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? 'Errore durante il salvataggio.');
      toast('Spot aggiornato', 'success');
      close();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto.');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true); setError(null);
    try {
      const res = await fetch(`/api/spots/${props.spotId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: user.accessToken }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? 'Errore durante l\'eliminazione.');
      toast('Spot eliminato', 'success');
      router.push('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto.');
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Barra owner — discreta, sotto il resto */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 20,
        padding: '10px 12px', borderRadius: 8,
        background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--gray-700)',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)', alignSelf: 'center', marginRight: 'auto' }}>
          Il tuo spot
        </span>
        <button onClick={() => setOpen(true)} style={ownerBtn(false)}>✏️ Modifica</button>
        <button onClick={() => { setOpen(true); setConfirmDelete(true); }} style={ownerBtn(true)}>🗑️ Elimina</button>
      </div>

      {open && (
        <>
          <div onClick={close}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 69, backdropFilter: 'blur(4px)' }}
            aria-hidden />

          <div role="dialog" aria-modal aria-label="Modifica spot" style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: 'var(--gray-800)', borderTop: '2px solid var(--orange)',
            borderRadius: '16px 16px 0 0', zIndex: 70,
            maxHeight: '92dvh', overflowY: 'auto', overscrollBehavior: 'contain',
            maxWidth: 680, margin: '0 auto',
            animation: 'slideUp 0.3s ease-out',
            paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
          }}>
            <div className="bottom-sheet-handle" />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 14px', borderBottom: '1px solid var(--gray-700)' }}>
              <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--orange)', margin: 0 }}>
                {confirmDelete ? '🗑️ ELIMINA SPOT' : '✏️ MODIFICA SPOT'}
              </h2>
              <button onClick={close} className="btn-ghost" aria-label="Chiudi" style={{ fontSize: 20 }}>✕</button>
            </div>

            <div style={{ padding: '20px' }}>
              {confirmDelete ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  <p style={{ color: 'var(--bone)', lineHeight: 1.6, margin: 0 }}>
                    Vuoi eliminare <strong style={{ color: 'var(--orange)' }}>{props.name}</strong>?
                    Sparirà dalla mappa. L&apos;azione può essere annullata solo contattandomi.
                  </p>
                  {error && <ErrBox msg={error} />}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setConfirmDelete(false)} disabled={deleting} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                      ← Annulla
                    </button>
                    <button onClick={handleDelete} disabled={deleting} style={{
                      flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center',
                      padding: '10px', borderRadius: 6, border: '1px solid #ff4444',
                      background: deleting ? 'rgba(255,68,68,0.3)' : '#ff4444', color: '#fff',
                      fontFamily: 'var(--font-mono)', fontSize: 14, cursor: deleting ? 'default' : 'pointer',
                    }}>
                      {deleting ? '⏳ Elimino...' : 'Elimina definitivamente'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 18 }}>
                  <div>
                    <label style={lbl}>Nome spot *</label>
                    <input type="text" style={inp} value={name} onChange={e => setName(e.target.value)} maxLength={100} />
                  </div>
                  <div>
                    <label style={lbl}>Tipo *</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      {(Object.entries(TIPI_SPOT) as [SpotType, typeof TIPI_SPOT[SpotType]][]).map(([t, info]) => (
                        <button key={t} onClick={() => setType(t)} style={{
                          padding: '6px 12px',
                          border: `1px solid ${type === t ? info.color : 'var(--gray-600)'}`,
                          borderRadius: 2,
                          background: type === t ? info.color : 'transparent',
                          color: type === t ? 'var(--black)' : 'var(--bone)',
                          fontFamily: 'var(--font-mono)', fontSize: 13, cursor: 'pointer', transition: 'all 0.1s',
                        }}>
                          {info.emoji} {info.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Descrizione</label>
                    <textarea style={{ ...inp, resize: 'vertical' }} rows={2}
                      value={description} onChange={e => setDescription(e.target.value)} maxLength={500} />
                  </div>
                  <div>
                    <label style={lbl}>Note accesso</label>
                    <input type="text" style={inp} value={guardians} onChange={e => setGuardians(e.target.value)} maxLength={200} />
                  </div>
                  <div>
                    <label style={lbl}>Livello difficoltà</label>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      {DIFFICOLTA.map(d => (
                        <button key={d.value} type="button"
                          onClick={() => setDifficulty(difficulty === d.value ? '' : d.value)}
                          style={{
                            flex: 1, padding: '8px 4px',
                            border: `1px solid ${difficulty === d.value ? 'var(--orange)' : 'var(--gray-600)'}`,
                            borderRadius: 2,
                            background: difficulty === d.value ? 'rgba(255,106,0,0.15)' : 'transparent',
                            color: difficulty === d.value ? 'var(--orange)' : 'var(--bone)',
                            fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer',
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                          }}>
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && <ErrBox msg={error} />}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setConfirmDelete(true)} className="btn-secondary" style={{ justifyContent: 'center', color: '#ff6b6b', borderColor: 'rgba(255,68,68,0.4)' }}>
                      🗑️
                    </button>
                    <button onClick={handleSave} disabled={saving || !name.trim() || !type} className="btn-primary"
                      style={{ flex: 1, justifyContent: 'center', opacity: (saving || !name.trim() || !type) ? 0.5 : 1 }}>
                      {saving ? '⏳ Salvo...' : '💾 Salva modifiche'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function ownerBtn(danger: boolean): React.CSSProperties {
  return {
    padding: '7px 12px', borderRadius: 6,
    border: `1px solid ${danger ? 'rgba(255,68,68,0.4)' : 'var(--gray-600)'}`,
    background: 'transparent',
    color: danger ? '#ff6b6b' : 'var(--bone)',
    fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer',
  };
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#ff4444', background: 'rgba(255,50,50,0.08)', border: '1px solid rgba(255,50,50,0.2)', borderRadius: 4, padding: '10px 12px' }}>
      ⚠ {msg}
    </div>
  );
}
