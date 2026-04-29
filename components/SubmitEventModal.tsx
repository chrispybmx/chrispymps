'use client';

import { useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { useToast } from './Toast';
import ImageUploadField from './ImageUploadField';

interface Props { open: boolean; onClose: () => void }

export default function SubmitEventModal({ open, onClose }: Props) {
  const user = useUser();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !title.trim() || !date) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/submit-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          event_date: date,
          location: location.trim() || undefined,
          city: city.trim() || undefined,
          description: description.trim() || undefined,
          link_url: linkUrl.trim() || undefined,
          cover_url: coverUrl || undefined,
          access_token: user.accessToken,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        toast(j.message, 'success');
        setTitle(''); setDate(''); setLocation(''); setCity(''); setDescription(''); setLinkUrl(''); setCoverUrl('');
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
        maxHeight: '88dvh', overflowY: 'auto',
        animation: 'slideUp 0.3s ease-out',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
      }}>
        <div className="bottom-sheet-handle" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 14px', borderBottom: '1px solid var(--gray-700)' }}>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--orange)', margin: 0 }}>📅 PROPONI EVENTO</h2>
          <button onClick={onClose} className="btn-ghost" style={{ fontSize: 20 }}>✕</button>
        </div>

        <div style={{ padding: 20, display: 'grid', gap: 14 }}>
          {!user ? (
            <div style={{ textAlign: 'center', padding: '24px 0', fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)' }}>
              🔑 Accedi per proporre un evento
            </div>
          ) : (
            <>
              <Field label="Titolo evento *" value={title} onChange={setTitle} placeholder="Es. BMX Jam Bologna 2026" max={150} />
              <div>
                <Label>Data *</Label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
              </div>
              <Field label="Luogo" value={location} onChange={setLocation} placeholder="Es. Skatepark Via Roma" max={200} />
              <Field label="Città" value={city} onChange={setCity} placeholder="Es. Bologna" max={60} />
              <div>
                <Label>Descrizione</Label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Dettagli sull'evento..." rows={3} maxLength={2000} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <ImageUploadField label="Flyer / Foto evento" value={coverUrl} onChange={setCoverUrl} accessToken={user.accessToken} purpose="event" />
              <Field label="Link (iscrizione, info)" value={linkUrl} onChange={setLinkUrl} placeholder="https://..." max={500} />

              <button onClick={handleSubmit} disabled={!title.trim() || !date || submitting} className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', opacity: (!title.trim() || !date || submitting) ? 0.4 : 1 }}>
                {submitting ? '⏳ INVIO...' : '📅 PROPONI EVENTO'}
              </button>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)', textAlign: 'center' }}>
                L'evento sarà visibile dopo l'approvazione
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
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={max}
        style={inputStyle} />
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
