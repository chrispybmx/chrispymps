'use client';

import { useState } from 'react';

/**
 * Form embedded MailerLite — iscrive a newsletter weekly BMX
 * Usato in /news/[slug] per capture lettori che leggono post completo
 * Endpoint: POST /api/newsletter/subscribe (lib/mailerlite.ts subscribeToNewsletter)
 */
export default function NewsletterSignup() {
  const [email, setEmail] = useState('');
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
        body: JSON.stringify({ email, username: email.split('@')[0] }),
      });
      const data = await res.json();

      if (data.ok) {
        setStatus('success');
        setMessage('Iscritto! La prossima domenica ti arriva la newsletter.');
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

  return (
    <div id="newsletter-signup" style={{
      background: 'linear-gradient(135deg, rgba(255,106,0,0.08) 0%, rgba(255,106,0,0.02) 100%)',
      border: '1px solid var(--orange)',
      borderRadius: 14,
      padding: '24px 22px',
      margin: '32px 0',
      scrollMarginTop: 80,
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)',
        textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8,
      }}>
        📬 Newsletter weekly
      </div>

      <h3 style={{
        fontFamily: 'var(--font-mono)', fontSize: 20,
        color: 'var(--bone)', margin: '0 0 8px 0', lineHeight: 1.3,
      }}>
        Cinque cose dal mondo BMX — ogni domenica
      </h3>

      <p style={{
        fontSize: 14, color: 'var(--gray-300)', margin: '0 0 18px 0', lineHeight: 1.5,
      }}>
        Tre minuti di lettura. Cinque cose che valgono dalla settimana di freestyle mondiale, raccontate da uno che ci gira dentro. Niente spam.
      </p>

      <form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="la tua email"
          required
          disabled={status === 'loading' || status === 'success'}
          style={{
            flex: 1,
            minWidth: 200,
            padding: '12px 14px',
            background: 'var(--gray-900)',
            border: '1px solid var(--gray-700)',
            borderRadius: 8,
            color: 'var(--bone)',
            fontSize: 15,
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={status === 'loading' || status === 'success'}
          style={{
            padding: '12px 20px',
            background: status === 'success' ? 'var(--gray-700)' : 'var(--orange)',
            color: status === 'success' ? 'var(--gray-300)' : '#000',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            cursor: status === 'loading' ? 'wait' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {status === 'loading' ? '...' : status === 'success' ? '✓ Iscritto' : 'Iscriviti'}
        </button>
      </form>

      {message && (
        <p style={{
          fontSize: 13,
          color: status === 'success' ? '#10b981' : status === 'error' ? '#ef4444' : 'var(--gray-400)',
          margin: '12px 0 0 0',
          fontFamily: 'var(--font-mono)',
        }}>
          {message}
        </p>
      )}
    </div>
  );
}
