'use client';

import { useState } from 'react';

/**
 * Form iscrizione newsletter ottimizzato per la landing /newsletter.
 * Stessa logica di NewsletterSignup ma layout grande, conversion-first.
 * Endpoint: POST /api/newsletter/subscribe (source: 'newsletter')
 */
export default function NewsletterLandingForm({ id = 'nl-email' }: { id?: string }) {
  const [email, setEmail] = useState('');
  const [alsoNewsletter, setAlsoNewsletter] = useState(true);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setStatus('error');
      setMessage('Email non valida.');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username: email.split('@')[0], alsoNewsletter }),
      });
      const data = await res.json();

      if (data.ok) {
        setStatus('success');
        setMessage('Iscritto! Riceverai gli aggiornamenti da Chrispy Maps.');
        setEmail('');
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
      <form onSubmit={submit} className="flex flex-col gap-3">
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
            disabled={busy || done}
            className={`whitespace-nowrap rounded-lg px-6 py-3 font-mono text-vhs-base font-bold uppercase tracking-wider transition-all ${
              done
                ? 'cursor-default bg-gray-700 text-gray-400'
                : 'bg-orange text-black shadow-vhs hover:shadow-vhs-lg active:scale-95'
            } ${busy ? 'cursor-wait opacity-80' : ''}`}
          >
            {busy ? '...' : done ? '✓ Iscritto' : 'Iscriviti'}
          </button>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-vhs-sm text-gray-300">
          <input
            type="checkbox"
            checked={alsoNewsletter}
            onChange={(e) => setAlsoNewsletter(e.target.checked)}
            disabled={busy || done}
            className="w-4 h-4 rounded border-gray-500 bg-gray-800 cursor-pointer accent-orange disabled:opacity-60"
          />
          <span>Desideri anche ricevere la newsletter settimanale?</span>
        </label>
      </form>

      <p
        aria-live="polite"
        className={`mt-3 min-h-[1.25rem] font-mono text-vhs-sm ${
          done ? 'text-coffee' : status === 'error' ? 'text-orange' : 'text-gray-400'
        }`}
      >
        {message || 'Tre minuti di lettura. Zero spam. Disiscrizione con un click.'}
      </p>
    </div>
  );
}
