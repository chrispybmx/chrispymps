'use client';

import { useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { useToast } from './Toast';
import ImageUploadField from './ImageUploadField';

interface Props { open: boolean; onClose: () => void }

export default function SubmitNewsModal({ open, onClose }: Props) {
  const user = useUser();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
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
          cover_url: coverUrl.trim() || undefined,
          link_url: linkUrl.trim() || undefined,
          tags: tags.trim() || undefined,
          access_token: user.accessToken,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        toast(j.message, 'success');
        setTitle(''); setBody(''); setCoverUrl(''); setLinkUrl(''); setTags('');
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
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--orange)', margin: 0 }}>📝 SCRIVI UN POST</h2>
          <button onClick={onClose} className="btn-ghost" style={{ fontSize: 20 }}>✕</button>
        </div>

        <div style={{ padding: 20, display: 'grid', gap: 14 }}>
          {!user ? (
            <div style={{ textAlign: 'center', padding: '24px 0', fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)' }}>
              🔑 Accedi per scrivere un post
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

              <Field label="Titolo *" value={title} onChange={setTitle} placeholder="Il titolo del tuo post" max={200} />

              <div>
                <Label>Testo *</Label>
                <textarea
                  value={body} onChange={e => setBody(e.target.value)}
                  placeholder={"Scrivi il tuo post...\n\nPuoi usare:\n# Titoli\n**grassetto**\n- liste\n\nLink e video saranno cliccabili."}
                  rows={8} maxLength={50000}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 150, lineHeight: 1.6 }}
                />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)', marginTop: 4, textAlign: 'right' }}>
                  {body.length} / 50.000
                </div>
              </div>

              <ImageUploadField label="Foto copertina" value={coverUrl} onChange={setCoverUrl} accessToken={user.accessToken} purpose="news" />
              <Field label="Link video / sito" value={linkUrl} onChange={setLinkUrl} placeholder="https://youtube.com/..." max={500} />
              <Field label="Tag (separati da virgola)" value={tags} onChange={setTags} placeholder="bmx, street, video" max={200} />

              <button onClick={handleSubmit} disabled={!title.trim() || body.length < 10 || submitting} className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', opacity: (!title.trim() || body.length < 10 || submitting) ? 0.4 : 1 }}>
                {submitting ? '⏳ INVIO...' : '📝 PUBBLICA POST'}
              </button>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)', textAlign: 'center' }}>
                Il post sarà visibile dopo l'approvazione
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, value, onChange, placeholder, max }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; max?: number }) {
  return (
    <div>
      <Label>{label}</Label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={max} style={inputStyle} />
    </div>
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
