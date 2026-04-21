'use client';

import { useState, useEffect, useCallback } from 'react';
import { TIPI_SPOT, CITTA_ITALIANE, SUPERFICI, DIFFICOLTA } from '@/lib/constants';
import type { SpotType, SubmitSpotPayload } from '@/lib/types';
import PhotoUpload from './PhotoUpload';

interface AddSpotModalProps {
  open:          boolean;
  onClose:       () => void;
  initialLat?:   number;
  initialLon?:   number;
}

type Step = 'gps' | 'foto' | 'dati' | 'info' | 'invio';

const STEPS: Record<Step, { label: string; n: number }> = {
  gps:   { label: 'Posizione', n: 1 },
  foto:  { label: 'Foto',      n: 2 },
  dati:  { label: 'Dettagli',  n: 3 },
  info:  { label: 'Chi sei',   n: 4 },
  invio: { label: 'Inviato!',  n: 5 },
};

const LS_KEY = 'cmps_contributor';

export default function AddSpotModal({ open, onClose, initialLat, initialLon }: AddSpotModalProps) {
  const [step,    setStep]    = useState<Step>('gps');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [photos,  setPhotos]  = useState<File[]>([]);

  const [form, setForm] = useState({
    name:                 '',
    type:                 '' as SpotType | '',
    lat:                  initialLat ?? 0,
    lon:                  initialLon ?? 0,
    city:                 '',
    description:          '',
    surface:              '',
    wax_needed:           false,
    guardians:            '',
    difficulty:           '',
    contributor_name:     '',
    contributor_email:    '',
    instagram_handle:     '',
    subscribe_newsletter: true,
  });

  // Ripristina nome/email da localStorage (friction zero per invii successivi)
  useEffect(() => {
    if (!open) return;
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const { name, email, instagram } = JSON.parse(saved);
        setForm((f) => ({
          ...f,
          contributor_name:  name  || f.contributor_name,
          contributor_email: email || f.contributor_email,
          instagram_handle:  instagram || f.instagram_handle,
        }));
      }
    } catch {}
  }, [open]);

  // Aggiorna lat/lon iniziali se passati come prop
  useEffect(() => {
    if (initialLat && initialLon) {
      setForm((f) => ({ ...f, lat: initialLat, lon: initialLon }));
    }
  }, [initialLat, initialLon]);

  const updateForm = useCallback(<K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  // Geolocalizzazione
  const getGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocalizzazione non disponibile su questo dispositivo.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateForm('lat', pos.coords.latitude);
        updateForm('lon', pos.coords.longitude);
        setError(null);
      },
      () => setError('Impossibile ottenere la posizione. Assicurati di essere nello spot.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [updateForm]);

  const nextStep = () => {
    setError(null);
    const order: Step[] = ['gps', 'foto', 'dati', 'info', 'invio'];
    const idx = order.indexOf(step);
    if (idx < order.length - 1) setStep(order[idx + 1]);
  };

  const prevStep = () => {
    setError(null);
    const order: Step[] = ['gps', 'foto', 'dati', 'info', 'invio'];
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const fd = new FormData();
      const payload: SubmitSpotPayload = {
        name:                 form.name,
        type:                 form.type as SpotType,
        lat:                  form.lat,
        lon:                  form.lon,
        city:                 form.city || undefined,
        description:          form.description || undefined,
        surface:              form.surface || undefined,
        wax_needed:           form.wax_needed,
        guardians:            form.guardians || undefined,
        difficulty:           form.difficulty || undefined,
        contributor_name:     form.contributor_name,
        contributor_email:    form.contributor_email,
        instagram_handle:     form.instagram_handle || undefined,
        subscribe_newsletter: form.subscribe_newsletter,
      };
      fd.append('data', JSON.stringify(payload));
      photos.forEach((p, i) => fd.append(`photo_${i}`, p));

      const res = await fetch('/api/submit-spot', { method: 'POST', body: fd });
      const json = await res.json();

      if (!json.ok) throw new Error(json.error ?? 'Errore durante l\'invio');

      // Salva nome/email per la prossima volta
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({
          name:      form.contributor_name,
          email:     form.contributor_email,
          instagram: form.instagram_handle,
        }));
      } catch {}

      setStep('invio');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('gps');
    setError(null);
    setPhotos([]);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)',
          zIndex: 69,
          backdropFilter: 'blur(4px)',
        }}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Aggiungi spot BMX"
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          background: 'var(--gray-800)',
          borderTop: '2px solid var(--orange)',
          borderRadius: '16px 16px 0 0',
          zIndex: 70,
          maxHeight: '92dvh',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          animation: 'slideUp 0.3s ease-out',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
        }}
      >
        <div className="bottom-sheet-handle" />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px 16px',
          borderBottom: '1px solid var(--gray-700)',
        }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--orange)', margin: 0 }}>
              🏴 AGGIUNGI SPOT
            </h2>
            {step !== 'invio' && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
                STEP {STEPS[step].n}/4 — {STEPS[step].label.toUpperCase()}
              </div>
            )}
          </div>
          <button onClick={handleClose} className="btn-ghost" aria-label="Chiudi" style={{ fontSize: 20 }}>✕</button>
        </div>

        {/* Progress bar */}
        {step !== 'invio' && (
          <div style={{ height: 3, background: 'var(--gray-700)' }}>
            <div style={{
              height: '100%',
              width: `${(STEPS[step].n / 4) * 100}%`,
              background: 'var(--orange)',
              transition: 'width 0.3s ease-out',
            }} />
          </div>
        )}

        <div style={{ padding: '20px 20px 0' }}>
          {/* STEP 1: GPS */}
          {step === 'gps' && (
            <div>
              <p style={{ color: 'var(--bone)', marginBottom: 20, lineHeight: 1.5 }}>
                Sei fisicamente nello spot? Premi il pulsante per salvare la posizione GPS precisa.
              </p>

              <button onClick={getGPS} className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}>
                📍 Usa la mia posizione GPS
              </button>

              {form.lat !== 0 && (
                <div style={{
                  background: 'var(--gray-700)', padding: 12, borderRadius: 4,
                  fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)',
                  marginBottom: 16,
                }}>
                  ✅ {form.lat.toFixed(6)}, {form.lon.toFixed(6)}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Città (opzionale)</label>
                <select
                  className="input-vhs"
                  value={form.city}
                  onChange={(e) => updateForm('city', e.target.value)}
                  style={{ marginTop: 6 }}
                >
                  <option value="">Seleziona città...</option>
                  {CITTA_ITALIANE.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {error && <ErrorMsg msg={error} />}

              <button
                onClick={nextStep}
                disabled={form.lat === 0}
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: 4, opacity: form.lat === 0 ? 0.5 : 1 }}
              >
                Avanti →
              </button>
            </div>
          )}

          {/* STEP 2: FOTO */}
          {step === 'foto' && (
            <div>
              <p style={{ color: 'var(--gray-400)', marginBottom: 16, fontSize: 14 }}>
                Carica fino a 5 foto. La prima sarà la cover. Sono gradite foto recenti che mostrano lo spot.
              </p>
              <PhotoUpload photos={photos} onChange={setPhotos} />
              {error && <ErrorMsg msg={error} />}
              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button onClick={prevStep} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>← Indietro</button>
                <button onClick={nextStep} className="btn-primary"   style={{ flex: 2, justifyContent: 'center' }}>Avanti →</button>
              </div>
            </div>
          )}

          {/* STEP 3: DATI SPOT */}
          {step === 'dati' && (
            <div>
              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Nome spot *</label>
                <input
                  type="text"
                  className="input-vhs"
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  placeholder="es. Gradoni Piazza Bra"
                  style={{ marginTop: 6 }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Tipo spot *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {(Object.entries(TIPI_SPOT) as [SpotType, typeof TIPI_SPOT[SpotType]][]).map(([type, info]) => (
                    <button
                      key={type}
                      onClick={() => updateForm('type', type)}
                      style={{
                        padding: '6px 12px',
                        border: `1px solid ${form.type === type ? info.color : 'var(--gray-600)'}`,
                        borderRadius: 2,
                        background: form.type === type ? info.color : 'transparent',
                        color: form.type === type ? 'var(--black)' : 'var(--bone)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 13,
                        cursor: 'pointer',
                        transition: 'all 0.1s',
                      }}
                    >
                      {info.emoji} {info.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Descrizione (opzionale)</label>
                <textarea
                  className="input-vhs"
                  value={form.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                  placeholder="Cosa c'è nello spot? Com'è il fondo?"
                  rows={3}
                  style={{ marginTop: 6, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label className="input-label">Superficie</label>
                  <select className="input-vhs" value={form.surface} onChange={(e) => updateForm('surface', e.target.value)} style={{ marginTop: 6 }}>
                    <option value="">—</option>
                    {SUPERFICI.map((s) => <option key={s} value={s.toLowerCase()}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Livello</label>
                  <select className="input-vhs" value={form.difficulty} onChange={(e) => updateForm('difficulty', e.target.value)} style={{ marginTop: 6 }}>
                    <option value="">—</option>
                    {DIFFICOLTA.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.wax_needed}
                    onChange={(e) => updateForm('wax_needed', e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: 'var(--orange)' }}
                  />
                  <span style={{ color: 'var(--bone)', fontSize: 15 }}>🕯️ Necessita cera</span>
                </label>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Note accesso (guardiani, orari, rischi)</label>
                <input
                  type="text"
                  className="input-vhs"
                  value={form.guardians}
                  onChange={(e) => updateForm('guardians', e.target.value)}
                  placeholder='es. "Evitare ore di punta" oppure "Sempre libero"'
                  style={{ marginTop: 6 }}
                />
              </div>

              {error && <ErrorMsg msg={error} />}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={prevStep} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>← Indietro</button>
                <button
                  onClick={nextStep}
                  disabled={!form.name || !form.type}
                  className="btn-primary"
                  style={{ flex: 2, justifyContent: 'center', opacity: (!form.name || !form.type) ? 0.5 : 1 }}
                >
                  Avanti →
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: INFO CONTRIBUTOR */}
          {step === 'info' && (
            <div>
              <p style={{ color: 'var(--gray-400)', marginBottom: 16, fontSize: 14, lineHeight: 1.5 }}>
                Per avvisarti quando lo spot è online. Non spammiamo.
              </p>

              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Il tuo nome *</label>
                <input type="text" className="input-vhs" value={form.contributor_name}
                  onChange={(e) => updateForm('contributor_name', e.target.value)}
                  placeholder="Come vuoi essere creditato sulla mappa" style={{ marginTop: 6 }} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Email *</label>
                <input type="email" className="input-vhs" value={form.contributor_email}
                  onChange={(e) => updateForm('contributor_email', e.target.value)}
                  placeholder="Per conferma e notifica approvazione" style={{ marginTop: 6 }} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Instagram (opzionale)</label>
                <input type="text" className="input-vhs" value={form.instagram_handle}
                  onChange={(e) => updateForm('instagram_handle', e.target.value.replace('@', ''))}
                  placeholder="handle senza @" style={{ marginTop: 6 }} />
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 20 }}>
                <input type="checkbox" checked={form.subscribe_newsletter}
                  onChange={(e) => updateForm('subscribe_newsletter', e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 2, accentColor: 'var(--orange)', flexShrink: 0 }} />
                <span style={{ color: 'var(--bone)', fontSize: 14, lineHeight: 1.5 }}>
                  Voglio ricevere aggiornamenti quando vengono aggiunti spot nella mia zona
                </span>
              </label>

              {error && <ErrorMsg msg={error} />}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={prevStep} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>← Indietro</button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !form.contributor_name || !form.contributor_email}
                  className="btn-primary"
                  style={{ flex: 2, justifyContent: 'center', opacity: loading || !form.contributor_name || !form.contributor_email ? 0.5 : 1 }}
                >
                  {loading ? '⏳ Invio...' : '🏴 INVIA SPOT'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: SUCCESSO */}
          {step === 'invio' && (
            <div style={{ textAlign: 'center', padding: '20px 0 40px' }}>
              <div style={{ fontSize: 60, marginBottom: 16 }}>🏴</div>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 26, color: 'var(--orange)', marginBottom: 12 }}>
                SPOT INVIATO!
              </h3>
              <p style={{ color: 'var(--bone)', lineHeight: 1.6, marginBottom: 24 }}>
                Grazie! Lo guardo entro 24-48 ore.<br />
                Ti mando un'email quando è online.
              </p>
              <button onClick={handleClose} className="btn-primary" style={{ padding: '12px 32px' }}>
                Torna alla mappa
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <p style={{
      color: 'var(--orange)',
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      marginBottom: 12,
      padding: '8px 12px',
      background: 'rgba(255,106,0,0.08)',
      borderRadius: 2,
      border: '1px solid rgba(255,106,0,0.3)',
    }}>
      ⚠ {msg}
    </p>
  );
}

// Piccola utility CSS inline
const inputLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--gray-400)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  display: 'block',
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).__inputLabel = inputLabelStyle; // hack per usarlo come className
