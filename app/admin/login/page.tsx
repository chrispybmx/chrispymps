'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const ERROR_MESSAGES: Record<string, string> = {
  wrong: 'Password errata.',
  rate: 'Troppi tentativi. Riprova tra qualche minuto.',
  missing: 'Password mancante.',
};

function LoginForm() {
  const params = useSearchParams();
  const errorKey = params.get('error');
  const error = errorKey ? ERROR_MESSAGES[errorKey] ?? 'Errore sconosciuto.' : '';

  return (
    <div style={{
      height: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--black)',
      padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 28,
          color: 'var(--orange)',
          textAlign: 'center',
          marginBottom: 32,
        }}>
          🏴 ADMIN<br />
          <span style={{ fontSize: 14, color: 'var(--gray-400)' }}>CHRISPYMPS</span>
        </div>

        <form action="/api/admin/login" method="POST" className="vhs-card" style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block',
              fontFamily: 'var(--font-mono)',
              fontSize: 12, color: 'var(--gray-400)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              marginBottom: 6,
            }}>
              Password
            </label>
            <input
              type="password"
              name="password"
              className="input-vhs"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p style={{
              color: 'var(--orange)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13, marginBottom: 12,
            }}>
              ⚠ {error}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            ACCEDI
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
