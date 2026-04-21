'use client';

import { useState, useEffect, useCallback } from 'react';
import { TIPI_SPOT, CITTA_ITALIANE } from '@/lib/constants';
import type { SpotType, SubmitSpotPayload } from '@/lib/types';
import PhotoUpload from './PhotoUpload';
import AuthModal from './AuthModal';
import { useUser } from '@/hooks/useUser';
import { supabaseBrowser } from '@/lib/supabase';

interface AddSpotModalProps {
  open:        boolean;
  onClose:     () => void;
  initialLat?: number;
  initialLon?: number;
}

type Step = 'gps' | 'foto' | 'dati' | 'invio';
const STEP_ORDER: Step[] = ['gps', 'foto', 'dati', 'invio'];
const STEP_LABELS: Record<Step, string> = {
  gps:   'Posizione',
  foto:  'Foto',
  dati:  'Dettagli',
  invio: 'Inviato!',
};

export default function AddSpotModal({ open, onClose, initialLat, initialLon }: AddSpotModalProps) {
  const user        = useUser();
  const [authOpen, setAuthOpen] = useState(false);

  const [step,    setStep]    = useState<Step>('gps');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [photos,  setPhotos]  = useState<File[]>([]);

  const [form, setForm] = useState({
    name:        '',
    type:        '' as SpotType | '',
    lat:         initialLat ?? 0,
    lon:         initialLon ?? 0,
    city:        '',
    description: '',
    notes:       '',
  });

  useEffect(() => {
    if (initialLat && initialLon) setForm(f => ({ ...f, lat: initialLat, lon: initialLon }));
  }, [initialLat, initialLon]);

  const update = useCallback(<K extends keyof typeof form>(key: K, val: typeof form[K]) => {
    setForm(f => ({ ...f, [key]: val }));
  }, []);

  const getGPS = useCallback(() => {
    if (!navigator.geolocation) { setError('Geolocalizzazione non disponibile.'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => { update('lat', pos.coords.latitude); update('lon', pos.coords.longitude); setError(null); },
      () => setError('Impossibile ottenere la posizione. Sei nello spot?'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [update]);

  const stepIndex = STEP_ORDER.indexOf(step);
  const goNext = () => { setError(null); setStep(STEP_ORDER[stepIndex + 1]); };
  const goPrev = () => { setError(null); setStep(STEP_ORDER[stepIndex - 1]); };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      // Ottieni access token per autenticare la chiamata server
      const { data: { session } } = await supabaseBrowser().auth.getSession();
      const token = session?.access_token ?? '';

      const fd = new FormData();
      const payload = {
        name:        form.name,
        type:        form.type as SpotType,
        lat:         form.lat,
        lon:         form.lon,
        city:        form.city        || undefined,
        description: form.description || undefined,
        guardians:   form.notes       || undefined,
        access_token: token,
      };
      fd.append('data', JSON.stringify(payload));
      photos.forEach((p, i) => fd.append(`photo_${i}`, p));

      const res  = await fetch('/api/submit-spot', { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Errore durante l\'invio');
      setStep('invio');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('gps'); setError(null); setPhotos([]);
    setForm({ name: '', type: '' as SpotType | '', lat: 0, lon: 0, city: '', description: '', notes: '' });
    onClose();
  };

  if (!open) return null;

  const totalSteps  = STEP_ORDER.length - 1;
  const progressPct = step === 'invio' ? 100 : (stepIndex / (totalSteps - 1)) * 100;
  const isLoading   = user === undefined;

  return (
    <>
      {/* Auth Modal (se non loggato) */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} defaultTab="registrati" />

      {/* Overlay */}
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 69, backdropFilter: 'blur(4px)' }} aria-hidden />

      {/* Drawer */}
      <div
        role="dialog" aria-modal aria-label="Aggiungi spot BMX"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--gray-800)', borderTop: '2px solid var(--orange)',
          borderRadius: '16px 16px 0 0', zIndex: 70,
          maxHeight: '92dvh', overflowY: 'auto', overscrollBehavior: 'contain',
          animation: 'slideUp 0.3s ease-out',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
        }}
      >
        <div className="bottom-sheet-handle" />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 14px', borderBottom: '1px solid var(--gray-700)' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--orange)', margin: 0 }}>🏴 AGGIUNGI SPOT</h2>
            {!isLoading && user && step !== 'invio' && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
                STEP {stepIndex + 1}/{totalSteps} — {STEP_LABELS[step].toUpperCase()}
              </div>
            )}
          </div>
          <button onClick={handleClose} className="btn-ghost" aria-label="Chiudi" style={{ fontSize: 20 }}>✕</button>
        </div>

        {/* Progress bar */}
        {user && step !== 'invio' && (
          <div style={{ height: 3, background: 'var(--gray-700)' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--orange)', transition: 'width 0.3s ease-out' }} />
          </div>
        )}

        <div style={{ padding: '20px 20px 0' }}>

          {/* Loading auth */}
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'var(--font-mono)', color: 'var(--gray-400)', fontSize: 15 }}>
              ...
            </div>
          )}

          {/* ── AUTH GATE ── */}
          {!isLoading && !user && (
            <div style={{ textAlign: 'center', padding: '20px 0 32px' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🏴</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--orange)', marginBottom: 12 }}>
                ACCEDI PER AGGIUNGERE
              </div>
              <p style={{ color: 'var(--bone)', lineHeight: 1.7, marginBottom: 24, fontSize: 15 }}>
                Devi avere un account per aggiungere spot.<br />
                Il tuo <strong style={{ color: 'var(--orange)' }}>@username</strong> sarà visibile sullo spot.
              </p>
              <button
                onClick={() => { setAuthOpen(true); }}
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}
              >
                🔑 Accedi / Registrati
              </button>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)' }}>
                Gratuito, niente spam.
              </p>
            </div>
          )}

          {/* ── STEP 1: GPS ── */}
          {!isLoading && user && step === 'gps' && (
            <div>
              {/* Info utente */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '10px 12px', background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.2)', borderRadius: 6 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 16, color: '#000', flexShrink: 0 }}>
                  {user.username[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)' }}>@{user.username}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)' }}>Lo spot sarà associato al tuo account</div>
                </div>
              </div>

              <p style={{ color: 'var(--bone)', marginBottom: 20, lineHeight: 1.5 }}>
                Sei nello spot? Premi il pulsante per salvare la posizione GPS.
              </p>
              <button onClick={getGPS} className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}>
                📍 Usa la mia posizione GPS
              </button>
              {form.lat !== 0 && (
                <div style={{ background: 'var(--gray-700)', padding: 12, borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)', marginBottom: 16 }}>
                  ✅ {form.lat.toFixed(6)}, {form.lon.toFixed(6)}
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Città (opzionale)</label>
                <select className="input-vhs" value={form.city} onChange={e => update('city', e.target.value)} style={{ marginTop: 6 }}>
                  <option value="">Seleziona città...</option>
                  {CITTA_ITALIANE.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              {error && <Err msg={error} />}
              <button onClick={goNext} disabled={form.lat === 0} className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: 4, opacity: form.lat === 0 ? 0.5 : 1 }}>
                Avanti →
              </button>
            </div>
          )}

          {/* ── STEP 2: FOTO ── */}
          {!isLoading && user && step === 'foto' && (
            <div>
              <p style={{ color: 'var(--gray-400)', marginBottom: 16, fontSize: 14 }}>Carica fino a 5 foto. La prima sarà la cover.</p>
              <PhotoUpload photos={photos} onChange={setPhotos} />
              {error && <Err msg={error} />}
              <NavButtons onPrev={goPrev} onNext={goNext} />
            </div>
          )}

          {/* ── STEP 3: DATI SPOT ── */}
          {!isLoading && user && step === 'dati' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Nome spot *</label>
                <input type="text" className="input-vhs" value={form.name} onChange={e => update('name', e.target.value)} placeholder="es. Gradoni Piazza Bra" style={{ marginTop: 6 }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Tipo spot *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {(Object.entries(TIPI_SPOT) as [SpotType, typeof TIPI_SPOT[SpotType]][]).map(([type, info]) => (
                    <button key={type} onClick={() => update('type', type)} style={{
                      padding: '6px 12px',
                      border: `1px solid ${form.type === type ? info.color : 'var(--gray-600)'}`,
                      borderRadius: 2,
                      background: form.type === type ? info.color : 'transparent',
                      color: form.type === type ? 'var(--black)' : 'var(--bone)',
                      fontFamily: 'var(--font-mono)', fontSize: 13, cursor: 'pointer', transition: 'all 0.1s',
                    }}>
                      {info.emoji} {info.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Descrizione (opzionale)</label>
                <textarea className="input-vhs" value={form.description} onChange={e => update('description', e.target.value)}
                  placeholder="Cosa c'è nello spot? Com'è il fondo?" rows={3} style={{ marginTop: 6, resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Note (guardiani, orari, accesso…)</label>
                <input type="text" className="input-vhs" value={form.notes} onChange={e => update('notes', e.target.value)}
                  placeholder='es. "Evitare ore di punta" / "Sempre libero"' style={{ marginTop: 6 }} />
              </div>
              {error && <Err msg={error} />}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={goPrev} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>← Indietro</button>
                <button onClick={handleSubmit} disabled={loading || !form.name || !form.type} className="btn-primary"
                  style={{ flex: 2, justifyContent: 'center', opacity: (loading || !form.name || !form.type) ? 0.5 : 1 }}>
                  {loading ? '⏳ Invio...' : '🏴 INVIA SPOT'}
                </button>
              </div>
            </div>
          )}

          {/* ── SUCCESSO ── */}
          {step === 'invio' && (
            <div style={{ textAlign: 'center', padding: '20px 0 40px' }}>
              <div style={{ fontSize: 60, marginBottom: 16 }}>🏴</div>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 26, color: 'var(--orange)', marginBottom: 12 }}>SPOT INVIATO!</h3>
              <p style={{ color: 'var(--bone)', lineHeight: 1.6, marginBottom: 8 }}>Grazie <strong style={{ color: 'var(--orange)' }}>@{user?.username}</strong>! Lo revisionerò entro 24-48 ore.</p>
              <p style={{ color: 'var(--gray-400)', fontSize: 14, marginBottom: 24 }}>Il tuo spot sarà visibile su Chrispy Maps appena approvato.</p>
              <button onClick={handleClose} className="btn-primary" style={{ padding: '12px 32px' }}>Torna alla mappa</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Err({ msg }: { msg: string }) {
  return (
    <p style={{ color: 'var(--orange)', fontFamily: 'var(--font-mono)', fontSize: 13, marginBottom: 12, padding: '8px 12px', background: 'rgba(255,106,0,0.08)', borderRadius: 2, border: '1px solid rgba(255,106,0,0.3)' }}>
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
