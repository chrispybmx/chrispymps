'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { checkUsername, setupGoogleUsername } from '@/lib/auth-client';

interface SessionInfo {
  id: string;
  email: string;
  accessToken: string;
}

export default function SetupUsernamePage() {
  const router  = useRouter();
  const [session,     setSession]     = useState<SessionInfo | null | undefined>(undefined);

  const [username,    setUsername]    = useState('');
  const [usernameOk,  setUsernameOk]  = useState<boolean | null>(null);
  const [checkingUn,  setCheckingUn]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    let settled = false;

    const resolve = async (s: import('@supabase/supabase-js').Session | null) => {
      if (settled) return;
      if (!s?.user) return; // aspetta — potrebbe arrivare la sessione tra poco
      settled = true;

      // Ha già un profilo? (utente esistente che arriva qui per errore)
      const { data: profile } = await sb
        .from('profiles').select('username').eq('id', s.user.id).maybeSingle();
      if (profile?.username) {
        router.replace('/map');
      } else {
        setSession({ id: s.user.id, email: s.user.email ?? '', accessToken: s.access_token });
      }
    };

    // 1. Prova subito con la sessione corrente
    sb.auth.getSession().then(({ data }) => resolve(data.session));

    // 2. Ascolta i cambiamenti (SIGNED_IN arriva dopo l'OAuth callback)
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, s) => resolve(s));

    // 3. Timeout: se dopo 6 secondi non c'è sessione → non loggato → /map
    const timeout = setTimeout(() => {
      if (!settled) { settled = true; setSession(null); }
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  // Se non loggato (dopo timeout), manda alla mappa
  useEffect(() => {
    if (session === null) router.replace('/map');
  }, [session, router]);

  let unDebounce: ReturnType<typeof setTimeout>;
  const onUsernameChange = (val: string) => {
    const clean = val.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30);
    setUsername(clean);
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

  const handleSubmit = async () => {
    if (!session) return;
    if (!username || username.length < 3) { setError('Username troppo corto (min 3 caratteri).'); return; }
    if (usernameOk === false) { setError('Username già in uso.'); return; }
    setLoading(true);
    setError(null);
    try {
      await setupGoogleUsername(session.id, username, session.accessToken);
      router.replace('/map');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
      setLoading(false);
    }
  };

  /* ─── stili ─── */
  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: '#2a2a2a', border: '1px solid #444',
    borderRadius: 4, color: '#f0ebe3', fontFamily: 'var(--font-mono)',
    fontSize: 16, padding: '12px 12px 12px 32px', outline: 'none',
  };

  if (session === undefined) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a' }}>
        <div style={{ fontFamily: 'var(--font-mono)', color: '#888', fontSize: 14 }}>Caricamento...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏴</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: '#ff6a00', marginBottom: 8, letterSpacing: '0.04em' }}>
            SCEGLI IL TUO USERNAME
          </div>
          <p style={{ color: '#888', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            Il tuo <strong style={{ color: '#f0ebe3' }}>@username</strong> apparirà sugli spot che aggiungi alla mappa.
          </p>
        </div>

        {/* Form */}
        <div style={{ display: 'grid', gap: 20 }}>
          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                style={{
                  ...inp,
                  borderColor: usernameOk === false ? '#ff4444' : usernameOk === true ? '#00c851' : '#444',
                }}
                value={username}
                onChange={e => onUsernameChange(e.target.value)}
                placeholder="es. chrispy_bmx"
                maxLength={30}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                disabled={loading}
              />
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#888', fontFamily: 'var(--font-mono)', fontSize: 14 }}>@</span>
              {checkingUn && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: 12 }}>...</span>}
              {!checkingUn && usernameOk === true  && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#00c851' }}>✓</span>}
              {!checkingUn && usernameOk === false && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#ff4444' }}>✗</span>}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#666', marginTop: 5 }}>
              Solo lettere, numeri e _. Min 3 caratteri.
            </div>
            {usernameOk === false && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff4444', marginTop: 3 }}>Username già in uso</div>}
          </div>

          {error && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#ff4444', background: 'rgba(255,50,50,0.08)', border: '1px solid rgba(255,50,50,0.2)', borderRadius: 4, padding: '8px 12px' }}>
              ⚠ {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || usernameOk === false || username.length < 3}
            style={{
              width: '100%', padding: '14px', fontFamily: 'var(--font-mono)', fontSize: 16,
              background: (loading || usernameOk === false || username.length < 3) ? '#333' : '#ff6a00',
              color: (loading || usernameOk === false || username.length < 3) ? '#666' : '#000',
              border: 'none', borderRadius: 6, cursor: (loading || usernameOk === false || username.length < 3) ? 'not-allowed' : 'pointer',
              fontWeight: 600, letterSpacing: '0.06em', transition: 'background 0.15s',
            }}
          >
            {loading ? '⏳ Salvataggio...' : '🏴 ENTRA NELLA MAPPA →'}
          </button>
        </div>
      </div>
    </div>
  );
}
