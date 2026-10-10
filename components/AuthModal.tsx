'use client';

import { useLanguage } from '@/components/LanguageProvider';

import { useState, useRef, useEffect } from 'react';
import { signIn, signUp, checkUsername, resetPassword, resendConfirmation } from '@/lib/auth-client';
import DateWheels from '@/components/DateWheels';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import { NEWSLETTER_CONSENT_TEXT } from '@/lib/newsletter-consent';
import { TracciaFunnel } from '@/lib/funnel';
import PersonalizzaMappa from '@/components/PersonalizzaMappa';
import { REGIONI_ITALIA } from '@/lib/constants';
import { puoRicevereMarketing, ETA_MINIMA_MARKETING, DISCIPLINE, type DisciplinaKey } from '@/lib/rider-profile';
import { COUNTRY_CODES, MINIMUM_ACCOUNT_AGE, registrationDetails } from '@/lib/registration';

interface AuthModalProps {
  returnTo?: string;
  open:          boolean;
  onClose:       () => void;
  defaultTab?:   'accedi' | 'registrati';
  onSuccess?:    () => void;  // callback opzionale dopo login/signup
}

type Tab = 'accedi' | 'registrati';

export default function AuthModal({ open, onClose, defaultTab = 'accedi', onSuccess, returnTo }: AuthModalProps) {
  const { text } = useLanguage();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, dialogRef, onClose);
  const [tab,     setTab]     = useState<Tab>(defaultTab);
  const [loading, setLoading] = useState(false);
  const signupBusy=useRef(false);
  const [error,   setError]   = useState<string | null>(null);
  const [done,    setDone]    = useState<'ok' | 'confirm_email' | null>(null);

  const [resendBusy, setResendBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendUntil, setResendUntil] = useState(0);
  async function resend(email: string) {
    if (resendBusy || Date.now() < resendUntil) return;
    if (!email.trim()) { setError(text('Inserisci prima la tua email.', 'Enter your email first.')); return; }
    setResendBusy(true); setResendMessage('');
    try { await resendConfirmation(email, returnTo); setResendUntil(Date.now() + 60000); setResendMessage(text('Se l’account attende conferma, riceverai un nuovo link. Controlla anche lo spam. Attendi un minuto prima di riprovare.', 'If your account needs confirmation, you will receive a new link. Check spam too. Wait a minute before trying again.')); }
    catch (e) { setResendMessage(e instanceof Error ? e.message : text('Invio non riuscito. Riprova.', 'Could not send. Try again.')); }
    finally { setResendBusy(false); }
  }

  // Registrazione
  const [regUsername,  setRegUsername]  = useState('');
  const [regEmail,     setRegEmail]    = useState('');
  const [regPassword,  setRegPassword] = useState('');
  const [usernameOk,   setUsernameOk]  = useState<boolean | null>(null);
  const [checkingUn,   setCheckingUn]  = useState(false);
  const [newsletterMessage, setNewsletterMessage] = useState('');
  const [newsletter, setNewsletter] = useState(false);
  const [birthDate,  setBirthDate]  = useState('');
  const [region,     setRegion]     = useState('');
  const [country,setCountry]=useState('');
  const [sports,setSports]=useState<DisciplinaKey[]>([]);
  const countryNames=new Intl.DisplayNames([text('it','en')],{type:'region'});
  const countries=COUNTRY_CODES.map(code=>({code,label:countryNames.of(code)||code})).sort((a,b)=>a.label.localeCompare(b.label,text('it','en')));
  const [rilevando,  setRilevando]  = useState(false);

  /* Traccia del percorso di registrazione: quanto ci mette, dove si ferma.
     Disattivata — interfaccia legacy, vedi lib/funnel.ts. */
  const traccia = useRef<TracciaFunnel | null>(null);

  // Accedi
  const [loginEmail,    setLoginEmail]    = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [resetSent,     setResetSent]     = useState(false);
  const [resetting,     setResetting]     = useState(false);

  // BUG-FIX: useRef per il timer debounce — una variabile locale viene ricreata
  // a ogni render e clearTimeout non annulla mai il timer precedente
  const usernameVersion = useRef(0);
  const unDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetAll = () => {
    setError(null); setDone(null); setNewsletterMessage(''); setLoading(false);
    setRegUsername(''); setRegEmail(''); setRegPassword('');
    setLoginEmail(''); setLoginPassword('');
    setUsernameOk(null); setResetSent(false); setResetting(false);
    setNewsletter(false);
    setBirthDate('');setRegion('');setCountry('');setSports([]);
  };

  const handleClose = () => { resetAll(); onClose(); };

  // Controlla username mentre l'utente scrive
  const onUsernameChange = (val: string) => {
    const clean = val.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30);
    setRegUsername(clean);
    setUsernameOk(null);
    if (unDebounceRef.current) clearTimeout(unDebounceRef.current);
    const version = ++usernameVersion.current;
    if (clean.length < 3) { setCheckingUn(false); return; }
    setCheckingUn(true);
    unDebounceRef.current = setTimeout(async () => {
      try { const free = await checkUsername(clean); if (version === usernameVersion.current) setUsernameOk(free); }
      catch { if (version === usernameVersion.current) setError(text('Verifica username non disponibile. Riprova.', 'Username check unavailable. Try again.')); }
      finally { if (version === usernameVersion.current) setCheckingUn(false); }
    }, 600);
  };

  /* Regione dalla posizione: un tap invece della tastiera. Usa le bbox già
     presenti in REGIONI_ITALIA, quindi niente chiamate esterne. */
  const rilevaRegione = () => {
    if (!navigator.geolocation) return;
    setRilevando(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: la, longitude: lo } = pos.coords;
        const trovata = REGIONI_ITALIA.find(r => {
          const [latMin, lonMin, latMax, lonMax] = r.bbox;
          return la >= latMin && la <= latMax && lo >= lonMin && lo <= lonMax;
        });
        if (trovata) setRegion(trovata.label);
        setRilevando(false);
      },
      () => setRilevando(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  };

  /* Apre una traccia quando si entra in registrazione, la chiude quando si
     esce senza aver finito. */
  useEffect(() => {
    if (!open || tab !== 'registrati') return;
    traccia.current = new TracciaFunnel('signup');
    traccia.current.aperto();
    return () => { traccia.current?.abbandonato(); traccia.current = null; };
  }, [open, tab]);

  const handleSignUp = async () => {
    if(loading||signupBusy.current)return;
    if (!regUsername || !regEmail || !regPassword) { setError(text("Compila tutti i campi.", "Complete all fields.")); traccia.current?.errore('campi vuoti'); return; }
    if (regUsername.length < 3) { setError(text("Username troppo corto (min 3 caratteri).", "Your username must be at least 3 characters.")); traccia.current?.errore('username corto'); return; }
    if (regPassword.length < 6) { setError(text("Password troppo corta (min 6 caratteri).", "Your password must be at least 6 characters.")); traccia.current?.errore('password corta'); return; }
    if (!birthDate) { setError(text("Manca la data di nascita.", "Enter your date of birth.")); traccia.current?.errore('data mancante'); return; }
    const valid=registrationDetails().safeParse({birthDate,countryCode:country,disciplines:sports,region});
    if(!valid.success){setError(valid.error.issues[0].message);return;}
    signupBusy.current=true;setLoading(true); setError(null);
    traccia.current?.inviato();
    try {
      const result = await signUp(regEmail, regPassword, regUsername, { returnTo, newsletter, birthDate, countryCode:country,disciplines:sports,region, onNewsletterResult: setNewsletterMessage });
      traccia.current?.riuscito();
      setDone(result);
      if (result === 'ok' && onSuccess && !newsletter) onSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : text("Errore sconosciuto", "Something went wrong.");
      traccia.current?.errore(msg);
      setError(msg);
    } finally { signupBusy.current=false;setLoading(false); }
  };

  const handleSignIn = async () => {
    if (!loginEmail || !loginPassword) { setError(text("Inserisci email e password.", "Enter your email and password.")); return; }
    setLoading(true); setError(null);
    try {
      await signIn(loginEmail, loginPassword);
      if (onSuccess) onSuccess();
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : text("Errore sconosciuto", "Something went wrong."));
    } finally { setLoading(false); }
  };


  if (!open) return null;

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--gray-700)', border: '1px solid var(--gray-600)',
    borderRadius: 4, color: 'var(--bone)', fontFamily: 'var(--font-mono)',
    fontSize: 16, padding: '10px 12px', outline: 'none',
  };
  const lbl: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)',
    textTransform: 'uppercase', letterSpacing: 0, display: 'block', marginBottom: 5,
  };

  return (
    <>
      {/* Overlay */}
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 99, backdropFilter: 'none' }} />

      {/* Modal */}
      <div ref={dialogRef} className="cm-auth-dialog" role="dialog" aria-modal="true" aria-label={text("Accedi a Chrispy Maps", "Sign in to Chrispy Maps")} style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--gray-800)', borderTop: '2px solid var(--orange)',
        borderRadius: '8px 8px 0 0', zIndex: 100,
        maxHeight: '92dvh', overflowY: 'auto',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
        animation: 'slideUp 0.28s ease-out',
      }}>
        <div className="bottom-sheet-handle" />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 14px', borderBottom: '1px solid var(--gray-700)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--orange)' }}>
            Chrispy Maps
          </div>
          <button onClick={handleClose} aria-label={text("Chiudi accesso", "Close sign-in")} className="btn-ghost" style={{ fontSize: 20 }}>✕</button>
        </div>

        {resendMessage && <p role="status" style={{ padding: '12px 20px' }}>{resendMessage}</p>}
        {/* Done: email confirmation needed */}
        {newsletterMessage && <p role="status" style={{padding:'12px 20px',lineHeight:1.5}}>{newsletterMessage}</p>}
        {done === 'confirm_email' && (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📬</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--orange)', marginBottom: 10 }}>
              {text("CONTROLLA LA TUA EMAIL", "CHECK YOUR EMAIL")}
            </div>
            <p style={{ color: 'var(--bone)', lineHeight: 1.6, marginBottom: 24 }}>
              {text("Ti abbiamo inviato un link di conferma a", "We sent a confirmation link to")}<br />
              <strong style={{ color: 'var(--orange)' }}>{regEmail}</strong>
            </p>
            <p style={{ color: 'var(--gray-400)', fontSize: 14 }}>
              {text("Dopo la conferma potrai accedere e aggiungere spot.", "Once confirmed, you can sign in and add spots.")}
            </p>
            <button type="button" className="btn-ghost" disabled={resendBusy} onClick={() => void resend(regEmail)}>{resendBusy ? text('Invio…', 'Sending…') : text('Invia di nuovo la conferma', 'Resend confirmation')}</button>
            <button onClick={handleClose} className="btn-primary" style={{ marginTop: 24, width: '100%', justifyContent: 'center' }}>
              {text("OK, ho capito", "Got it")}
            </button>
          </div>
        )}

        {/* Done: ok (email confirmation disabled) */}
        {/* Registrato: due domande facoltative, poi via.
            Qui l'account c'è già, quindi chiedere non costa più iscrizioni. */}
        {done === 'ok' && (
          <PersonalizzaMappa username={regUsername} onFinito={handleClose} />
        )}

        {!done && tab === 'accedi' && <button type="button" className="btn-ghost" disabled={resendBusy} onClick={() => void resend(loginEmail)} style={{ margin: '12px 20px' }}>{text('Non hai ricevuto la conferma email?', 'Missing your confirmation email?')}</button>}
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
                  {t === 'accedi' ? text("Accedi", "Sign in") : text("Registrati", "Sign up")}
                </button>
              ))}
            </div>

            {/* ACCEDI */}
            {tab === 'accedi' && (
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label style={lbl}>Email</label>
                  <input type="email" style={inp} value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder={text("la-tua@email.com", "you@email.com")} onKeyDown={e => e.key === 'Enter' && handleSignIn()} />
                </div>
                <div>
                  <label style={lbl}>Password</label>
                  <input type="password" style={inp} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSignIn()} />
                </div>
                <div style={{ textAlign: 'right', marginTop: -8 }}>
                  <button
                    onClick={async () => {
                      if (!loginEmail) { setError(text("Inserisci la tua email prima.", "Enter your email first.")); return; }
                      setResetting(true); setError(null);
                      try {
                        await resetPassword(loginEmail);
                        setResetSent(true);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : text("Errore invio email", "Could not send the email."));
                      }
                      setResetting(false);
                    }}
                    disabled={resetting}
                    style={{ background: 'none', border: 'none', color: 'var(--gray-500)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 14, padding: 0 }}
                  >
                    {resetting ? '⏳...' : text("Ho dimenticato la password", "Forgot your password?")}
                  </button>
                </div>
                {resetSent && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#00c851', background: 'rgba(0,200,81,0.08)', border: '1px solid rgba(0,200,81,0.2)', borderRadius: 4, padding: '8px 12px', textAlign: 'center' }}>
                    {text("📬 Email inviata! Controlla la posta per il link di reset.", "📬 Email sent! Check your inbox for the reset link.")}
                  </div>
                )}
                {error && <Err msg={error} />}
                <button onClick={handleSignIn} disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: loading ? 0.6 : 1 }}>
                  {loading ? text("⏳ Accesso...", "⏳ Signing in...") : text("Accedi", "Sign in")}
                </button>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)', textAlign: 'center' }}>
                  {text("Non hai un account?", "No account yet?")}{' '}
                  <button onClick={() => { setTab('registrati'); setError(null); }} style={{ background: 'none', border: 'none', color: 'var(--orange)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 14 }}>
                    {text("Registrati →", "Sign up →")}
                  </button>
                </p>
              </div>
            )}

            {/* REGISTRATI */}
            {tab === 'registrati' && (
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label htmlFor="signup-username" style={lbl}>Username *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      id="signup-username" autoComplete="username"
                      style={{ ...inp, paddingLeft: 28, borderColor: usernameOk === false ? '#ff4444' : usernameOk === true ? '#00c851' : 'var(--gray-600)' }}
                      value={regUsername}
                      onChange={e => onUsernameChange(e.target.value)}
                      placeholder={text("es. chrispy_bmx", "e.g. chrispy_bmx")}
                      maxLength={30}
                    />
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontFamily: 'var(--font-mono)', fontSize: 14 }}>@</span>
                    {checkingUn && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontSize: 14 }}>...</span>}
                    {!checkingUn && usernameOk === true && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#00c851' }}>✓</span>}
                    {!checkingUn && usernameOk === false && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#ff4444' }}>✗</span>}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)', marginTop: 4 }}>
                    {text("Solo lettere, numeri e _. Min 3 caratteri.", "Letters, numbers and _ only. At least 3 characters.")}
                  </div>
                  {usernameOk === false && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#ff4444', marginTop: 2 }}>{text("Username già in uso", "Username already taken")}</div>}
                </div>
                <div>
                  <label htmlFor="signup-email" style={lbl}>Email *</label>
                  <input id="signup-email" autoComplete="email" type="email" style={inp} value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder={text("la-tua@email.com", "you@email.com")} />
                </div>
                <div>
                  <label htmlFor="signup-password" style={lbl}>{text("Password * (min 6 caratteri)", "Password * (at least 6 characters)")}</label>
                  <input id="signup-password" autoComplete="new-password" type="password" style={inp} value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSignUp()} />
                </div>
                {/* Data di nascita — rondelle, niente tastiera */}
                <div>
                  <label style={lbl}>{text("Data di nascita *", "Date of birth *")}</label>
                  <DateWheels value={birthDate} onChange={setBirthDate} annoMin={1920} />
                  <small style={{color:'var(--gray-400)'}}>{text('Privata. Non viene mostrata nel profilo.','Private. Not shown on your profile.')}</small>
                </div>

                <div>
                  <label htmlFor="signup-country" style={lbl}>{text('Paese di residenza (facoltativo)','Country of residence (optional)')}</label>
                  <select id="signup-country" autoComplete="country" value={country} onChange={e=>{setCountry(e.target.value);setRegion('');}} style={inp}>
                    <option value="">{text('Non specificato','Not specified')}</option>
                    {countries.map(c=><option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                </div>
                <fieldset style={{border:0,padding:0,margin:0}}>
                  <legend style={lbl}>{text('Sport (facoltativo)','Sports (optional)')}</legend>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8}}>
                    {DISCIPLINE.map(sport=><label key={sport.key} style={{display:'flex',alignItems:'center',gap:10,minHeight:44,cursor:'pointer'}}>
                      <input type="checkbox" checked={sports.includes(sport.key)} onChange={e=>setSports(current=>e.target.checked?[...current,sport.key]:current.filter(s=>s!==sport.key))} style={{accentColor:'var(--orange)',width:18,height:18}}/>
                      {text(sport.label,sport.key==='altro'?'Other':sport.label)}
                    </label>)}
                  </div>
                </fieldset>

                {/* Regione — un tap, o la si rileva */}
                {country==='IT'&&<div>
                  <label style={lbl}>{text("Dove giri di solito", "Where you usually ride")}</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      value={region}
                      onChange={e => setRegion(e.target.value)}
                      style={{ ...inp, flex: 1, appearance: 'none', WebkitAppearance: 'none' } as React.CSSProperties}
                      aria-label={text("Regione", "Region")}
                    >
                      <option value="">{text("Scegli la regione", "Choose a region")}</option>
                      {REGIONI_ITALIA.map(r => (
                        <option key={r.label} value={r.label}>{r.emoji} {r.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={rilevaRegione}
                      disabled={rilevando}
                      title={text("Suggerisci dalla posizione attuale", "Suggest from your current location")}
                      style={{
                        flexShrink: 0, padding: '0 14px',
                        background: 'transparent', border: '1px solid var(--gray-600)',
                        borderRadius: 6, color: 'var(--bone)', cursor: rilevando ? 'default' : 'pointer',
                        fontSize: 16,
                      }}
                    >
                      {rilevando ? '…' : '📍'}
                    </button>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-500)', marginTop: 4, lineHeight: 1.5 }}>
                    {text("La regione dove giri di solito, non dove ti trovi adesso. Il 📍 la suggerisce, puoi cambiarla.", "The region where you usually ride, which may differ from your current location. Tap 📍 for a suggestion, then change it if needed.")}
                  </div>
                </div>}

                {/* Newsletter — sotto i 16 non compare: non si promette ciò che non parte */}
                {(!birthDate || puoRicevereMarketing(birthDate)) && (
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--gray-700)', borderRadius: 6 }}>
                    <input type="checkbox" checked={newsletter} onChange={e => setNewsletter(e.target.checked)}
                      style={{ marginTop: 2, accentColor: 'var(--orange)', width: 16, height: 16, flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)', lineHeight: 1.5 }}>
                      {NEWSLETTER_CONSENT_TEXT}
                    </span>
                  </label>
                )}
                {birthDate && !puoRicevereMarketing(birthDate) && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-500)', lineHeight: 1.6 }}>
                    {text(`Sotto i ${ETA_MINIMA_MARKETING} anni non inviamo newsletter. L'account funziona uguale.`, `We do not send newsletters to riders under ${ETA_MINIMA_MARKETING}. Your account still works as usual.`)}
                  </div>
                )}
                {error && <Err msg={error} />}
                <button onClick={handleSignUp} disabled={loading || usernameOk === false} className="btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: (loading || usernameOk === false) ? 0.6 : 1 }}>
                  {loading ? text("⏳ Registrazione...", "⏳ Creating account...") : text("Crea account", "Create account")}
                </button>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-500)', textAlign: 'center', lineHeight: 1.6 }}>
                  {text('Creando l’account accetti le','By creating an account you accept the')}{' '}
                  <a href="/regole" target="_blank" rel="noopener" style={{color:'var(--orange)'}}>{text('regole','rules')}</a>{' '}
                  {text('e dichiari di avere almeno','and declare you are at least')} {MINIMUM_ACCOUNT_AGE} {text('anni. Leggi l’','years old. Read the ')}
                  <a href="/privacy" target="_blank" rel="noopener" style={{color:'var(--orange)'}}>{text('informativa privacy','privacy notice')}</a>.
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)', textAlign: 'center' }}>
                  {text("Hai già un account?", "Already have an account?")}{' '}
                  <button onClick={() => { setTab('accedi'); setError(null); }} style={{ background: 'none', border: 'none', color: 'var(--orange)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 14 }}>
                    {text("Accedi →", "Sign in →")}
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
    <div role="alert" style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#ff4444', background: 'rgba(255,50,50,0.08)', border: '1px solid rgba(255,50,50,0.2)', borderRadius: 4, padding: '8px 12px' }}>
      ⚠ {msg}
    </div>
  );
}

