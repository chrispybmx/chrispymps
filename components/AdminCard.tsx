'use client';

import type { Spot } from '@/lib/types';
import { TIPI_SPOT, CONDIZIONI } from '@/lib/constants';

interface AdminCardProps {
  spot:       Spot;
  onApprove:  (id: string) => void;
  onReject:   (id: string) => void;
  onEdit:     (id: string) => void;
  onDelete:   (id: string, name: string) => void;
  loading?:   boolean;
  showStatus?: boolean; // mostra badge status (approved/pending)
}

export default function AdminCard({ spot, onApprove, onReject, onEdit, onDelete, loading, showStatus }: AdminCardProps) {
  const tipo   = TIPI_SPOT[spot.type];
  const cond   = CONDIZIONI[spot.condition];
  const photos = spot.spot_photos ?? [];
  const cover  = photos[0]?.url;
  const isPending = spot.status === 'pending';

  return (
    <div className="vhs-card" style={{ marginBottom: 14, overflow: 'hidden', opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>

      {/* Cover foto */}
      {cover ? (
        <div style={{ height: 140, overflow: 'hidden', position: 'relative' }}>
          <img src={cover} alt={`Cover di ${spot.name}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
          <div style={{ position: 'absolute', top: 8, right: 8, background: tipo.color, color: 'var(--black)', fontFamily: 'var(--font-mono)', fontSize: 11, padding: '2px 8px', borderRadius: 2, textTransform: 'uppercase' }}>
            {tipo.emoji} {tipo.label}
          </div>
          {photos.length > 1 && (
            <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.7)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bone)', padding: '2px 8px', borderRadius: 2 }}>
              {photos.length} foto
            </div>
          )}
          {/* Condition badge */}
          <div style={{ position: 'absolute', bottom: 8, left: 8, background: cond.bg, color: cond.color, fontFamily: 'var(--font-mono)', fontSize: 11, padding: '2px 8px', borderRadius: 2, textTransform: 'uppercase' }}>
            {cond.label}
          </div>
          {showStatus && (
            <div style={{ position: 'absolute', bottom: 8, right: 8, background: isPending ? '#ffce4d' : '#00c851', color: '#000', fontFamily: 'var(--font-mono)', fontSize: 11, padding: '2px 8px', borderRadius: 2, textTransform: 'uppercase' }}>
              {isPending ? 'PENDING' : 'LIVE'}
            </div>
          )}
        </div>
      ) : (
        /* No photo placeholder */
        <div style={{ height: 60, background: 'var(--gray-700)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', position: 'relative' }}>
          <span style={{ fontSize: 28 }}>{tipo.emoji}</span>
          {showStatus && (
            <span style={{ background: isPending ? '#ffce4d' : '#00c851', color: '#000', fontFamily: 'var(--font-mono)', fontSize: 11, padding: '2px 8px', borderRadius: 2, textTransform: 'uppercase' }}>
              {isPending ? 'PENDING' : 'LIVE'}
            </span>
          )}
        </div>
      )}

      {/* Contenuto */}
      <div style={{ padding: '12px 14px' }}>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--orange)', margin: '0 0 3px' }}>
          {spot.name}
        </h3>
        {spot.city && (
          <div style={{ color: 'var(--gray-400)', fontSize: 13, marginBottom: 6 }}>
            📍 {spot.city}
          </div>
        )}
        {spot.description && (
          <p style={{ color: 'var(--bone)', fontSize: 13, lineHeight: 1.4, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {spot.description}
          </p>
        )}

        {/* GPS + Maps link */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginBottom: 10 }}>
          {spot.lat.toFixed(5)}, {spot.lon.toFixed(5)}
          {' · '}
          <a href={`https://www.google.com/maps?q=${spot.lat},${spot.lon}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--orange)' }}>
            Verifica su Maps ↗
          </a>
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginBottom: 12 }}>
          Inviato: {new Date(spot.created_at).toLocaleString('it-IT')}
        </div>

        {/* Azioni */}
        {isPending ? (
          /* Pending: approva / modifica / scarta */
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onApprove(spot.id)} disabled={!!loading} style={{ flex: 2, background: '#00c851', color: '#000', fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, border: 'none', borderRadius: 2, padding: '11px 8px', cursor: 'pointer' }}>
              ✅ APPROVA
            </button>
            <button onClick={() => onEdit(spot.id)} disabled={!!loading} style={{ background: 'var(--gray-700)', color: 'var(--bone)', fontFamily: 'var(--font-mono)', fontSize: 15, border: '1px solid var(--gray-600)', borderRadius: 2, padding: '11px 12px', cursor: 'pointer' }}>
              ✏️
            </button>
            <button onClick={() => onReject(spot.id)} disabled={!!loading} style={{ flex: 1, background: 'transparent', color: 'var(--orange)', fontFamily: 'var(--font-mono)', fontSize: 15, border: '1px solid var(--orange)', borderRadius: 2, padding: '11px 8px', cursor: 'pointer' }}>
              ❌
            </button>
          </div>
        ) : (
          /* Approved: modifica / elimina */
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onEdit(spot.id)} disabled={!!loading} className="btn-secondary" style={{ flex: 2, justifyContent: 'center', fontSize: 14 }}>
              ✏️ Modifica
            </button>
            <button
              onClick={() => onDelete(spot.id, spot.name)}
              disabled={!!loading}
              style={{
                flex: 1, background: 'transparent', color: '#ff4444',
                fontFamily: 'var(--font-mono)', fontSize: 14,
                border: '1px solid #ff4444', borderRadius: 2,
                padding: '10px 8px', cursor: 'pointer',
                justifyContent: 'center', display: 'flex', alignItems: 'center',
              }}
            >
              🗑️ Elimina
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
