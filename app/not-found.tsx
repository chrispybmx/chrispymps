import Link from 'next/link';

export default function NotFound() {
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
          fontSize: 96,
          color: '#ff6a00',
          letterSpacing: '0.05em',
        }}
      >
        404
      </div>
      <div
        style={{
          fontFamily: 'VT323, monospace',
          fontSize: 20,
          color: '#888',
          textAlign: 'center',
          maxWidth: 400,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
        }}
      >
        Pagina non trovata
      </div>
      <Link
        href="/"
        style={{
          fontFamily: 'VT323, monospace',
          fontSize: 16,
          color: '#0a0a0a',
          background: '#ff6a00',
          border: 'none',
          padding: '8px 24px',
          textDecoration: 'none',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        Torna alla mappa
      </Link>
    </div>
  );
}
