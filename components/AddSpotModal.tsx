'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TIPI_SPOT, CITTA_ITALIANE } from '@/lib/constants';
import type { SpotType } from '@/lib/types';
import PhotoUpload from './PhotoUpload';
import { useUser } from '@/hooks/useUser';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { signIn, signUp, checkUsername } from '@/lib/auth-client';

interface AddSpotModalProps {
  open:        boolean;
  onClose:     () => void;
  initialLat?: number;
  initialLon?: number;
}

type Step           = 'gps' | 'foto' | 'dati' | 'invio';
type LocationMethod = 'gps' | 'search' | null;
type AuthTab        = 'accedi' | 'registrati';

const STEP_ORDER: Step[] = ['gps', 'foto', 'dati', 'invio'];
const STEP_LABELS: Record<Step, string> = {
  gps:   'Posizione',
  foto:  'Foto',
  dati:  'Dettagli',
  invio: 'Inviato!',
};

interface NominatimResult {
  place_id:     number;
  display_name: string;
  lat:          string;
  lon:          string;
  type:         string;
  address?: {
    city?:         string;
    town?:         string;
    village?:      string;
    municipality?: string;
    county?:       string;
  };
}

/* ─── shared input styles (same as AuthModal) ─── */
const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--gray-700)', border: '1px solid var(--gray-600)',
  borderRadius: 4, color: 'var(--bone)', fontFamily: 'var(--font-mono)',
  fontSize: 15, padding: '10px 12px', outline: 'none',
};
const lbl: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)',
  textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5,
};

export default function AddSpotModal({ open, onClose, initialLat, initialLon }: AddSpotModalProps) {
  const user = useUser();

  /* ── Spot form state ── */
  const [step,    setStep]    = useState<Step>('gps');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [photos,  setPhotos]  = useState<File[]>([]);

  /* ── Location state ── */
  const [locMethod,      setLocMethod]      = useState<LocationMethod>(null);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [searchResults,  setSearchResults]  = useState<NominatimResult[]>([]);
  const [searching,      setSearching]      = useState(false);
  const [selectedResult, setSelectedResult] = useState<NominatimResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Inline auth state ── */
  const [authTab,      setAuthTab]      = useState<AuthTab>('registrati');
  const [authError,    setAuthError]    = useState<string | null>(null);
  const [authLoading,  setAuthLoading]  = useState(false);
  const [authDone,     setAuthDone]     = useState<'ok' | 'confirm_email' | null>(null);
  // registrati
  const [regUsername,  setRegUsername]  = useState('');
  const [regEmail,     setRegEmail]     = useState('');
  const [regPassword,  setRegPassword]  = useState('');
  const [usernameOk,   setUsernameOk]   = useState<boolean | null>(null);
  const [checkingUn,   setCheckingUn]   = useState(false);
  // accedi
  const [loginEmail,    setLoginEmail]    = useState('');
  const [loginPassword, setLoginPassword] = useState('');

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
    if (initialLat && initialLon) {
      setForm(f => ({ ...f, lat: initialLat, lon: initialLon }));
      setLocMethod('gps');
    }
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

  /* ── Nominatim search con debounce ── */
  useEffect(() => {
    if (locMethod !== 'search') return;
    if (searchQuery.trim().length < 3) { setSearchResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=6&addressdetails=1&accept-language=it`;
        const res  = await fetch(url, { headers: { 'Accept-Language': 'it' } });
        const data = await res.json();
        setSearchResults(data);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
  }, [searchQuery, locMethod]);

  const pickResult = (r: NominatimResult) => {
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    update('lat', lat); update('lon', lon);
    const cityName = r.address?.city || r.address?.town || r.address?.village || r.address?.municipality || '';
    if (cityName) {
      const match = CITTA_ITALIANE.find(c =>
        c.label.toLowerCase().includes(cityName.toLowerCase()) ||
        cityName.toLowerCase().includes(c.label.toLowerCase())
      );
      if (match) update('city', match.value);
    }
    setSelectedResult(r); setSearchResults([]); setError(null);
  };

  const resetLocation = () => {
    setLocMethod(null); setSearchQuery(''); setSearchResults([]);
    setSelectedResult(null); update('lat', 0); update('lon', 0); update('city', '');
  };

  /* ── Auth handlers ── */
  let unDebounce: ReturnType<typeof setTimeout>;
  const onUsernameChange = (val: string) => {
    const clean = val.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30);
    setRegUsername(clean); setUsernameOk(null);
    clearTimeout(unDebounce);
    if (clean.length < 3) return;
    setCheckingUn(true);
    unDebounce = setTimeout(async () => {
      const free = await checkUsername(clean);
      setUsernameOk(free); setCheckingUn(false);
    }, 600);
  };

  const handleSignUp = async () => {
    if (!regUsername || !regEmail || !regPassword) { setAuthError('Compila tutti i campi.'); return; }
    if (regUsername.length < 3) { setAuthError('Username troppo corto (min 3 caratteri).'); return; }
    if (regPassword.length < 6) { setAuthError('Password troppo corta (min 6 caratteri).'); return; }
    setAuthLoading(true); setAuthError(null);
    try {
      const result = await signUp(regEmail, regPassword, regUsername);
      setAuthDone(result);
      // If email confirm not required → user session will appear via useUser
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally { setAuthLoading(false); }
  };

  const handleSignIn = async () => {
    if (!loginEmail || !loginPassword) { setAuthError('Inserisci email e password.'); return; }
    setAuthLoading(true); setAuthError(null);
    try {
      await signIn(loginEmail, loginPassword);
      // useUser() will re-render automatically — auth gate disappears
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally { setAuthLoading(false); }
  };

  /* ── Spot submit ── */
  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const { data: { session } } = await supabaseBrowser().auth.getSession();
      const token = session?.access_token ?? '';
      const fd    = new FormData();
      const payload = {
        name:         form.name,
        type:         form.type as SpotType,
        lat:          form.lat,
        lon:          form.lon,
        city:         form.city        || undefined,
        description:  form.description || undefined,
        guardians:    form.notes       || undefined,
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
    } finally { setLoading(false); }
  };

  const handleClose = () => {
    setStep('gps'); setError(null); setPhotos([]);
    setLocMethod(null); setSearchQuery(''); setSearchResults([]); setSelectedResult(null);
    setForm({ name: '', type: '' as SpotType | '', lat: 0, lon: 0, city: '', description: '', notes: '' });
    setAuthError(null); setAuthDone(null);
    setRegUsername(''); setRegEmail(''); setRegPassword('');
    setLoginEmail(''); setLoginPassword('');
    onClose();
  };

  if (!open) return null;

  const stepIndex    = STEP_ORDER.indexOf(step);
  const goNext       = () => { setError(null); setStep(STEP_ORDER[stepIndex + 1]); };
  const goPrev       = () => { setError(null); setStep(STEP_ORDER[stepIndex - 1]); };
  const totalSteps   = STEP_ORDER.length - 1;
  const progressPct  = step === 'invio' ? 100 : (stepIndex / (totalSteps - 1)) * 100;
  const isLoading    = user === undefined;
  const hasCoords    = form.lat !== 0 && form.lon !== 0;
  const osmEmbed     = hasCoords ? `https://www.openstreetmap.org/export/embed.html?bbox=${form.lon - 0.003},${form.lat - 0.002},${form.lon + 0.003},${form.lat + 0.002}&layer=mapnik&marker=${form.lat},${form.lon}` : '';
  const streetViewUrl = hasCoords ? `https://www.google.com/maps/@${form.lat},${form.lon},3a,90y,210h,90t/data=!3m6!1e1!3m4!1s!2e0!7i13312!8i6656` : '';

  return (
    <>
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

        {/* Progress bar — visible only when logged in and not on success */}
        {user && step !== 'invio' && (
          <div style={{ height: 3, background: 'var(--gray-700)' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--orange)', transition: 'width 0.3s ease-out' }} />
          </div>
        )}

        <div style={{ padding: '20px 20px 0' }}>

          {/* ── Loading ── */}
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'var(--font-mono)', color: 'var(--gray-400)', fontSize: 15 }}>...</div>
          )}

          {/* ═══════════════════════════════════════════════
              ── AUTH GATE (inline, no second modal) ──
              Shown when user is null (not loading, not logged in)
              ═══════════════════════════════════════════════ */}
          {!isLoading && !user && (

            /* email confirm screen */
            authDone === 'confirm_email' ? (
              <div style={{ textAlign: 'center', padding: '32px 0 40px' }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>📬</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--orange)', marginBottom: 10 }}>
                  CONTROLLA LA TUA EMAIL
                </div>
                <p style={{ color: 'var(--bone)', lineHeight: 1.6, marginBottom: 8 }}>
                  Ti abbiamo inviato un link di conferma a<br />
                  <strong style={{ color: 'var(--orange)' }}>{regEmail}</strong>
                </p>
                <p style={{ color: 'var(--gray-400)', fontSize: 13, marginBottom: 24 }}>
                  Dopo la conferma accedi e potrai aggiungere il tuo spot.
                </p>
                <button
                  onClick={() => { setAuthDone(null); setAuthTab('accedi'); }}
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  🔑 Vai ad Accedi
                </button>
              </div>

            ) : (
              <div>
                {/* Intro text */}
                <p style={{ color: 'var(--gray-400)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
                  Crea un account gratuito o accedi — il tuo{' '}
                  <strong style={{ color: 'var(--orange)' }}>@username</strong>{' '}
                  apparirà sullo spot.
                </p>

                {/* Tab switcher */}
                <div style={{ display: 'flex', marginBottom: 20, borderBottom: '1px solid var(--gray-700)' }}>
                  {(['registrati', 'accedi'] as AuthTab[]).map(t => (
                    <button
                      key={t}
                      onClick={() => { setAuthTab(t); setAuthError(null); }}
                      style={{
                        flex: 1, fontFamily: 'var(--font-mono)', fontSize: 14,
                        padding: '12px 0', border: 'none', background: 'transparent',
                        color: authTab === t ? 'var(--orange)' : 'var(--gray-400)',
                        borderBottom: `2px solid ${authTab === t ? 'var(--orange)' : 'transparent'}`,
                        cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
                        transition: 'color 0.15s',
                      }}
                    >
                      {t === 'accedi' ? '🔑 Accedi' : '🏴 Registrati'}
                    </button>
                  ))}
                </div>

                {/* REGISTRATI */}
                {authTab === 'registrati' && (
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div>
                      <label style={lbl}>Username *</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          style={{ ...inp, paddingLeft: 28, borderColor: usernameOk === false ? '#ff4444' : usernameOk === true ? '#00c851' : 'var(--gray-600)' }}
                          value={regUsername}
                          onChange={e => onUsernameChange(e.target.value)}
                          placeholder="es. chrispy_bmx"
                          maxLength={30}
                        />
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontFamily: 'var(--font-mono)', fontSize: 14 }}>@</span>
                        {checkingUn && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontSize: 12 }}>...</span>}
                        {!checkingUn && usernameOk === true  && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#00c851' }}>✓</span>}
                        {!checkingUn && usernameOk === false && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#ff4444' }}>✗</span>}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                        Solo lettere, numeri e _. Min 3 caratteri.
                      </div>
                      {usernameOk === false && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff4444', marginTop: 2 }}>Username già in uso</div>}
                    </div>
                    <div>
                      <label style={lbl}>Email *</label>
                      <input type="email" style={inp} value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="la-tua@email.com" />
                    </div>
                    <div>
                      <label style={lbl}>Password * (min 6 caratteri)</label>
                      <input type="password" style={inp} value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSignUp()} />
                    </div>
                    {authError && <AuthErr msg={authError} />}
                    <button
                      onClick={handleSignUp}
                      disabled={authLoading || usernameOk === false}
                      className="btn-primary"
                      style={{ width: '100%', justifyContent: 'center', opacity: (authLoading || usernameOk === false) ? 0.6 : 1 }}
                    >
                      {authLoading ? '⏳ Registrazione...' : '🏴 CREA ACCOUNT E CONTINUA'}
                    </button>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', textAlign: 'center', lineHeight: 1.5 }}>
                      Gratuito, niente spam. Accetti i termini community BMX.
                    </p>
                  </div>
                )}

                {/* ACCEDI */}
                {authTab === 'accedi' && (
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div>
                      <label style={lbl}>Email</label>
                      <input type="email" style={inp} value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="la-tua@email.com" onKeyDown={e => e.key === 'Enter' && handleSignIn()} />
                    </div>
                    <div>
                      <label style={lbl}>Password</label>
                      <input type="password" style={inp} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSignIn()} />
                    </div>
                    {authError && <AuthErr msg={authError} />}
                    <button
                      onClick={handleSignIn}
                      disabled={authLoading}
                      className="btn-primary"
                      style={{ width: '100%', justifyContent: 'center', opacity: authLoading ? 0.6 : 1 }}
                    >
                      {authLoading ? '⏳ Accesso...' : '🔑 ENTRA E CONTINUA'}
                    </button>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)', textAlign: 'center' }}>
                      Non hai un account?{' '}
                      <button onClick={() => { setAuthTab('registrati'); setAuthError(null); }} style={{ background: 'none', border: 'none', color: 'var(--orange)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                        Registrati →
                      </button>
                    </p>
                  </div>
                )}
              </div>
            )
          )}

          {/* ── STEP 1: POSIZIONE ── */}
          {!isLoading && user && step === 'gps' && (
            <div>
              {/* Badge utente */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '10px 12px', background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.2)', borderRadius: 6 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 16, color: '#000', flexShrink: 0 }}>
                  {user.username[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)' }}>@{user.username}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)' }}>Lo spot sarà associato al tuo account</div>
                </div>
              </div>

              {/* Selezione metodo */}
              {!locMethod && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Come vuoi indicare la posizione?
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button onClick={() => setLocMethod('gps')} style={methodBtn}>
                      <span style={{ fontSize: 28 }}>📍</span>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--bone)', marginBottom: 2 }}>Sono nello spot</div>
                        <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>Usa il GPS del telefono</div>
                      </div>
                    </button>
                    <button onClick={() => setLocMethod('search')} style={methodBtn}>
                      <span style={{ fontSize: 28 }}>🔍</span>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--bone)', marginBottom: 2 }}>Conosco la posizione</div>
                        <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>Cerca l&apos;indirizzo o il nome del posto</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* GPS path */}
              {locMethod === 'gps' && (
                <div style={{ marginBottom: 16 }}>
                  <button onClick={getGPS} className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}>
                    📍 Usa la mia posizione GPS
                  </button>
                  {hasCoords && (
                    <div style={{ background: 'var(--gray-700)', padding: 12, borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)', marginBottom: 4 }}>
                      ✅ {form.lat.toFixed(6)}, {form.lon.toFixed(6)}
                    </div>
                  )}
                  <button onClick={resetLocation} style={{ background: 'none', border: 'none', color: 'var(--gray-400)', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', padding: '4px 0' }}>
                    ← Cambia metodo
                  </button>
                </div>
              )}

              {/* SEARCH path (Nominatim) */}
              {locMethod === 'search' && (
                <div style={{ marginBottom: 16 }}>
                  {!selectedResult && (
                    <div style={{ position: 'relative', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--gray-700)', border: '1px solid var(--gray-600)', borderRadius: 6, padding: '10px 14px' }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{searching ? '⏳' : '🔍'}</span>
                        <input
                          autoFocus
                          type="text"
                          placeholder="es. Skatepark Dergano Milano, Piazza Navona Roma..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 15, color: 'var(--bone)', outline: 'none', fontFamily: 'var(--font-mono)' }}
                        />
                        {searchQuery && (
                          <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} style={{ background: 'none', border: 'none', color: 'var(--gray-400)', fontSize: 18, cursor: 'pointer', padding: 0, flexShrink: 0 }}>✕</button>
                        )}
                      </div>
                      {searchResults.length > 0 && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--gray-700)', border: '1px solid var(--orange)', borderRadius: 6, overflow: 'hidden', zIndex: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                          {searchResults.map(r => (
                            <button
                              key={r.place_id}
                              onClick={() => pickResult(r)}
                              style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', padding: '11px 14px', background: 'none', border: 'none', borderTop: '1px solid var(--gray-600)', color: 'var(--bone)', textAlign: 'left', cursor: 'pointer', transition: 'background 0.1s' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,106,0,0.1)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            >
                              <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>📍</span>
                              <div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)', lineHeight: 1.4 }}>{r.display_name.split(',').slice(0, 2).join(',')}</div>
                                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{r.display_name.split(',').slice(2, 4).join(',').trim()}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchQuery.trim().length >= 3 && searchResults.length === 0 && !searching && (
                        <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)' }}>
                          Nessun risultato. Prova con un indirizzo diverso.
                        </div>
                      )}
                    </div>
                  )}

                  {selectedResult && hasCoords && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid var(--gray-600)', marginBottom: 10, height: 160 }}>
                        <iframe src={osmEmbed} style={{ width: '100%', height: '100%', border: 'none' }} loading="lazy" title="Anteprima posizione" />
                      </div>
                      <div style={{ background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.25)', borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--orange)', marginBottom: 4 }}>✅ Posizione trovata</div>
                        <div style={{ fontSize: 12, color: 'var(--bone)', lineHeight: 1.5 }}>{selectedResult.display_name.split(',').slice(0, 3).join(',')}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginTop: 3 }}>{form.lat.toFixed(6)}, {form.lon.toFixed(6)}</div>
                      </div>
                      <a href={streetViewUrl} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--gray-700)', border: '1px solid var(--gray-600)', borderRadius: 6, textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)', marginBottom: 8, transition: 'border-color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--orange)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--gray-600)')}
                      >
                        <span style={{ fontSize: 18 }}>🧍</span>
                        <div style={{ flex: 1 }}>
                          <div>Verifica su Street View</div>
                          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 1 }}>Si apre Google Maps in una nuova tab</div>
                        </div>
                        <span style={{ color: 'var(--gray-400)' }}>↗</span>
                      </a>
                      <button onClick={() => { setSelectedResult(null); setSearchQuery(''); setSearchResults([]); update('lat', 0); update('lon', 0); }} style={{ background: 'none', border: 'none', color: 'var(--gray-400)', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', padding: '4px 0' }}>
                        ← Cerca di nuovo
                      </button>
                    </div>
                  )}

                  {!selectedResult && (
                    <button onClick={resetLocation} style={{ background: 'none', border: 'none', color: 'var(--gray-400)', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', padding: '4px 0' }}>
                      ← Cambia metodo
                    </button>
                  )}
                </div>
              )}

              {/* Città */}
              {locMethod && (
                <div style={{ marginBottom: 16 }}>
                  <label className="input-label">Città (opzionale)</label>
                  <select className="input-vhs" value={form.city} onChange={e => update('city', e.target.value)} style={{ marginTop: 6 }}>
                    <option value="">Seleziona città...</option>
                    {CITTA_ITALIANE.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              )}

              {error && <Err msg={error} />}

              {locMethod && (
                <button onClick={goNext} disabled={!hasCoords} className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4, opacity: hasCoords ? 1 : 0.5 }}>
                  Avanti →
                </button>
              )}
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

/* ─── Shared sub-components ─── */
const methodBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 14,
  width: '100%', padding: '14px 16px',
  background: 'var(--gray-700)', border: '1px solid var(--gray-600)',
  borderRadius: 8, cursor: 'pointer', textAlign: 'left',
  transition: 'border-color 0.15s, background 0.15s',
};

function Err({ msg }: { msg: string }) {
  return (
    <p style={{ color: 'var(--orange)', fontFamily: 'var(--font-mono)', fontSize: 13, marginBottom: 12, padding: '8px 12px', background: 'rgba(255,106,0,0.08)', borderRadius: 2, border: '1px solid rgba(255,106,0,0.3)' }}>
      ⚠ {msg}
    </p>
  );
}

function AuthErr({ msg }: { msg: string }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#ff4444', background: 'rgba(255,50,50,0.08)', border: '1px solid rgba(255,50,50,0.2)', borderRadius: 4, padding: '8px 12px' }}>
      ⚠ {msg}
    </div>
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
