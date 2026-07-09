'use client';

import { useState, useRef } from 'react';
import { signIn, signUp, signInWithGoogle, checkUsername, resetPassword } from '@/lib/auth-client';

interface AuthModalProps {
  open:          boolean;
  onClose:       () => void;
  defaultTab?:   'accedi' | 'registrati';
  onSuccess?:    () => void;  // callback opzionale dopo login/signup
}

type Tab = 'accedi' | 'registrati';

export default function AuthModal({ open, onClose, defaultTab = 'accedi', onSuccess }: AuthModalProps) {
  const [tab,     setTab]     = useState<Tab>(defaultTab);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [done,    setDone]    = useState<'ok' | 'confirm_email' | null>(null);

  // Registrazione
  const [regUsername,  setRegUsername]  = useState('');
  const [regEmail,     setRegEmail]    = useState('');
  const [regPassword,  setRegPassword] = useState('');
  const [usernameOk,   setUsernameOk]  = useState<boolean | null>(null);
  const [checkingUn,   setCheckingUn]  = useState(false);
  const [newsletter, setNewsletter] = useState(false);

  // Accedi
  const [loginEmail,    setLoginEmail]    = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [resetSent,     setResetSent]     = useState(false);
  const [resetting,     setResetting]     = useState(false);

  // BUG-FIX: useRef per il timer debounce — una variabile locale viene ricreata
  // a ogni render e clearTimeout non annulla mai il timer precedente
  const unDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetAll = () => {
    setError(null); setDone(null); setLoading(false);
    setRegUsername(''); setRegEmail(''); setRegPassword('');
    setLoginEmail(''); setLoginPassword('');
    setUsernameOk(null); setResetSent(false); setResetting(false);
    setNewsletter(false);
  };

  const handleClose = () => { resetAll(); onClose(); };

  // Controlla username mentre l'utente scrive
  const onUsernameChange = (val: string) => {
    const clean = val.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30);
    setRegUsername(clean);
    setUsernameOk(null);
    if (unDebounceRef.current) clearTimeout(unDebounceRef.current);
    if (clean.length < 3) return;
    setCheckingUn(true);
    unDebounceRef.current = setTimeout(async () => {
      const free = await checkUsername(clean);
      setUsernameOk(free);
      setCheckingUn(false);
    }, 600);
  };

  const handleSignUp = async () => {
    if (!regUsername || !regEmail || !regPassword) { setError('Compila tutti i campi.'); return; }
    if (regUsername.length < 3) { setError('Username troppo corto (min 3 caratteri).'); return; }
    if (regPassword.length < 6) { setError('Password troppo corta (min 6 caratteri).'); return; }
    setLoading(true); setError(null);
    try {
      const result = await signUp(regEmail, regPassword, regUsername, { newsletter });
      setDone(result);
      if (result === 'ok' && onSuccess) onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally { setLoading(false); }
  };

  const handleSignIn = async () => {
    if (!loginEmail || !loginPassword) { setError('Inserisci email e password.'); return; }
    setLoading(true); setError(null);
    try {
      await signIn(loginEmail, loginPassword);
      handleClose();
      if (onSuccess) onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally { setLoading(false); }
  };

  // Redirect flow: parte verso Google, al ritorno /auth/callback gestisce sessione e profilo
  const handleGoogle = async () => {
    setLoading(true); setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore accesso Google');
      setLoading(false);
    }
  };

  if (!open) return null;

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

  return (
    <>
      {/* Overlay */}
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 99, backdropFilter: 'blur(4px)' }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--gray-800)', borderTop: '2px solid var(--orange)',
        borderRadius: '16px 16px 0 0', zIndex: 100,
        maxHeight: '92dvh', overflowY: 'auto',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
        animation: 'slideUp 0.28s ease-out',
      }}>
        <div className="bottom-sheet-handle" />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 14px', borderBottom: '1px solid var(--gray-700)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--orange)' }}>
            🏴 CHRISPY MAPS
          </div>
          <button onClick={handleClose} className="btn-ghost" style={{ fontSize: 20 }}>✕</button>
        </div>

        {/* Done: email confirmation needed */}
        {done === 'confirm_email' && (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📬</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--orange)', marginBottom: 10 }}>
              CONTROLLA LA TUA EMAIL
            </div>
            <p style={{ color: 'var(--bone)', lineHeight: 1.6, marginBottom: 24 }}>
              Ti abbiamo inviato un link di conferma a<br />
              <strong style={{ color: 'var(--orange)' }}>{regEmail}</strong>
            </p>
            <p style={{ color: 'var(--gray-400)', fontSize: 13 }}>
              Dopo la conferma potrai accedere e aggiungere spot.
            </p>
            <button onClick={handleClose} className="btn-primary" style={{ marginTop: 24, width: '100%', justifyContent: 'center' }}>
              OK, ho capito
            </button>
          </div>
        )}

        {/* Done: ok (email confirmation disabled) */}
        {done === 'ok' && (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🏴</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--orange)', marginBottom: 10 }}>
              BENVENUTO @{regUsername}!
            </div>
            <p style={{ color: 'var(--bone)', lineHeight: 1.6 }}>Sei dentro. Ora puoi aggiungere i tuoi spot BMX.</p>
            <button onClick={handleClose} className="btn-primary" style={{ marginTop: 24, width: '100%', justifyContent: 'center' }}>
              Vai alla mappa
            </button>
          </div>
        )}

        {!done && (
          <div style={{ padding: '0 20px 20px' }}>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--gray-700)' }}>
              {(['accedi', 'registrati'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError(null); }}
                  style={{
                    flex: 1, fontFamily: 'var(--font-mono)', fontSize: 15,
                    padding: '14px 0', border: 'none', background: 'transparent',
                    color: tab === t ? 'var(--orange)' : 'var(--gray-400)',
                    borderBottom: `2px solid ${tab === t ? 'var(--orange)' : 'transparent'}`,
                    cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
                    transition: 'color 0.15s',
                  }}
                >
                  {t === 'accedi' ? '🔑 Accedi' : '🏴 Registrati'}
                </button>
              ))}
            </div>

            {/* ACCEDI */}
            {tab === 'accedi' && (
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label style={lbl}>Email</label>
                  <input type="email" style={inp} value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="la-tua@email.com" onKeyDown={e => e.key === 'Enter' && handleSignIn()} />
                </div>
                <div>
                  <label style={lbl}>Password</label>
                  <input type="password" style={inp} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSignIn()} />
                </div>
                <div style={{ textAlign: 'right', marginTop: -8 }}>
                  <button
                    onClick={async () => {
                      if (!loginEmail) { setError('Inserisci la tua email prima.'); return; }
                      setResetting(true); setError(null);
                      try {
                        await resetPassword(loginEmail);
                        setResetSent(true);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Errore invio email');
                      }
                      setResetting(false);
                    }}
                    disabled={resetting}
                    style={{ background: 'none', border: 'none', color: 'var(--gray-500)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, padding: 0 }}
                  >
                    {resetting ? '⏳...' : 'Ho dimenticato la password'}
                  </button>
                </div>
                {resetSent && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#00c851', background: 'rgba(0,200,81,0.08)', border: '1px solid rgba(0,200,81,0.2)', borderRadius: 4, padding: '8px 12px', textAlign: 'center' }}>
                    📬 Email inviata! Controlla la posta per il link di reset.
                  </div>
                )}
                {error && <Err msg={error} />}
                <button onClick={handleSignIn} disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: loading ? 0.6 : 1 }}>
                  {loading ? '⏳ Accesso...' : '🔑 ENTRA'}
                </button>
                <GoogleButton onClick={handleGoogle} disabled={loading} />
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)', textAlign: 'center' }}>
                  Non hai un account?{' '}
                  <button onClick={() => { setTab('registrati'); setError(null); }} style={{ background: 'none', border: 'none', color: 'var(--orange)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                    Registrati →
                  </button>
                </p>
              </div>
            )}

            {/* REGISTRATI */}
            {tab === 'registrati' && (
              <div style={{ display: 'grid', gap: 16 }}>
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
                    {!checkingUn && usernameOk === true && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#00c851' }}>✓</span>}
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
                {/* Newsletter opt-in */}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--gray-700)', borderRadius: 6 }}>
                  <input type="checkbox" checked={newsletter} onChange={e => setNewsletter(e.target.checked)}
                    style={{ marginTop: 2, accentColor: 'var(--orange)', width: 16, height: 16, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)', lineHeight: 1.5 }}>
                    Voglio ricevere la newsletter BMX di Chrispy Maps
                  </span>
                </label>
                {error && <Err msg={error} />}
                <button onClick={handleSignUp} disabled={loading || usernameOk === false} className="btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: (loading || usernameOk === false) ? 0.6 : 1 }}>
                  {loading ? '⏳ Registrazione...' : '🏴 CREA ACCOUNT'}
                </button>
                <GoogleButton onClick={handleGoogle} disabled={loading} />
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-500)', textAlign: 'center', lineHeight: 1.6 }}>
                  Cliccando su "Crea Account" accetti la nostra{' '}
                  <a href="https://www.iubenda.com/privacy-policy/84160410" target="_blank" rel="noopener" style={{ color: 'var(--orange)', textDecoration: 'underline' }}>Privacy Policy</a>
                  {' '}e dichiari di avere almeno 14 anni.
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)', textAlign: 'center' }}>
                  Hai già un account?{' '}
                  <button onClick={() => { setTab('accedi'); setError(null); }} style={{ background: 'none', border: 'none', color: 'var(--orange)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                    Accedi →
                  </button>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function Err({ msg }: { msg: string }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#ff4444', background: 'rgba(255,50,50,0.08)', border: '1px solid rgba(255,50,50,0.2)', borderRadius: 4, padding: '8px 12px' }}>
      ⚠ {msg}
    </div>
  );
}

/** Divider "oppure" + bottone Google (redirect OAuth via Supabase) */
function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--gray-700)' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>oppure</span>
        <div style={{ flex: 1, height: 1, background: 'var(--gray-700)' }} />
      </div>
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          background: '#fff', color: '#1a1a1a', border: 'none', borderRadius: 6,
          padding: '12px 16px', cursor: disabled ? 'default' : 'pointer',
          fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.97 10.97 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.16-3.16C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        Continua con Google
      </button>
    </>
  );
}

