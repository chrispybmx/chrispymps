import { ImageResponse } from 'next/og';

export const runtime     = 'edge';
export const alt         = 'Chrispy Maps — Mappa Spot BMX, Skate & Scooter Italia';
export const size        = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  // Fetch logo da URL pubblico (edge runtime, no fs)
  let logoSrc = '';
  try {
    const res = await fetch(new URL('/icons/icon-512.png', 'https://maps.chrispybmx.com'));
    if (res.ok) {
      const buf = await res.arrayBuffer();
      logoSrc = `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
    }
  } catch {
    // Fallback senza logo
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%',
          background: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top accent bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, background: '#ff6a00', display: 'flex' }} />

        {/* Subtle grid pattern */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, #1a1a1a 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          opacity: 0.3,
          display: 'flex',
        }} />

        {/* Glow behind logo */}
        <div style={{
          position: 'absolute',
          width: 500, height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,106,0,0.2) 0%, transparent 60%)',
          display: 'flex',
        }} />

        {/* Logo + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 36, zIndex: 1 }}>
          {logoSrc ? (
            <img src={logoSrc} width={140} height={140} style={{ borderRadius: 24 }} />
          ) : (
            <div style={{
              width: 140, height: 140, borderRadius: 24,
              background: '#1a1a1a', border: '3px solid #ff6a00',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 64,
            }}>
              🏴
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              fontSize: 72, fontWeight: 900,
              color: '#ff6a00',
              letterSpacing: '-2px',
              fontFamily: 'monospace',
              lineHeight: 1,
            }}>
              CHRISPY MAPS
            </div>
            <div style={{
              fontSize: 26,
              color: '#f3ead8',
              opacity: 0.5,
              fontFamily: 'monospace',
              letterSpacing: '4px',
              textTransform: 'uppercase',
            }}>
              Mappa Spot BMX Italia
            </div>
          </div>
        </div>

        {/* Pills row */}
        <div style={{ display: 'flex', gap: 14, marginTop: 44, zIndex: 1 }}>
          {['Street', 'Park', 'Bowl', 'Pumptrack', 'Rail', 'Ledge'].map(label => (
            <div key={label} style={{
              background: 'rgba(255,106,0,0.1)',
              border: '1px solid rgba(255,106,0,0.35)',
              borderRadius: 999,
              padding: '6px 18px',
              fontSize: 18,
              color: '#ff6a00',
              fontFamily: 'monospace',
            }}>
              {label}
            </div>
          ))}
        </div>

        {/* Domain */}
        <div style={{
          position: 'absolute', bottom: 28, right: 44,
          fontSize: 20, color: '#444',
          fontFamily: 'monospace',
          display: 'flex',
        }}>
          maps.chrispybmx.com
        </div>

        {/* Bottom accent bar */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 8, background: '#ff6a00', display: 'flex' }} />
      </div>
    ),
    { ...size },
  );
}
