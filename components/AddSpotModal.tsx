'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { TIPI_SPOT, CITTA_ITALIANE } from '@/lib/constants';
import type { SpotType } from '@/lib/types';
import PhotoUpload from './PhotoUpload';
import { useUser } from '@/hooks/useUser';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { signIn, signUp, checkUsername, signInWithGoogle } from '@/lib/auth-client';

interface AddSpotModalProps {
  open:        boolean;
  onClose:     () => void;
  initialLat?: number;
  initialLon?: number;
}

type Step        = 'posizione' | 'foto' | 'dettagli' | 'successo';
type AuthTab     = 'accedi' | 'registrati';
type SearchPhase = 'form' | 'preview'; // sotto-stati del percorso "cerca indirizzo"

const STEPS: Step[] = ['posizione', 'foto', 'dettagli'];
const STEP_LABEL: Record<Step, string> = {
  posizione: '1 — Posizione',
  foto:      '2 — Foto',
  dettagli:  '3 — Dettagli',
  successo:  '',
};

/* ─── quanto sposta ogni freccia (~55 m) ─── */
const NUDGE = 0.0005;

/* ─── shared styles ─── */
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

export default function AddSpotModal({ open, onClose, initialLat, initialLon }: AddSpotModalProps) {
  const user      = useUser();
  const isLoading = user === undefined;

  /* ── Wizard step ── */
  const [step, setStep] = useState<Step>('posizione');

  /* ── Posizione condivisa ── */
  const [lat,     setLat]     = useState<number | null>(initialLat ?? null);
  const [lon,     setLon]     = useState<number | null>(initialLon ?? null);
  const [city,    setCity]    = useState('');
  const [locMode, setLocMode] = useState<'gps' | 'search' | null>(initialLat != null ? 'gps' : null);

  /* ── GPS ── */
  const [gpsState, setGpsState] = useState<'idle' | 'loading' | 'ok' | 'error'>(
    initialLat != null ? 'ok' : 'idle'
  );

  /* ── Percorso "Conosco la posizione" ── */
  const [searchPhase,    setSearchPhase]    = useState<SearchPhase>('form');
  const [addrVia,        setAddrVia]        = useState('');
  const [addrCitta,      setAddrCitta]      = useState('');
  const [addrCap,        setAddrCap]        = useState('');
  const [geocoding,      setGeocoding]      = useState(false);
  const [geocodeError,   setGeocodeError]   = useState<string | null>(null);
  const [pickedAddress,  setPickedAddress]  = useState('');

  /* ── Foto ── */
  const [photos, setPhotos] = useState<File[]>([]);

  /* ── Dettagli ── */
  const [name,        setName]        = useState('');
  const [type,        setType]        = useState<SpotType | ''>('');
  const [description, setDescription] = useState('');
  const [notes,       setNotes]       = useState('');

  /* ── Submit ── */
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  /* ── Auth inline ── */
  const [authTab,      setAuthTab]      = useState<AuthTab>('accedi');
  const [authError,    setAuthError]    = useState<string | null>(null);
  const [authLoading,  setAuthLoading]  = useState(false);
  const [authDone,     setAuthDone]     = useState<'ok' | 'confirm_email' | null>(null);
  const [regUsername,  setRegUsername]  = useState('');
  const [regEmail,     setRegEmail]     = useState('');
  const [regPassword,  setRegPassword]  = useState('');
  const [usernameOk,   setUsernameOk]   = useState<boolean | null>(null);
  const [checkingUn,   setCheckingUn]   = useState(false);
  const [loginEmail,    setLoginEmail]    = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  /* ── Sync initialLat/Lon (tap sulla mappa) ── */
  useEffect(() => {
    if (initialLat != null && initialLon != null) {
      setLat(initialLat); setLon(initialLon);
      setLocMode('gps'); setGpsState('ok');
      reverseGeocode(initialLat, initialLon);
    }
  }, [initialLat, initialLon, reverseGeocode]);

  /* ── Reset ── */
  const handleClose = useCallback(() => {
    setStep('posizione');
    setLat(initialLat ?? null); setLon(initialLon ?? null); setCity('');
    setLocMode(initialLat != null ? 'gps' : null);
    setGpsState(initialLat != null ? 'ok' : 'idle');
    setSearchPhase('form');
    setAddrVia(''); setAddrCitta(''); setAddrCap(''); setPickedAddress('');
    setGeocoding(false); setGeocodeError(null);
    setPhotos([]);
    setName(''); setType(''); setDescription(''); setNotes('');
    setError(null); setSubmitting(false);
    setAuthError(null); setAuthDone(null);
    setRegUsername(''); setRegEmail(''); setRegPassword('');
    setLoginEmail(''); setLoginPassword('');
    onClose();
  }, [initialLat, initialLon, onClose]);

  /* ── Reverse geocoding: ricava città da lat/lon ── */
  const reverseGeocode = useCallback(async (lat: number, lon: number) => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=it`;
      const res  = await fetch(url, { headers: { 'Accept-Language': 'it' } });
      const data = await res.json();
      const cn = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || '';
      if (cn) {
        const match = CITTA_ITALIANE.find(c =>
          c.label.toLowerCase().includes(cn.toLowerCase()) ||
          cn.toLowerCase().includes(c.label.toLowerCase())
        );
        if (match) setCity(match.value);
      }
    } catch { /* silenziamo: la città resterà vuota */ }
  }, []);

  /* ── GPS ── */
  const getGPS = () => {
    if (!navigator.geolocation) { setGpsState('error'); return; }
    setGpsState('loading');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude); setLon(longitude); setGpsState('ok');
        reverseGeocode(latitude, longitude);
      },
      ()  => setGpsState('error'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  /* ── Geocodifica via Nominatim ── */
  const handleGeocode = async () => {
    if (!addrVia.trim() && !addrCitta.trim()) {
      setGeocodeError('Inserisci almeno via e città.');
      return;
    }
    setGeocoding(true); setGeocodeError(null);
    try {
      const q = [addrVia.trim(), addrCap.trim(), addrCitta.trim(), 'Italia']
        .filter(Boolean).join(', ');
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1&accept-language=it`;
      const res  = await fetch(url, { headers: { 'Accept-Language': 'it' } });
      const data = await res.json();
      if (!data.length) {
        setGeocodeError('Indirizzo non trovato. Prova a essere più preciso.');
        return;
      }
      const r = data[0];
      setLat(parseFloat(r.lat));
      setLon(parseFloat(r.lon));
      setPickedAddress(r.display_name.split(',').slice(0, 4).join(','));
      // Auto-città
      const cn = r.address?.city || r.address?.town || r.address?.village || '';
      if (cn) {
        const match = CITTA_ITALIANE.find(c =>
          c.label.toLowerCase().includes(cn.toLowerCase()) ||
          cn.toLowerCase().includes(c.label.toLowerCase())
        );
        if (match) setCity(match.value);
      }
      setSearchPhase('preview');
    } catch {
      setGeocodeError('Errore di rete. Controlla la connessione e riprova.');
    } finally { setGeocoding(false); }
  };

  /* ── Sposta pin di NUDGE gradi ── */
  const nudge = (dLat: number, dLon: number) => {
    setLat(prev => prev != null ? Math.round((prev + dLat) * 1e6) / 1e6 : prev);
    setLon(prev => prev != null ? Math.round((prev + dLon) * 1e6) / 1e6 : prev);
  };

  /* ── Link Street View Google Maps ── */
  const streetViewUrl = lat != null && lon != null
    ? `https://www.google.com/maps/@${lat},${lon},3a,75y,0h,90t/data=!3m6!1e1`
    : '';

  /* ── OSM embed iframe URL ── */
  const osmEmbed = lat != null && lon != null
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.003},${lat - 0.002},${lon + 0.003},${lat + 0.002}&layer=mapnik&marker=${lat},${lon}`
    : '';

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
    if (regUsername.length < 3) { setAuthError('Username min 3 caratteri.'); return; }
    if (regPassword.length < 6) { setAuthError('Password min 6 caratteri.'); return; }
    setAuthLoading(true); setAuthError(null);
    try {
      const result = await signUp(regEmail, regPassword, regUsername);
      setAuthDone(result);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally { setAuthLoading(false); }
  };

  const handleSignIn = async () => {
    if (!loginEmail || !loginPassword) { setAuthError('Inserisci email e password.'); return; }
    setAuthLoading(true); setAuthError(null);
    try {
      await signIn(loginEmail, loginPassword);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally { setAuthLoading(false); }
  };

  /* ── Submit spot ── */
  const handleSubmit = async () => {
    if (!user || !name.trim() || !type || lat == null) return;
    setSubmitting(true); setError(null);
    try {
      const { data: { session } } = await supabaseBrowser().auth.getSession();
      if (!session?.access_token) {
        setError('Sessione scaduta. Chiudi il modal, ricarica la pagina e riprova.');
        return;
      }
      const fd = new FormData();
      fd.append('data', JSON.stringify({
        name: name.trim(), type, lat, lon: lon!,
        city: city || undefined,
        description: description || undefined,
        guardians: notes || undefined,
        access_token: session.access_token,
      }));
      photos.forEach((p, i) => fd.append(`photo_${i}`, p));
      const res  = await fetch('/api/submit-spot', { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Errore durante l\'invio.');
      setStep('successo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto. Riprova.');
    } finally { setSubmitting(false); }
  };

  if (!open) return null;

  const hasCoords = lat != null && lon != null;
  const stepIndex = STEPS.indexOf(step as Step);
  const progressPct = step === 'successo' ? 100 : (stepIndex / (STEPS.length - 1)) * 100;

  return (
    <>
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 69, backdropFilter: 'blur(4px)' }} aria-hidden />

      <div role="dialog" aria-modal aria-label="Aggiungi spot BMX" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--gray-800)', borderTop: '2px solid var(--orange)',
        borderRadius: '16px 16px 0 0', zIndex: 70,
        maxHeight: '92dvh', overflowY: 'auto', overscrollBehavior: 'contain',
        animation: 'slideUp 0.3s ease-out',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
      }}>
        <div className="bottom-sheet-handle" />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 14px', borderBottom: '1px solid var(--gray-700)' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--orange)', margin: 0 }}>🏴 AGGIUNGI SPOT</h2>
            {user && step !== 'successo' && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
                {STEP_LABEL[step]}
                {step === 'posizione' && locMode === 'search' && searchPhase === 'preview' && ' — Verifica posizione'}
              </div>
            )}
          </div>
          <button onClick={handleClose} className="btn-ghost" aria-label="Chiudi" style={{ fontSize: 20 }}>✕</button>
        </div>

        {/* Progress */}
        {user && step !== 'successo' && (
          <div style={{ height: 3, background: 'var(--gray-700)' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--orange)', transition: 'width 0.3s ease-out' }} />
          </div>
        )}

        <div style={{ padding: '20px' }}>

          {/* Loading */}
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: 'var(--font-mono)', color: 'var(--gray-400)' }}>
              Caricamento...
            </div>
          )}

          {/* ══ AUTH GATE ══ */}
          {!isLoading && !user && (
            authDone === 'confirm_email' ? (
              <div style={{ textAlign: 'center', padding: '32px 0 40px' }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>📬</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--orange)', marginBottom: 10 }}>CONTROLLA LA TUA EMAIL</div>
                <p style={{ color: 'var(--bone)', lineHeight: 1.6, marginBottom: 24 }}>
                  Link inviato a <strong style={{ color: 'var(--orange)' }}>{regEmail}</strong>.<br />
                  Dopo la conferma, accedi qui.
                </p>
                <button onClick={() => { setAuthDone(null); setAuthTab('accedi'); }} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  🔑 Vai ad Accedi
                </button>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--gray-400)', fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>
                  Accedi o crea un account — il tuo <strong style={{ color: 'var(--orange)' }}>@username</strong> apparirà sullo spot.
                </p>

                {/* ── Google ── */}
                <div style={{ marginBottom: 16 }}>
                  <GoogleSignInBtn onClick={async () => {
                    setAuthLoading(true); setAuthError(null);
                    try { await signInWithGoogle(); }
                    catch (e) { setAuthError(e instanceof Error ? e.message : 'Errore'); setAuthLoading(false); }
                  }} disabled={authLoading} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--gray-700)' }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>oppure</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--gray-700)' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', marginBottom: 20, borderBottom: '1px solid var(--gray-700)' }}>
                  {(['accedi', 'registrati'] as AuthTab[]).map(t => (
                    <button key={t} onClick={() => { setAuthTab(t); setAuthError(null); }} style={{
                      flex: 1, fontFamily: 'var(--font-mono)', fontSize: 14, padding: '12px 0',
                      border: 'none', background: 'transparent',
                      color: authTab === t ? 'var(--orange)' : 'var(--gray-400)',
                      borderBottom: `2px solid ${authTab === t ? 'var(--orange)' : 'transparent'}`,
                      cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {t === 'accedi' ? '🔑 Accedi' : '🏴 Registrati'}
                    </button>
                  ))}
                </div>

                {authTab === 'accedi' && (
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div>
                      <label style={lbl}>Email</label>
                      <input type="email" style={inp} value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                        placeholder="la-tua@email.com" onKeyDown={e => e.key === 'Enter' && handleSignIn()} />
                    </div>
                    <div>
                      <label style={lbl}>Password</label>
                      <input type="password" style={inp} value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                        placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSignIn()} />
                    </div>
                    {authError && <ErrBox msg={authError} />}
                    <button onClick={handleSignIn} disabled={authLoading} className="btn-primary"
                      style={{ width: '100%', justifyContent: 'center', opacity: authLoading ? 0.6 : 1 }}>
                      {authLoading ? '⏳ Accesso...' : '🔑 ENTRA'}
                    </button>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)', textAlign: 'center' }}>
                      Non hai un account?{' '}
                      <button onClick={() => { setAuthTab('registrati'); setAuthError(null); }}
                        style={{ background: 'none', border: 'none', color: 'var(--orange)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                        Registrati →
                      </button>
                    </p>
                  </div>
                )}

                {authTab === 'registrati' && (
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div>
                      <label style={lbl}>Username *</label>
                      <div style={{ position: 'relative' }}>
                        <input type="text"
                          style={{ ...inp, paddingLeft: 28, borderColor: usernameOk === false ? '#ff4444' : usernameOk === true ? '#00c851' : 'var(--gray-600)' }}
                          value={regUsername} onChange={e => onUsernameChange(e.target.value)}
                          placeholder="es. chrispy_bmx" maxLength={30} />
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontFamily: 'var(--font-mono)', fontSize: 14 }}>@</span>
                        {checkingUn && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontSize: 12 }}>...</span>}
                        {!checkingUn && usernameOk === true  && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#00c851' }}>✓</span>}
                        {!checkingUn && usernameOk === false && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#ff4444' }}>✗</span>}
                      </div>
                      {usernameOk === false && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff4444', marginTop: 2 }}>Username già in uso</div>}
                    </div>
                    <div>
                      <label style={lbl}>Email *</label>
                      <input type="email" style={inp} value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="la-tua@email.com" />
                    </div>
                    <div>
                      <label style={lbl}>Password * (min 6 caratteri)</label>
                      <input type="password" style={inp} value={regPassword} onChange={e => setRegPassword(e.target.value)}
                        placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSignUp()} />
                    </div>
                    {authError && <ErrBox msg={authError} />}
                    <button onClick={handleSignUp} disabled={authLoading || usernameOk === false} className="btn-primary"
                      style={{ width: '100%', justifyContent: 'center', opacity: (authLoading || usernameOk === false) ? 0.6 : 1 }}>
                      {authLoading ? '⏳ Registrazione...' : '🏴 CREA ACCOUNT'}
                    </button>
                  </div>
                )}
              </div>
            )
          )}

          {/* ══ STEP 1 — POSIZIONE ══ */}
          {!isLoading && user && step === 'posizione' && (
            <div style={{ display: 'grid', gap: 20 }}>

              {/* Badge utente */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.2)', borderRadius: 6 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 14, color: '#000', flexShrink: 0 }}>
                  {user.username[0].toUpperCase()}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)' }}>@{user.username}</span>
              </div>

              {/* Scelta metodo */}
              {!locMode && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Come vuoi indicare la posizione?
                  </p>
                  <button onClick={() => { setLocMode('gps'); getGPS(); }} style={methodBtn}>
                    <span style={{ fontSize: 28 }}>📍</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--bone)', marginBottom: 2 }}>Sono nello spot</div>
                      <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>Usa il GPS del telefono</div>
                    </div>
                  </button>
                  <button onClick={() => setLocMode('search')} style={methodBtn}>
                    <span style={{ fontSize: 28 }}>🔍</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--bone)', marginBottom: 2 }}>Conosco la posizione</div>
                      <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>Inserisci via, CAP e città</div>
                    </div>
                  </button>
                </div>
              )}

              {/* ─── GPS path ─── */}
              {locMode === 'gps' && (
                <div style={{ display: 'grid', gap: 12 }}>
                  {gpsState === 'loading' && (
                    <div style={{ textAlign: 'center', padding: '20px 0', fontFamily: 'var(--font-mono)', color: 'var(--orange)', fontSize: 14 }}>
                      ⏳ Rilevamento GPS in corso...
                    </div>
                  )}
                  {gpsState === 'ok' && hasCoords && (
                    <div style={{ background: 'var(--gray-700)', border: '1px solid rgba(0,200,81,0.4)', borderRadius: 6, padding: '12px 14px' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#00c851', marginBottom: 4 }}>✅ Posizione rilevata</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)' }}>{lat!.toFixed(6)}, {lon!.toFixed(6)}</div>
                    </div>
                  )}
                  {gpsState === 'error' && <ErrBox msg="GPS non disponibile. Usa la ricerca per indirizzo." />}
                  {gpsState !== 'loading' && !hasCoords && gpsState !== 'error' && (
                    <button onClick={getGPS} className="btn-primary" style={{ justifyContent: 'center' }}>
                      📍 Usa la mia posizione GPS
                    </button>
                  )}
                  {gpsState === 'error' && (
                    <button onClick={() => { setLocMode('search'); setGpsState('idle'); }} className="btn-secondary" style={{ justifyContent: 'center' }}>
                      🔍 Cerca indirizzo
                    </button>
                  )}
                  <button onClick={() => { setLocMode(null); setLat(null); setLon(null); setGpsState('idle'); }}
                    style={backLink}>← Cambia metodo</button>
                </div>
              )}

              {/* ─── SEARCH path: FORM ─── */}
              {locMode === 'search' && searchPhase === 'form' && (
                <div style={{ display: 'grid', gap: 14 }}>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {/* Via */}
                    <div>
                      <label style={lbl}>Via / Piazza *</label>
                      <input
                        type="text" style={inp}
                        value={addrVia}
                        onChange={e => setAddrVia(e.target.value)}
                        placeholder='es. "Via Roma 12" oppure "Piazza del Popolo"'
                        onKeyDown={e => e.key === 'Enter' && handleGeocode()}
                      />
                    </div>
                    {/* Riga CAP + Città */}
                    <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 8 }}>
                      <div>
                        <label style={lbl}>CAP</label>
                        <input
                          type="text" style={inp} inputMode="numeric"
                          value={addrCap}
                          onChange={e => setAddrCap(e.target.value.replace(/\D/g, '').slice(0, 5))}
                          placeholder="20121"
                          onKeyDown={e => e.key === 'Enter' && handleGeocode()}
                        />
                      </div>
                      <div>
                        <label style={lbl}>Città *</label>
                        <input
                          type="text" style={inp}
                          value={addrCitta}
                          onChange={e => setAddrCitta(e.target.value)}
                          placeholder='es. "Milano"'
                          onKeyDown={e => e.key === 'Enter' && handleGeocode()}
                        />
                      </div>
                    </div>
                  </div>

                  {geocodeError && <ErrBox msg={geocodeError} />}

                  <button
                    onClick={handleGeocode}
                    disabled={geocoding || (!addrVia.trim() && !addrCitta.trim())}
                    className="btn-primary"
                    style={{ justifyContent: 'center', opacity: geocoding ? 0.6 : 1 }}
                  >
                    {geocoding ? '⏳ Ricerca in corso...' : '🔍 Trova posizione →'}
                  </button>

                  <button onClick={() => { setLocMode(null); setGeocodeError(null); }} style={backLink}>
                    ← Cambia metodo
                  </button>
                </div>
              )}

              {/* ─── SEARCH path: PREVIEW (mappa + verifica) ─── */}
              {locMode === 'search' && searchPhase === 'preview' && hasCoords && (
                <div style={{ display: 'grid', gap: 16 }}>

                  {/* Indirizzo trovato */}
                  <div style={{ padding: '10px 12px', background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.2)', borderRadius: 6 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Indirizzo trovato</div>
                    <div style={{ fontSize: 13, color: 'var(--bone)', lineHeight: 1.4 }}>{pickedAddress}</div>
                  </div>

                  {/* Mappa OSM */}
                  <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--gray-600)', height: 200, position: 'relative' }}>
                    <iframe
                      key={`${lat}-${lon}`}
                      src={osmEmbed}
                      style={{ width: '100%', height: '100%', border: 'none' }}
                      loading="lazy"
                      title="Anteprima posizione"
                    />
                  </div>

                  {/* Frecce di spostamento */}
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, textAlign: 'center' }}>
                      Sposta il pin (~55 m per click)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, maxWidth: 180, margin: '0 auto' }}>
                      <div />
                      <NudgeBtn label="↑ N" onClick={() => nudge(+NUDGE, 0)} />
                      <div />
                      <NudgeBtn label="← O" onClick={() => nudge(0, -NUDGE)} />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--orange)' }} />
                      </div>
                      <NudgeBtn label="E →" onClick={() => nudge(0, +NUDGE)} />
                      <div />
                      <NudgeBtn label="↓ S" onClick={() => nudge(-NUDGE, 0)} />
                      <div />
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)', textAlign: 'center', marginTop: 8 }}>
                      {lat!.toFixed(6)}, {lon!.toFixed(6)}
                    </div>
                  </div>

                  {/* Street View */}
                  <a
                    href={streetViewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px',
                      background: 'var(--gray-700)', border: '1px solid var(--gray-600)',
                      borderRadius: 8, textDecoration: 'none',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--orange)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--gray-600)')}
                  >
                    <span style={{ fontSize: 26 }}>🧍</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)' }}>Verifica con Street View</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
                        Si apre Google Maps — naviga e poi torna qui per aggiustare il pin
                      </div>
                    </div>
                    <span style={{ color: 'var(--gray-400)', fontSize: 18 }}>↗</span>
                  </a>

                  {/* Città */}
                  <div>
                    <label style={lbl}>Città (opzionale)</label>
                    <select style={{ ...inp, appearance: 'none' }} value={city} onChange={e => setCity(e.target.value)}>
                      <option value="">Seleziona città...</option>
                      {CITTA_ITALIANE.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>

                  {/* Azioni */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      onClick={() => setStep('foto')}
                      className="btn-primary"
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      ✅ Posizione corretta, avanti →
                    </button>
                    <button
                      onClick={() => {
                        setSearchPhase('form');
                        setLat(null); setLon(null); setPickedAddress('');
                      }}
                      style={backLink}
                    >
                      ← Cerca un altro indirizzo
                    </button>
                  </div>
                </div>
              )}

              {/* Avanti per GPS */}
              {locMode === 'gps' && hasCoords && (
                <button onClick={() => setStep('foto')} className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}>
                  Avanti →
                </button>
              )}
            </div>
          )}

          {/* ══ STEP 2 — FOTO ══ */}
          {!isLoading && user && step === 'foto' && (
            <div style={{ display: 'grid', gap: 20 }}>
              <p style={{ color: 'var(--gray-400)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                Carica fino a 5 foto dello spot. La prima sarà la cover.<br />
                <span style={{ fontSize: 13 }}>Puoi saltare se non hai foto.</span>
              </p>
              <PhotoUpload photos={photos} onChange={setPhotos} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setStep('posizione')} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>← Indietro</button>
                <button onClick={() => setStep('dettagli')} className="btn-primary" style={{ flex: 2, justifyContent: 'center' }}>Avanti →</button>
              </div>
            </div>
          )}

          {/* ══ STEP 3 — DETTAGLI ══ */}
          {!isLoading && user && step === 'dettagli' && (
            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <label style={lbl}>Nome spot *</label>
                <input type="text" style={inp} value={name} onChange={e => setName(e.target.value)}
                  placeholder='es. "Gradoni Piazza Bra"' maxLength={100} />
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
                <label style={lbl}>Descrizione (opzionale)</label>
                <textarea style={{ ...inp, resize: 'vertical' }} rows={2}
                  value={description} onChange={e => setDescription(e.target.value)}
                  placeholder='Es. "Gradoni in marmo, fondo buono. Presente anche un ledge."'
                  maxLength={500} />
              </div>
              <div>
                <label style={lbl}>Note accesso / guardiani (opzionale)</label>
                <input type="text" style={inp} value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder='Es. "Security alle 18" / "Sempre libero"' maxLength={200} />
              </div>

              {error && <ErrBox msg={error} />}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setStep('foto'); setError(null); }} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>← Indietro</button>
                <button
                  onClick={handleSubmit}
                  disabled={!name.trim() || !type || submitting}
                  className="btn-primary"
                  style={{ flex: 2, justifyContent: 'center', opacity: (!name.trim() || !type || submitting) ? 0.5 : 1 }}
                >
                  {submitting ? '⏳ Invio...' : '🏴 INVIA SPOT'}
                </button>
              </div>
            </div>
          )}

          {/* ══ SUCCESSO ══ */}
          {step === 'successo' && (
            <div style={{ textAlign: 'center', padding: '20px 0 30px' }}>
              <div style={{ fontSize: 60, marginBottom: 16 }}>🏴</div>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 24, color: 'var(--orange)', marginBottom: 10 }}>SPOT INVIATO!</h3>
              <p style={{ color: 'var(--bone)', lineHeight: 1.6, marginBottom: 12 }}>
                Grazie <strong style={{ color: 'var(--orange)' }}>@{user?.username}</strong>!
              </p>
              <div style={{ background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.25)', borderRadius: 8, padding: '14px 16px', marginBottom: 24, textAlign: 'left' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--orange)', marginBottom: 6 }}>⏳ IN REVISIONE</div>
                <p style={{ color: 'var(--bone)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                  Lo spot apparirà sulla mappa entro 24-48 ore, dopo la mia revisione manuale.
                </p>
              </div>
              <button onClick={handleClose} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Torna alla mappa
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

/* ─── Componenti condivisi ─── */
const methodBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 14,
  width: '100%', padding: '16px', textAlign: 'left',
  background: 'var(--gray-700)', border: '1px solid var(--gray-600)',
  borderRadius: 8, cursor: 'pointer', transition: 'border-color 0.15s',
};

const backLink: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--gray-400)',
  fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer',
  padding: '4px 0', textAlign: 'left' as const,
};

function NudgeBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--bone)',
        background: 'var(--gray-700)', border: '1px solid var(--gray-600)',
        borderRadius: 4, padding: '8px 4px', cursor: 'pointer',
        textAlign: 'center', transition: 'border-color 0.1s, background 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--orange)'; e.currentTarget.style.background = 'rgba(255,106,0,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--gray-600)'; e.currentTarget.style.background = 'var(--gray-700)'; }}
    >
      {label}
    </button>
  );
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#ff4444', background: 'rgba(255,50,50,0.08)', border: '1px solid rgba(255,50,50,0.2)', borderRadius: 4, padding: '10px 12px' }}>
      ⚠ {msg}
    </div>
  );
}

function GoogleSignInBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        padding: '12px 16px', background: '#fff', border: '1px solid #ddd', borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
        fontFamily: 'var(--font-mono)', fontSize: 14, color: '#333', fontWeight: 500,
        transition: 'box-shadow 0.15s',
      }}
      onMouseOver={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
      onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
    >
      <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
        <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
      Continua con Google
    </button>
  );
}
