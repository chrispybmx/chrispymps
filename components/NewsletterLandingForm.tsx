'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Newsletter landing form — GDPR compliant subscription.
 * Source: 'newsletter' (all users → Newsletter BMX Settimanale group)
 * Requires explicit GDPR consent checkbox before submit.
 */
export default function NewsletterLandingForm({ id = 'nl-email' }: { id?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [consentGDPR, setConsentGDPR] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setStatus('error');
      setMessage('Email non valida.');
      return;
    }
    if (!consentGDPR) {
      setStatus('error');
      setMessage('Devi accettare per iscriverti.');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username: email.split('@')[0], source: 'newsletter' }),
      });
      const data = await res.json();

      if (data.ok) {
        setTimeout(() => router.push('/newsletter-grazie/'), 500);
      } else {
        setStatus('error');
        setMessage(data.error || 'Qualcosa non ha funzionato. Riprova.');
      }
    } catch {
      setStatus('error');
      setMessage('Errore di rete. Riprova.');
    }
  };

  const done = status === 'success';
  const busy = status === 'loading';

  return (
    <div className="w-full max-w-md">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor={id} className="sr-only">La tua email</label>
          <input
            id={id}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="la tua email"
            required
            disabled={busy || done}
            className="min-w-0 flex-1 rounded-lg border border-gray-600 bg-gray-800 px-4 py-3 text-vhs-base text-bone outline-none transition-colors placeholder:text-gray-400 focus:border-orange disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={busy || done || !consentGDPR}
            className={`whitespace-nowrap rounded-lg px-6 py-3 font-mono text-vhs-base font-bold uppercase tracking-wider transition-all ${
              done
                ? 'cursor-default bg-gray-700 text-gray-400'
                : 'bg-orange text-black shadow-vhs hover:shadow-vhs-lg active:scale-95'
            } ${busy ? 'cursor-wait opacity-80' : ''} ${!consentGDPR ? 'opacity-60' : ''}`}
          >
            {busy ? '...' : done ? '✓ Iscritto' : 'Iscriviti'}
          </button>
        </div>

        <div className="text-vhs-xs text-gray-400 space-y-2">
          <p>
            Iscrivendoti accetti di ricevere la newsletter di ChrispyBMX. Useremo la tua email solo per inviarti aggiornamenti BMX. Puoi disiscriverti in qualsiasi momento tramite il link presente in ogni email. Leggi la{' '}
            <a href="https://chrispybmx.com/privacy/" target="_blank" rel="noopener" className="text-orange hover:underline">
              Privacy Policy
            </a>
            .
          </p>
        </div>

        <label className="flex items-start gap-2 cursor-pointer text-vhs-sm text-gray-300">
          <input
            type="checkbox"
            checked={consentGDPR}
            onChange={(e) => setConsentGDPR(e.target.checked)}
            disabled={busy || done}
            className="w-4 h-4 mt-0.5 rounded border-gray-500 bg-gray-800 cursor-pointer accent-orange disabled:opacity-60 flex-shrink-0"
          />
          <span>Acconsento a ricevere la newsletter di ChrispyBMX secondo la Privacy Policy.</span>
        </label>
      </form>

      {message && (
        <p
          aria-live="polite"
          className={`mt-3 font-mono text-vhs-sm ${status === 'error' ? 'text-orange' : 'text-gray-400'}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
