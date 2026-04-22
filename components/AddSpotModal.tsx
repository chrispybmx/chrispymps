'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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

type Step    = 'posizione' | 'foto' | 'dettagli' | 'successo';
type AuthTab = 'accedi' | 'registrati';

const STEPS: Step[] = ['posizione', 'foto', 'dettagli'];
const STEP_LABEL: Record<Step, string> = {
  posizione: '1 — Posizione',
  foto:      '2 — Foto',
  dettagli:  '3 — Dettagli',
  successo:  '',
};

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

  /* ── Posizione ── */
  const [lat,        setLat]        = useState<number | null>(initialLat ?? null);
  const [lon,        setLon]        = useState<number | null>(initialLon ?? null);
  const [city,       setCity]       = useState('');
  const [gpsState,   setGpsState]   = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [locMode,    setLocMode]    = useState<'gps' | 'search' | null>(initialLat != null ? 'gps' : null);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching,     setSearching]     = useState(false);
  const [pickedAddress, setPickedAddress] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /* ── Sync initialLat/Lon (es. tap sulla mappa) ── */
  useEffect(() => {
    if (initialLat != null && initialLon != null) {
      setLat(initialLat); setLon(initialLon);
      setLocMode('gps'); setGpsState('ok');
    }
  }, [initialLat, initialLon]);

  /* ── Reset completo alla chiusura ── */
  const handleClose = useCallback(() => {
    setStep('posizione');
    setLat(initialLat ?? null); setLon(initialLon ?? null); setCity('');
    setGpsState('idle'); setLocMode(initialLat != null ? 'gps' : null);
    setSearchQuery(''); setSearchResults([]); setPickedAddress('');
    setPhotos([]);
    setName(''); setType(''); setDescription(''); setNotes('');
    setError(null); setSubmitting(false);
    setAuthError(null); setAuthDone(null);
    setRegUsername(''); setRegEmail(''); setRegPassword('');
    setLoginEmail(''); setLoginPassword('');
    onClose();
  }, [initialLat, initialLon, onClose]);

  /* ── Nominatim search ── */
  useEffect(() => {
    if (locMode !== 'search') return;
    if (searchQuery.trim().length < 3) { setSearchResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5&addressdetails=1&accept-language=it`;
        const res  = await fetch(url, { headers: { 'Accept-Language': 'it' } });
        const data = await res.json();
        setSearchResults(data);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
  }, [searchQuery, locMode]);

  const getGPS = () => {
    if (!navigator.geolocation) { setGpsState('error'); return; }
    setGpsState('loading');
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude); setLon(pos.coords.longitude); setGpsState('ok'); },
      ()  => setGpsState('error'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const pickSearchResult = (r: any) => {
    setLat(parseFloat(r.lat)); setLon(parseFloat(r.lon));
    const label = r.display_name.split(',').slice(0, 3).join(',');
    setPickedAddress(label);
    const cityName = r.address?.city || r.address?.town || r.address?.village || '';
    if (cityName) {
      const match = CITTA_ITALIANE.find(c =>
        c.label.toLowerCase().includes(cityName.toLowerCase()) ||
        cityName.toLowerCase().includes(c.label.toLowerCase())
      );
      if (match) setCity(match.value);
    }
    setSearchResults([]); setSearchQuery('');
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

  /* ── Submit ── */
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

  const hasCoords  = lat != null && lon != null;
  const stepIndex  = STEPS.indexOf(step as Step);
  const progressPct = step === 'successo' ? 100 : ((stepIndex) / (STEPS.length - 1)) * 100;

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
              </div>
            )}
          </div>
          <button onClick={handleClose} className="btn-ghost" aria-label="Chiudi" style={{ fontSize: 20 }}>✕</button>
        </div>

        {/* Progress bar */}
        {user && step !== 'successo' && (
          <div style={{ height: 3, background: 'var(--gray-700)' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--orange)', transition: 'width 0.3s ease-out' }} />
          </div>
        )}

        <div style={{ padding: '20px' }}>

          {/* ── Loading ── */}
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: 'var(--font-mono)', color: 'var(--gray-400)' }}>
              Caricamento...
            </div>
          )}

          {/* ══════════════════════════
              AUTH GATE
          ══════════════════════════ */}
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

          {/* ══════════════════════════
              STEP 1 — POSIZIONE
          ══════════════════════════ */}
          {!isLoading && user && step === 'posizione' && (
            <div style={{ display: 'grid', gap: 20 }}>

              {/* Badge utente */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.2)', borderRadius: 6 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 14, color: '#000', flexShrink: 0 }}>
                  {user.username[0].toUpperCase()}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)' }}>@{user.username}</span>
              </div>

              {/* Selezione metodo */}
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
                      <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>Cerca indirizzo o nome del posto</div>
                    </div>
                  </button>
                </div>
              )}

              {/* GPS path */}
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
                  {gpsState === 'error' && (
                    <ErrBox msg="GPS non disponibile. Prova a cercare l'indirizzo." />
                  )}
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
                    style={{ background: 'none', border: 'none', color: 'var(--gray-400)', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', padding: '4px 0', textAlign: 'left' }}>
                    ← Cambia metodo
                  </button>
                </div>
              )}

              {/* Search path */}
              {locMode === 'search' && (
                <div style={{ display: 'grid', gap: 12 }}>
                  {!hasCoords && (
                    <div style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--gray-700)', border: '1px solid var(--gray-600)', borderRadius: 6, padding: '10px 14px' }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{searching ? '⏳' : '🔍'}</span>
                        <input autoFocus type="text"
                          placeholder="es. Skatepark Dergano Milano, Via Roma 1..."
                          value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                          style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 15, color: 'var(--bone)', outline: 'none', fontFamily: 'var(--font-mono)' }} />
                        {searchQuery && (
                          <button onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                            style={{ background: 'none', border: 'none', color: 'var(--gray-400)', fontSize: 18, cursor: 'pointer', padding: 0 }}>✕</button>
                        )}
                      </div>
                      {searchResults.length > 0 && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--gray-700)', border: '1px solid var(--orange)', borderRadius: 6, overflow: 'hidden', zIndex: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                          {searchResults.map((r: any) => (
                            <button key={r.place_id} onClick={() => pickSearchResult(r)}
                              style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', padding: '11px 14px', background: 'none', border: 'none', borderTop: '1px solid var(--gray-600)', color: 'var(--bone)', textAlign: 'left', cursor: 'pointer' }}>
                              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 2 }}>📍</span>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.4 }}>
                                {r.display_name.split(',').slice(0, 3).join(',')}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchQuery.trim().length >= 3 && !searching && searchResults.length === 0 && (
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)', marginTop: 8 }}>
                          Nessun risultato. Prova con un indirizzo diverso.
                        </p>
                      )}
                    </div>
                  )}
                  {hasCoords && (
                    <div style={{ background: 'var(--gray-700)', border: '1px solid rgba(0,200,81,0.4)', borderRadius: 6, padding: '12px 14px' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#00c851', marginBottom: 4 }}>✅ Posizione trovata</div>
                      <div style={{ fontSize: 13, color: 'var(--bone)', lineHeight: 1.4, marginBottom: 4 }}>{pickedAddress}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)' }}>{lat!.toFixed(6)}, {lon!.toFixed(6)}</div>
                    </div>
                  )}
                  {hasCoords && (
                    <button onClick={() => { setLat(null); setLon(null); setPickedAddress(''); setSearchQuery(''); setSearchResults([]); }}
                      style={{ background: 'none', border: 'none', color: 'var(--gray-400)', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', padding: '4px 0', textAlign: 'left' }}>
                      ← Cerca di nuovo
                    </button>
                  )}
                  {!hasCoords && (
                    <button onClick={() => { setLocMode(null); setSearchQuery(''); setSearchResults([]); }}
                      style={{ background: 'none', border: 'none', color: 'var(--gray-400)', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', padding: '4px 0', textAlign: 'left' }}>
                      ← Cambia metodo
                    </button>
                  )}
                </div>
              )}

              {/* Città (opzionale, mostrata se c'è una posizione) */}
              {locMode && hasCoords && (
                <div>
                  <label style={lbl}>Città (opzionale)</label>
                  <select style={{ ...inp, appearance: 'none' }} value={city} onChange={e => setCity(e.target.value)}>
                    <option value="">Seleziona città...</option>
                    {CITTA_ITALIANE.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              )}

              {/* Avanti */}
              {locMode && (
                <button onClick={() => setStep('foto')} disabled={!hasCoords} className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center', opacity: hasCoords ? 1 : 0.45, marginTop: 4 }}>
                  Avanti →
                </button>
              )}
            </div>
          )}

          {/* ══════════════════════════
              STEP 2 — FOTO
          ══════════════════════════ */}
          {!isLoading && user && step === 'foto' && (
            <div style={{ display: 'grid', gap: 20 }}>
              <p style={{ color: 'var(--gray-400)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                Carica fino a 5 foto dello spot. La prima sarà la cover.<br />
                <span style={{ fontSize: 13 }}>Puoi saltare questo step se non hai foto.</span>
              </p>
              <PhotoUpload photos={photos} onChange={setPhotos} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setStep('posizione')} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>← Indietro</button>
                <button onClick={() => setStep('dettagli')} className="btn-primary" style={{ flex: 2, justifyContent: 'center' }}>Avanti →</button>
              </div>
            </div>
          )}

          {/* ══════════════════════════
              STEP 3 — DETTAGLI
          ══════════════════════════ */}
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

          {/* ══════════════════════════
              SUCCESSO
          ══════════════════════════ */}
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

/* ─── sub-components ─── */
const methodBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 14,
  width: '100%', padding: '16px', textAlign: 'left',
  background: 'var(--gray-700)', border: '1px solid var(--gray-600)',
  borderRadius: 8, cursor: 'pointer', transition: 'border-color 0.15s',
};

function ErrBox({ msg }: { msg: string }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#ff4444', background: 'rgba(255,50,50,0.08)', border: '1px solid rgba(255,50,50,0.2)', borderRadius: 4, padding: '10px 12px' }}>
      ⚠ {msg}
    </div>
  );
}
