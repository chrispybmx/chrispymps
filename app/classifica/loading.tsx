export default function ClassificaLoading() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        gap: 16,
      }}
    >
      <div
        style={{
          fontFamily: 'VT323, monospace',
          fontSize: 32,
          color: '#ff6a00',
          letterSpacing: '0.05em',
          animation: 'flicker 2s infinite',
        }}
      >
        CLASSIFICA
      </div>
      <div style={{ fontFamily: 'VT323, monospace', fontSize: 14, color: '#888', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
        Caricamento...
      </div>
      <div style={{ width: 160, height: 3, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: '#ff6a00', borderRadius: 2, animation: 'loading-bar 1.5s ease-in-out infinite' }} />
      </div>
      <style>{`
        @keyframes loading-bar { 0% { width: 0%; margin-left: 0; } 50% { width: 60%; margin-left: 20%; } 100% { width: 0%; margin-left: 100%; } }
        @keyframes flicker { 0%, 95%, 100% { opacity: 1; } 96% { opacity: 0.6; } 98% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
