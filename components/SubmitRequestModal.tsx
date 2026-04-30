'use client';

import { useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { useToast } from './Toast';

interface Props { open: boolean; onClose: () => void }

export default function SubmitRequestModal({ open, onClose }: Props) {
  const user = useUser();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [city, setCity] = useState('');
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !title.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/submit-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          tags: tags.trim() || 'cerca-spot',
          post_type: 'request',
          request_city: city.trim() || undefined,
          access_token: user.accessToken,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        toast(j.message, 'success');
        setTitle(''); setBody(''); setCity(''); setTags('');
        onClose();
      } else toast(j.error, 'error');
    } catch { toast('Errore di rete', 'error'); }
    finally { setSubmitting(false); }
  };

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 69, backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--gray-800)', borderTop: '2px solid var(--orange)',
        borderRadius: '16px 16px 0 0', zIndex: 70,
        maxHeight: '92dvh', overflowY: 'auto',
        animation: 'slideUp 0.3s ease-out',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
      }}>
        <div className="bottom-sheet-handle" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 14px', borderBottom: '1px solid var(--gray-700)' }}>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--orange)', margin: 0 }}>📍 CERCA UNO SPOT</h2>
          <button onClick={onClose} className="btn-ghost" style={{ fontSize: 20 }}>✕</button>
        </div>

        <div style={{ padding: 20, display: 'grid', gap: 14 }}>
          {!user ? (
            <div style={{ textAlign: 'center', padding: '24px 0', fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)' }}>
              🔑 Accedi per chiedere aiuto alla community
            </div>
          ) : (
            <>
              {/* User badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(255,106,0,0.06)', borderRadius: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#000' }}>
                  {user.username[0].toUpperCase()}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--bone)' }}>@{user.username}</span>
              </div>

              <div>
                <Label>Cosa cerchi? *</Label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder='es. "Ledge marmo basso a Verona sud"' maxLength={200} style={inputStyle} />
              </div>

              <div>
                <Label>Città / Zona *</Label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder='es. "Torino centro", "Lago di Garda"' maxLength={100} style={inputStyle} />
              </div>

              <div>
                <Label>Dettagli</Label>
                <textarea
                  value={body} onChange={e => setBody(e.target.value)}
                  placeholder={"Descrivi meglio cosa cerchi:\n- Tipo di spot (park, street, rail...)\n- Superficie preferita\n- Livello difficoltà\n- Quando vuoi andarci\n- Altre info utili"}
                  rows={5} maxLength={5000}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 100, lineHeight: 1.6 }}
                />
              </div>

              <div>
                <Label>Tag (opzionale)</Label>
                <input type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="ledge, marmo, street" maxLength={200} style={inputStyle} />
              </div>

              <button onClick={handleSubmit} disabled={!title.trim() || body.length < 10 || submitting} className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', opacity: (!title.trim() || body.length < 10 || submitting) ? 0.4 : 1 }}>
                {submitting ? '⏳ INVIO...' : '📍 INVIA RICHIESTA'}
              </button>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)', textAlign: 'center' }}>
                La richiesta sarà visibile dopo l'approvazione
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{children}</label>;
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--gray-700)', border: '1px solid var(--gray-600)',
  borderRadius: 6, color: 'var(--bone)', fontFamily: 'var(--font-mono)',
  fontSize: 15, padding: '10px 12px', outline: 'none',
};
