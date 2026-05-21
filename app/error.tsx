'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        gap: 24,
        padding: 24,
      }}
    >
      <div
        style={{
          fontFamily: 'VT323, monospace',
          fontSize: 48,
          color: '#ff6a00',
          letterSpacing: '0.05em',
        }}
      >
        ERRORE
      </div>
      <div
        style={{
          fontFamily: 'VT323, monospace',
          fontSize: 18,
          color: '#888',
          textAlign: 'center',
          maxWidth: 400,
        }}
      >
        Qualcosa è andato storto. Riprova o torna alla mappa.
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={reset}
          style={{
            fontFamily: 'VT323, monospace',
            fontSize: 16,
            color: '#0a0a0a',
            background: '#ff6a00',
            border: 'none',
            padding: '8px 24px',
            cursor: 'pointer',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Riprova
        </button>
        <a
          href="/"
          style={{
            fontFamily: 'VT323, monospace',
            fontSize: 16,
            color: '#ff6a00',
            background: 'transparent',
            border: '1px solid #ff6a00',
            padding: '8px 24px',
            textDecoration: 'none',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Mappa
        </a>
      </div>
    </div>
  );
}
