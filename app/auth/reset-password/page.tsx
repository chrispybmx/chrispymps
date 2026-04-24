'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [ready,     setReady]     = useState(false);

  // Supabase risolve automaticamente il token dall'URL (hash o query param)
  useEffect(() => {
    const sb = supabaseBrowser();
    // Ascolta il cambio di sessione — quando Supabase processa il link di reset
    const { data: { subscription } } = sb.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    // Controlla se c'è già una sessione recovery attiva
    sb.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async () => {
    setError(null);
    if (password.length < 6) { setError('La password deve essere di almeno 6 caratteri.'); return; }
    if (password !== confirm) { setError('Le password non corrispondono.'); return; }
    setLoading(true);
    try {
      const sb = supabaseBrowser();
      const { error: updateErr } = await sb.auth.updateUser({ password });
      if (updateErr) throw new Error(updateErr.message);
      setDone(true);
      setTimeout(() => router.replace('/map'), 2500);
    } catch (e: any) {
      setError(e.message ?? 'Errore. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 8,
    background: 'var(--gray-800)', border: '1px solid var(--gray-600)',
    color: 'var(--bone)', fontFamily: 'var(--font-mono)', fontSize: 14,
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ background: 'var(--black)', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--gray-900)', border: '1px solid var(--gray-700)', borderRadius: 16, padding: 32 }}>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          🏴 CHRISPY MAPS
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--bone)', marginBottom: 6 }}>
          Nuova password
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)', marginBottom: 28 }}>
          Scegli una nuova password per il tuo account.
        </div>

        {done ? (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#00c851', textAlign: 'center', padding: '20px 0' }}>
            ✅ Password aggiornata!<br />
            <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Reindirizzamento alla mappa…</span>
          </div>
        ) : !ready ? (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)', textAlign: 'center', padding: '20px 0' }}>
            ⏳ Verifica link in corso…
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Nuova password
              </label>
              <input
                type="password" style={inp} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="minimo 6 caratteri"
                onKeyDown={e => e.key === 'Enter' && handleReset()}
              />
            </div>
            <div>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Conferma password
              </label>
              <input
                type="password" style={inp} value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="ripeti la password"
                onKeyDown={e => e.key === 'Enter' && handleReset()}
              />
            </div>

            {error && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#ff4444', background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 6, padding: '10px 14px' }}>
                ⚠️ {error}
              </div>
            )}

            <button
              onClick={handleReset} disabled={loading}
              style={{
                width: '100%', padding: '14px', borderRadius: 8,
                background: loading ? 'var(--gray-700)' : 'var(--orange)',
                border: 'none', color: 'var(--black)', fontFamily: 'var(--font-mono)',
                fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
              {loading ? '⏳ Salvataggio...' : '🔑 IMPOSTA NUOVA PASSWORD'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
