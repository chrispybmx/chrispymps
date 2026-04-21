'use client';

import type { Spot } from '@/lib/types';
import { TIPI_SPOT, CONDIZIONI } from '@/lib/constants';

interface AdminCardProps {
  spot:      Spot;
  onApprove: (id: string) => void;
  onReject:  (id: string) => void;
  onEdit:    (id: string) => void;
  loading?:  boolean;
}

export default function AdminCard({ spot, onApprove, onReject, onEdit, loading }: AdminCardProps) {
  const tipo = TIPI_SPOT[spot.type];
  const photos = spot.spot_photos ?? [];
  const cover  = photos[0]?.url;

  return (
    <div
      className="vhs-card"
      style={{
        marginBottom: 16,
        overflow: 'hidden',
        opacity: loading ? 0.6 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {/* Foto cover */}
      {cover && (
        <div style={{ height: 160, overflow: 'hidden', position: 'relative' }}>
          <img
            src={cover}
            alt={`Cover di ${spot.name}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: tipo.color, color: 'var(--black)',
            fontFamily: 'var(--font-mono)', fontSize: 11,
            padding: '2px 8px', borderRadius: 2, textTransform: 'uppercase',
          }}>
            {tipo.emoji} {tipo.label}
          </div>
          <div style={{
            position: 'absolute', top: 8, left: 8,
            background: 'rgba(0,0,0,0.7)',
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--bone)', padding: '2px 8px', borderRadius: 2,
          }}>
            {photos.length} foto
          </div>
        </div>
      )}

      {/* Contenuto */}
      <div style={{ padding: '12px 16px' }}>
        <h3 style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 20, color: 'var(--orange)',
          margin: '0 0 4px',
        }}>
          {spot.name}
        </h3>

        {spot.city && (
          <div style={{ color: 'var(--gray-400)', fontSize: 13, marginBottom: 8 }}>
            📍 {spot.city}{spot.region ? `, ${spot.region}` : ''}
          </div>
        )}

        {spot.description && (
          <p style={{ color: 'var(--bone)', fontSize: 14, lineHeight: 1.4, marginBottom: 8 }} className="truncate-2">
            {spot.description}
          </p>
        )}

        {/* Meta */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {spot.surface && <Tag label={spot.surface} />}
          {spot.difficulty && <Tag label={spot.difficulty} />}
          {spot.wax_needed && <Tag label="🕯 Cera" color="var(--coffee)" />}
          {spot.guardians && <Tag label="⚠ Accesso" color="var(--orange)" />}
        </div>

        {/* GPS */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11, color: 'var(--gray-400)', marginBottom: 12,
        }}>
          {spot.lat.toFixed(6)}, {spot.lon.toFixed(6)}
          {' · '}
          <a
            href={`https://www.google.com/maps?q=${spot.lat},${spot.lon}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--orange)' }}
          >
            Verifica su Maps
          </a>
        </div>

        {/* Timestamp */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginBottom: 14 }}>
          Inviato: {new Date(spot.created_at).toLocaleString('it-IT')}
        </div>

        {/* Azioni */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onApprove(spot.id)}
            disabled={loading}
            style={{
              flex: 1,
              background: '#00c851', color: '#000',
              fontFamily: 'var(--font-mono)', fontSize: 16,
              fontWeight: 600, border: 'none', borderRadius: 2,
              padding: '12px 8px', cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
          >
            ✅ APPROVA
          </button>
          <button
            onClick={() => onEdit(spot.id)}
            disabled={loading}
            style={{
              flex: 0,
              background: 'var(--gray-700)', color: 'var(--bone)',
              fontFamily: 'var(--font-mono)', fontSize: 16,
              border: '1px solid var(--gray-600)', borderRadius: 2,
              padding: '12px 14px', cursor: 'pointer',
            }}
          >
            ✏️
          </button>
          <button
            onClick={() => onReject(spot.id)}
            disabled={loading}
            style={{
              flex: 1,
              background: 'transparent', color: 'var(--orange)',
              fontFamily: 'var(--font-mono)', fontSize: 16,
              border: '1px solid var(--orange)', borderRadius: 2,
              padding: '12px 8px', cursor: 'pointer',
            }}
          >
            ❌ SCARTA
          </button>
        </div>
      </div>
    </div>
  );
}

function Tag({ label, color = 'var(--gray-400)' }: { label: string; color?: string }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color,
      border: `1px solid ${color}`,
      borderRadius: 2,
      padding: '1px 6px',
      textTransform: 'uppercase',
    }}>
      {label}
    </span>
  );
}
