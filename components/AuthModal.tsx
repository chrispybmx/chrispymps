'use client';

import { useState } from 'react';
import { signIn, signUp, checkUsername, signInWithGoogle } from '@/lib/auth-client';

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
  const [regUsername, setRegUsername] = useState('');
  const [regEmail,    setRegEmail]    = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [usernameOk,  setUsernameOk]  = useState<boolean | null>(null);
  const [checkingUn,  setCheckingUn]  = useState(false);

  // Accedi
  const [loginEmail,    setLoginEmail]    = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const resetAll = () => {
    setError(null); setDone(null); setLoading(false);
    setRegUsername(''); setRegEmail(''); setRegPassword('');
    setLoginEmail(''); setLoginPassword('');
    setUsernameOk(null);
  };

  const handleClose = () => { resetAll(); onClose(); };

  // Controlla username mentre l'utente scrive
  let unDebounce: ReturnType<typeof setTimeout>;
  const onUsernameChange = (val: string) => {
    const clean = val.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30);
    setRegUsername(clean);
    setUsernameOk(null);
    clearTimeout(unDebounce);
    if (clean.length < 3) return;
    setCheckingUn(true);
    unDebounce = setTimeout(async () => {
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
      const result = await signUp(regEmail, regPassword, regUsername);
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

            {/* ── Google Sign In ── */}
            <div style={{ marginBottom: 16, marginTop: 12 }}>
              <GoogleBtn onClick={async () => {
                setLoading(true); setError(null);
                try { await signInWithGoogle(); }
                catch (e) { setError(e instanceof Error ? e.message : 'Errore'); setLoading(false); }
              }} disabled={loading} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--gray-700)' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>oppure</span>
                <div style={{ flex: 1, height: 1, background: 'var(--gray-700)' }} />
              </div>
            </div>

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
                {error && <Err msg={error} />}
                <button onClick={handleSignIn} disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: loading ? 0.6 : 1 }}>
                  {loading ? '⏳ Accesso...' : '🔑 ENTRA'}
                </button>
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
                {error && <Err msg={error} />}
                <button onClick={handleSignUp} disabled={loading || usernameOk === false} className="btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: (loading || usernameOk === false) ? 0.6 : 1 }}>
                  {loading ? '⏳ Registrazione...' : '🏴 CREA ACCOUNT'}
                </button>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', textAlign: 'center', lineHeight: 1.5 }}>
                  Registrandoti accetti i termini della community BMX.
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

function GoogleBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        padding: '12px 16px', background: '#fff', border: '1px solid #ddd', borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
        fontFamily: 'var(--font-mono)', fontSize: 15, color: '#333', fontWeight: 500,
        transition: 'box-shadow 0.15s',
      }}
      onMouseOver={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
      onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
        <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
      Continua con Google
    </button>
  );
}
