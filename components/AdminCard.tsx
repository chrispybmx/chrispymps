'use client';

import { useState } from 'react';
import type { Spot } from '@/lib/types';
import { TIPI_SPOT, CONDIZIONI } from '@/lib/constants';

interface AdminCardProps {
  spot:       Spot;
  onApprove:  (id: string) => void;
  onReject:   (id: string) => void;
  onEdit:     (id: string) => void;
  onDelete:   (id: string, name: string) => void;
  loading?:   boolean;
  showStatus?: boolean;
}

export default function AdminCard({ spot, onApprove, onReject, onEdit, onDelete, loading, showStatus }: AdminCardProps) {
  const tipo    = TIPI_SPOT[spot.type];
  const cond    = CONDIZIONI[spot.condition];
  const photos  = spot.spot_photos ?? [];
  const isPending = spot.status === 'pending';

  const [photoIdx, setPhotoIdx] = useState(0);
  const currentPhoto = photos[photoIdx]?.url;
  const totalPhotos  = photos.length;

  const prevPhoto = () => setPhotoIdx(i => (i - 1 + totalPhotos) % totalPhotos);
  const nextPhoto = () => setPhotoIdx(i => (i + 1) % totalPhotos);

  const mapsUrl  = `https://www.google.com/maps?q=${spot.lat},${spot.lon}`;
  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${spot.lat},${spot.lon}`;

  return (
    <div
      style={{
        background: 'var(--gray-800)',
        border: `2px solid ${isPending ? 'var(--orange)' : 'var(--gray-600)'}`,
        borderRadius: 4,
        marginBottom: 20,
        overflow: 'hidden',
        opacity: loading ? 0.55 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {/* ── PHOTO GALLERY ── */}
      {totalPhotos > 0 ? (
        <div style={{ position: 'relative', background: '#111' }}>
          {/* Main photo */}
          <div style={{ height: 340, overflow: 'hidden', position: 'relative', cursor: totalPhotos > 1 ? 'pointer' : 'default' }}>
            <img
              src={currentPhoto}
              alt={`Foto ${photoIdx + 1} di ${spot.name}`}
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#0a0a0a' }}
              loading="lazy"
            />

            {/* Prev / Next arrows */}
            {totalPhotos > 1 && (
              <>
                <button
                  onClick={prevPhoto}
                  style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0, width: 52,
                    background: 'linear-gradient(to right, rgba(0,0,0,0.6), transparent)',
                    border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >‹</button>
                <button
                  onClick={nextPhoto}
                  style={{
                    position: 'absolute', right: 0, top: 0, bottom: 0, width: 52,
                    background: 'linear-gradient(to left, rgba(0,0,0,0.6), transparent)',
                    border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >›</button>
              </>
            )}

            {/* Photo counter */}
            <div style={{
              position: 'absolute', top: 10, left: 10,
              background: 'rgba(0,0,0,0.75)', color: '#fff',
              fontFamily: 'var(--font-mono)', fontSize: 12, padding: '3px 8px', borderRadius: 2,
            }}>
              {photoIdx + 1} / {totalPhotos}
            </div>

            {/* Type badge */}
            <div style={{
              position: 'absolute', top: 10, right: 10,
              background: tipo.color, color: 'var(--black)',
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
              padding: '3px 10px', borderRadius: 2, textTransform: 'uppercase',
            }}>
              {tipo.emoji} {tipo.label}
            </div>

            {/* Condition badge */}
            <div style={{
              position: 'absolute', bottom: 10, left: 10,
              background: cond.bg, color: cond.color,
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
              padding: '3px 10px', borderRadius: 2, textTransform: 'uppercase',
            }}>
              {cond.label}
            </div>

            {/* Status badge */}
            {showStatus && (
              <div style={{
                position: 'absolute', bottom: 10, right: 10,
                background: isPending ? '#ffce4d' : '#00c851', color: '#000',
                fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                padding: '3px 10px', borderRadius: 2, textTransform: 'uppercase',
              }}>
                {isPending ? '⏳ PENDING' : '✅ LIVE'}
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          {totalPhotos > 1 && (
            <div style={{
              display: 'flex', gap: 4, padding: '6px 6px',
              background: '#0a0a0a', overflowX: 'auto',
            }}>
              {photos.map((ph, i) => (
                <button
                  key={ph.id}
                  onClick={() => setPhotoIdx(i)}
                  style={{
                    flexShrink: 0,
                    width: 72, height: 52,
                    border: `2px solid ${i === photoIdx ? 'var(--orange)' : 'transparent'}`,
                    borderRadius: 2, overflow: 'hidden', padding: 0, cursor: 'pointer',
                    background: '#111',
                  }}
                >
                  <img src={ph.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* No photo */
        <div style={{
          height: 100, background: 'var(--gray-700)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 32 }}>{tipo.emoji}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)' }}>NESSUNA FOTO</span>
        </div>
      )}

      {/* ── INFO ── */}
      <div style={{ padding: '14px 16px' }}>

        {/* Name + city */}
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--orange)', margin: '0 0 2px', lineHeight: 1.2 }}>
          {spot.name}
        </h3>
        {spot.city && (
          <div style={{ color: 'var(--gray-300)', fontSize: 13, marginBottom: 10 }}>
            📍 {spot.city}{spot.region ? `, ${spot.region}` : ''}
          </div>
        )}

        {/* Description */}
        {spot.description && (
          <p style={{
            color: 'var(--bone)', fontSize: 13, lineHeight: 1.5,
            marginBottom: 12, padding: '8px 10px',
            background: 'rgba(255,255,255,0.04)', borderRadius: 2,
            borderLeft: '3px solid var(--orange)',
          }}>
            {spot.description}
          </p>
        )}

        {/* Meta grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginBottom: 12 }}>
          {spot.difficulty && (
            <MetaRow icon="🎯" label="Difficoltà" value={spot.difficulty} />
          )}
          {spot.surface && (
            <MetaRow icon="🛣️" label="Superficie" value={spot.surface} />
          )}
          <MetaRow icon="🕯️" label="Cera" value={spot.wax_needed ? 'Sì' : 'No'} />
          {spot.youtube_url && (
            <div style={{ gridColumn: '1 / -1' }}>
              <a href={spot.youtube_url} target="_blank" rel="noopener noreferrer"
                style={{ color: '#ff4444', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                ▶ VIDEO YOUTUBE ↗
              </a>
            </div>
          )}
        </div>

        {/* GPS + maps */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--gray-400)', marginBottom: 10,
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8,
        }}>
          <span>{spot.lat.toFixed(5)}, {spot.lon.toFixed(5)}</span>
          <span style={{ color: 'var(--gray-600)' }}>·</span>
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--orange)' }}>
            Maps ↗
          </a>
          <a href={streetViewUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#4db6f5' }}>
            Street View ↗
          </a>
        </div>

        {/* Submitter */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--gray-400)', marginBottom: 12,
          padding: '6px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 2,
        }}>
          <span style={{ color: 'var(--gray-300)' }}>Inviato da:</span>{' '}
          {spot.submitted_by_username ?? spot.submitted_by ?? '–'}
          <br />
          <span style={{ color: 'var(--gray-500)' }}>
            {new Date(spot.created_at).toLocaleString('it-IT')}
          </span>
          {spot.reviewer_notes && (
            <>
              <br />
              <span style={{ color: '#ffce4d' }}>⚠ Note: {spot.reviewer_notes}</span>
            </>
          )}
        </div>

        {/* ── ACTIONS ── */}
        {isPending ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => onApprove(spot.id)}
              disabled={!!loading}
              style={{
                flex: 3,
                background: '#00c851', color: '#000',
                fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700,
                border: 'none', borderRadius: 3, padding: '14px 8px', cursor: 'pointer',
                letterSpacing: '0.05em',
              }}
            >
              ✅ APPROVA
            </button>
            <button
              onClick={() => onEdit(spot.id)}
              disabled={!!loading}
              style={{
                flex: 1,
                background: 'var(--gray-700)', color: 'var(--bone)',
                fontFamily: 'var(--font-mono)', fontSize: 14,
                border: '1px solid var(--gray-600)', borderRadius: 3,
                padding: '14px 8px', cursor: 'pointer',
              }}
            >
              ✏️ Modifica
            </button>
            <button
              onClick={() => onReject(spot.id)}
              disabled={!!loading}
              style={{
                flex: 2,
                background: 'rgba(220, 53, 69, 0.12)', color: '#ff4d4d',
                fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700,
                border: '2px solid #ff4d4d', borderRadius: 3,
                padding: '14px 8px', cursor: 'pointer',
                letterSpacing: '0.05em',
              }}
            >
              ✕ RIFIUTA
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onEdit(spot.id)}
              disabled={!!loading}
              className="btn-secondary"
              style={{ flex: 2, justifyContent: 'center', fontSize: 14 }}
            >
              ✏️ Modifica
            </button>
            <button
              onClick={() => onDelete(spot.id, spot.name)}
              disabled={!!loading}
              style={{
                flex: 1,
                background: 'transparent', color: '#ff4444',
                fontFamily: 'var(--font-mono)', fontSize: 14,
                border: '1px solid #ff4444', borderRadius: 2,
                padding: '10px 8px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
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

/* ── Helper component ── */
function MetaRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
      <span style={{ color: 'var(--gray-500)' }}>{icon} {label}: </span>
      <span style={{ color: 'var(--bone)' }}>{value}</span>
    </div>
  );
}
