'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (json.ok) {
        router.push('/admin');
        router.refresh();
      } else {
        setError('Password errata.');
      }
    } catch {
      setError('Errore di rete.');
    } finally {
      setLoading(false);
    }
  };

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

        <form onSubmit={handleSubmit} className="vhs-card" style={{ padding: 24 }}>
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
              className="input-vhs"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'ACCESSO...' : 'ACCEDI'}
          </button>
        </form>
      </div>
    </div>
  );
}
