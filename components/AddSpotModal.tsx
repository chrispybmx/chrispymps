'use client';

import { useState, useEffect, useCallback } from 'react';
import { TIPI_SPOT, CITTA_ITALIANE } from '@/lib/constants';
import type { SpotType, SubmitSpotPayload } from '@/lib/types';
import PhotoUpload from './PhotoUpload';

interface AddSpotModalProps {
  open:         boolean;
  onClose:      () => void;
  initialLat?:  number;
  initialLon?:  number;
}

type Step = 'gps' | 'foto' | 'dati' | 'info' | 'invio';

const STEP_ORDER: Step[] = ['gps', 'foto', 'dati', 'info', 'invio'];
const STEP_LABELS: Record<Step, string> = {
  gps:   'Posizione',
  foto:  'Foto',
  dati:  'Dettagli',
  info:  'Chi sei',
  invio: 'Inviato!',
};

const LS_KEY = 'cmps_contributor';

export default function AddSpotModal({ open, onClose, initialLat, initialLon }: AddSpotModalProps) {
  const [step,    setStep]    = useState<Step>('gps');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [photos,  setPhotos]  = useState<File[]>([]);

  const [form, setForm] = useState({
    name:              '',
    type:              '' as SpotType | '',
    lat:               initialLat ?? 0,
    lon:               initialLon ?? 0,
    city:              '',
    description:       '',
    notes:             '',
    contributor_name:  '',
    contributor_email: '',
  });

  // Ripristina nome/email da localStorage
  useEffect(() => {
    if (!open) return;
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const { name, email } = JSON.parse(saved);
        setForm((f) => ({
          ...f,
          contributor_name:  name  || f.contributor_name,
          contributor_email: email || f.contributor_email,
        }));
      }
    } catch {}
  }, [open]);

  useEffect(() => {
    if (initialLat && initialLon) {
      setForm((f) => ({ ...f, lat: initialLat, lon: initialLon }));
    }
  }, [initialLat, initialLon]);

  const update = useCallback(<K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const getGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocalizzazione non disponibile su questo dispositivo.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update('lat', pos.coords.latitude);
        update('lon', pos.coords.longitude);
        setError(null);
      },
      () => setError('Impossibile ottenere la posizione. Assicurati di essere nello spot.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [update]);

  const stepIndex = STEP_ORDER.indexOf(step);
  const goNext = () => { setError(null); setStep(STEP_ORDER[stepIndex + 1]); };
  const goPrev = () => { setError(null); setStep(STEP_ORDER[stepIndex - 1]); };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      const payload: SubmitSpotPayload = {
        name:              form.name,
        type:              form.type as SpotType,
        lat:               form.lat,
        lon:               form.lon,
        city:              form.city    || undefined,
        description:       form.description || undefined,
        guardians:         form.notes   || undefined,
        contributor_name:  form.contributor_name,
        contributor_email: form.contributor_email,
      };
      fd.append('data', JSON.stringify(payload));
      photos.forEach((p, i) => fd.append(`photo_${i}`, p));

      const res  = await fetch('/api/submit-spot', { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Errore durante l\'invio');

      try {
        localStorage.setItem(LS_KEY, JSON.stringify({
          name:  form.contributor_name,
          email: form.contributor_email,
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
    setForm({
      name: '', type: '' as SpotType | '',
      lat: 0, lon: 0, city: '',
      description: '', notes: '',
      contributor_name: '', contributor_email: '',
    });
    onClose();
  };

  if (!open) return null;

  const totalSteps = STEP_ORDER.length - 1; // escludi 'invio' dal conteggio
  const progressPct = step === 'invio' ? 100 : ((stepIndex) / (totalSteps - 1)) * 100;

  return (
    <>
      {/* Overlay */}
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

      {/* Drawer */}
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
          padding: '12px 20px 14px',
          borderBottom: '1px solid var(--gray-700)',
        }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--orange)', margin: 0 }}>
              🏴 AGGIUNGI SPOT
            </h2>
            {step !== 'invio' && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
                STEP {stepIndex + 1}/{totalSteps} — {STEP_LABELS[step].toUpperCase()}
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
              width: `${progressPct}%`,
              background: 'var(--orange)',
              transition: 'width 0.3s ease-out',
            }} />
          </div>
        )}

        <div style={{ padding: '20px 20px 0' }}>

          {/* ── STEP 1: GPS ── */}
          {step === 'gps' && (
            <div>
              <p style={{ color: 'var(--bone)', marginBottom: 20, lineHeight: 1.5 }}>
                Sei nello spot? Premi il pulsante per salvare la posizione GPS.
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
                  onChange={(e) => update('city', e.target.value)}
                  style={{ marginTop: 6 }}
                >
                  <option value="">Seleziona città...</option>
                  {CITTA_ITALIANE.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {error && <Err msg={error} />}

              <button
                onClick={goNext}
                disabled={form.lat === 0}
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: 4, opacity: form.lat === 0 ? 0.5 : 1 }}
              >
                Avanti →
              </button>
            </div>
          )}

          {/* ── STEP 2: FOTO ── */}
          {step === 'foto' && (
            <div>
              <p style={{ color: 'var(--gray-400)', marginBottom: 16, fontSize: 14 }}>
                Carica fino a 5 foto. La prima sarà la cover.
              </p>
              <PhotoUpload photos={photos} onChange={setPhotos} />
              {error && <Err msg={error} />}
              <NavButtons onPrev={goPrev} onNext={goNext} />
            </div>
          )}

          {/* ── STEP 3: DATI SPOT ── */}
          {step === 'dati' && (
            <div>
              {/* Nome */}
              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Nome spot *</label>
                <input
                  type="text"
                  className="input-vhs"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="es. Gradoni Piazza Bra"
                  style={{ marginTop: 6 }}
                />
              </div>

              {/* Tipo */}
              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Tipo spot *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {(Object.entries(TIPI_SPOT) as [SpotType, typeof TIPI_SPOT[SpotType]][]).map(([type, info]) => (
                    <button
                      key={type}
                      onClick={() => update('type', type)}
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

              {/* Descrizione */}
              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Descrizione (opzionale)</label>
                <textarea
                  className="input-vhs"
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  placeholder="Cosa c'è nello spot? Com'è il fondo?"
                  rows={3}
                  style={{ marginTop: 6, resize: 'vertical' }}
                />
              </div>

              {/* Note */}
              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Note (guardiani, orari, accesso…)</label>
                <input
                  type="text"
                  className="input-vhs"
                  value={form.notes}
                  onChange={(e) => update('notes', e.target.value)}
                  placeholder='es. "Evitare ore di punta" / "Sempre libero"'
                  style={{ marginTop: 6 }}
                />
              </div>

              {error && <Err msg={error} />}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={goPrev} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>← Indietro</button>
                <button
                  onClick={goNext}
                  disabled={!form.name || !form.type}
                  className="btn-primary"
                  style={{ flex: 2, justifyContent: 'center', opacity: (!form.name || !form.type) ? 0.5 : 1 }}
                >
                  Avanti →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: CHI SEI ── */}
          {step === 'info' && (
            <div>
              <p style={{ color: 'var(--gray-400)', marginBottom: 16, fontSize: 14, lineHeight: 1.5 }}>
                Ti avvisiamo via email quando lo spot è approvato online.
              </p>

              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Il tuo nome *</label>
                <input
                  type="text"
                  className="input-vhs"
                  value={form.contributor_name}
                  onChange={(e) => update('contributor_name', e.target.value)}
                  placeholder="Come vuoi essere creditato"
                  style={{ marginTop: 6 }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label className="input-label">Email *</label>
                <input
                  type="email"
                  className="input-vhs"
                  value={form.contributor_email}
                  onChange={(e) => update('contributor_email', e.target.value)}
                  placeholder="Per conferma e notifica"
                  style={{ marginTop: 6 }}
                />
              </div>

              {error && <Err msg={error} />}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={goPrev} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>← Indietro</button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !form.contributor_name || !form.contributor_email}
                  className="btn-primary"
                  style={{
                    flex: 2, justifyContent: 'center',
                    opacity: (loading || !form.contributor_name || !form.contributor_email) ? 0.5 : 1,
                  }}
                >
                  {loading ? '⏳ Invio...' : '🏴 INVIA SPOT'}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 5: SUCCESSO ── */}
          {step === 'invio' && (
            <div style={{ textAlign: 'center', padding: '20px 0 40px' }}>
              <div style={{ fontSize: 60, marginBottom: 16 }}>🏴</div>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 26, color: 'var(--orange)', marginBottom: 12 }}>
                SPOT INVIATO!
              </h3>
              <p style={{ color: 'var(--bone)', lineHeight: 1.6, marginBottom: 24 }}>
                Grazie! Lo revisionerò entro 24-48 ore.<br />
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

/* ── Utility components ── */

function Err({ msg }: { msg: string }) {
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

function NavButtons({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
      <button onClick={onPrev} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>← Indietro</button>
      <button onClick={onNext} className="btn-primary"   style={{ flex: 2, justifyContent: 'center' }}>Avanti →</button>
    </div>
  );
}
