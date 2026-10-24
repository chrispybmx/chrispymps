'use client';

export default function GlobalError({
  _error,
  reset,
}: {
  _error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--black)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <p style={{ color: 'var(--orange)', fontWeight: 600, fontSize: 14, margin: 0 }}>Errore</p>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.5rem', lineHeight: 1.05, color: 'var(--bone)', margin: '8px 0 12px' }}>
          Qualcosa si è rotto
        </h1>
        <p style={{ color: '#bdbbb4', fontSize: 16, lineHeight: 1.6, margin: '0 0 24px' }}>
          Non è colpa tua. Riprova; se succede ancora, torna alla mappa.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={reset} style={{ minHeight: 44, padding: '0 20px', background: 'var(--orange)', color: '#0a0a0a', fontWeight: 700, border: 0, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 16 }}>
            Riprova
          </button>
          <a href="/map" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 20px', color: 'var(--bone)', border: '1px solid var(--gray-600)', borderRadius: 6, textDecoration: 'none', fontWeight: 600 }}>
            Mappa
          </a>
        </div>
      </div>
    </main>
  );
}
