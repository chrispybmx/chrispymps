import { ImageResponse } from 'next/og';

export const runtime     = 'edge';
export const alt         = 'Chrispy Maps — Mappa Spot BMX, Skate & Scooter Italia';
export const size        = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
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
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, background: '#ff6a00', display: 'flex' }} />

        {/* Grid pattern background */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, #1a1a1a 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          opacity: 0.4,
          display: 'flex',
        }} />

        {/* Glow effect */}
        <div style={{
          position: 'absolute',
          width: 600, height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,106,0,0.15) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Logo + Title */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, zIndex: 1 }}>
          <div style={{ fontSize: 88, lineHeight: 1 }}>🗺️</div>

          <div style={{
            fontSize: 80, fontWeight: 900,
            color: '#ff6a00',
            letterSpacing: '-3px',
            fontFamily: 'monospace',
            lineHeight: 1,
          }}>
            CHRISPY MAPS
          </div>

          <div style={{
            fontSize: 30,
            color: '#f3ead8',
            opacity: 0.6,
            fontFamily: 'monospace',
            letterSpacing: '3px',
            textTransform: 'uppercase',
          }}>
            Spot BMX · Skate · Scooter · Italia
          </div>
        </div>

        {/* Pills row */}
        <div style={{ display: 'flex', gap: 16, marginTop: 48, zIndex: 1 }}>
          {['🏙️ Street', '🏟️ Park', '🥣 Bowl', '🌀 Pumptrack'].map(label => (
            <div key={label} style={{
              background: 'rgba(255,106,0,0.12)',
              border: '1px solid rgba(255,106,0,0.4)',
              borderRadius: 999,
              padding: '8px 20px',
              fontSize: 20,
              color: '#ff6a00',
              fontFamily: 'monospace',
            }}>
              {label}
            </div>
          ))}
        </div>

        {/* Domain */}
        <div style={{
          position: 'absolute', bottom: 36, right: 52,
          fontSize: 22, color: '#444',
          fontFamily: 'monospace',
          display: 'flex',
        }}>
          maps.chrispybmx.com
        </div>

        {/* Bottom accent bar */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 10, background: '#ff6a00', display: 'flex' }} />
      </div>
    ),
    { ...size },
  );
}
