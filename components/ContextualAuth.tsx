"use client";
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
const AuthModal = dynamic(() => import('./AuthModal'), { ssr: false });
export default function ContextualAuth() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    const incomplete = () => setPending(true);
    window.addEventListener('chrispy:sign-in', show);
    window.addEventListener('chrispy:account-incomplete', incomplete);
    const url = new URL(window.location.href);
    if (url.searchParams.get('account_pending') === '1') setPending(true);
    if (url.searchParams.get('auth') === '1') {
      setOpen(true); url.searchParams.delete('auth');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
    return () => { window.removeEventListener('chrispy:sign-in', show); window.removeEventListener('chrispy:account-incomplete', incomplete); };
  }, []);
  return <>{open && <AuthModal open onClose={() => setOpen(false)} />}{pending && <div role="status" style={{ position: 'fixed', bottom: 76, left: 16, right: 16, zIndex: 110, padding: 16, background: 'var(--gray-800)', border: '1px solid var(--orange)' }}><p>Accesso riuscito. Alcune informazioni del profilo o l’email di benvenuto sono ancora da sincronizzare. Riproveremo al prossimo accesso.</p><button className="btn-ghost" onClick={() => setPending(false)}>Ho capito</button></div>}</>;

}
