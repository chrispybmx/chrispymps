'use client';

import { useState } from 'react';
import type { SpotMapPin } from '@/lib/types';
import { TIPI_SPOT } from '@/lib/constants';

export interface SpotWithDistance extends SpotMapPin {
  distance: number;
}

interface Props {
  radiusKm:    number;
  center:      { lat: number; lon: number } | null;
  spots:       SpotWithDistance[];
  onSetRadius: (km: number) => void;
  onUseGPS:    () => void;
  onClose:     () => void;
  onSpotClick: (pin: SpotMapPin) => void;
  gpsLoading?: boolean;
}

const RADII = [10, 25, 50, 100, 200];

export default function RadiusSheet({
  radiusKm, center, spots,
  onSetRadius, onUseGPS, onClose, onSpotClick, gpsLoading,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      position: 'fixed',
      left: 0, right: 0,
      bottom: 'var(--strip-height, 48px)',
      zIndex: 45,
      background: 'var(--gray-800)',
      border: '1px solid var(--gray-700)',
      borderBottom: 'none',
      borderRadius: '14px 14px 0 0',
      boxShadow: '0 -4px 32px rgba(0,0,0,0.6)',
      maxHeight: expanded ? '70vh' : '200px',
      transition: 'max-height 0.25s ease',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Handle */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '10px 0 6px',
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        <div style={{
          width: 36, height: 4,
          background: 'var(--gray-600)', borderRadius: 2,
        }} />
      </div>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 16px 10px',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 20 }}>🎯</span>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 15,
            color: 'var(--orange)', lineHeight: 1,
          }}>
            RICERCA PER RAGGIO
          </div>
          {center ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
              {spots.length} spot nel raggio di {radiusKm} km
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
              Scegli il centro sulla mappa
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'var(--gray-700)', border: '1px solid var(--gray-600)',
            borderRadius: 6, color: 'var(--bone)',
            width: 30, height: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 16, padding: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* GPS + Radius controls */}
      <div style={{
        padding: '0 16px 12px',
        borderBottom: '1px solid var(--gray-700)',
        flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {/* GPS button */}
        <button
          onClick={onUseGPS}
          disabled={gpsLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '10px 14px',
            background: 'rgba(255,106,0,0.08)',
            border: '1px solid rgba(255,106,0,0.4)',
            borderRadius: 8, cursor: gpsLoading ? 'default' : 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--orange)',
            opacity: gpsLoading ? 0.6 : 1,
          }}
        >
          <span style={{ fontSize: 18 }}>{gpsLoading ? '⌛' : '📡'}</span>
          {gpsLoading ? 'RICERCA POSIZIONE...' : 'USA LA MIA POSIZIONE'}
        </button>

        {/* Radius chips */}
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--gray-400)',
            display: 'flex', alignItems: 'center',
            flexShrink: 0, marginRight: 2,
          }}>
            RAGGIO:
          </span>
          {RADII.map(km => (
            <button
              key={km}
              onClick={() => onSetRadius(km)}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 12,
                padding: '4px 0',
                flex: 1,
                border: `1px solid ${radiusKm === km ? 'var(--orange)' : 'var(--gray-600)'}`,
                borderRadius: 6,
                background: radiusKm === km ? 'var(--orange)' : 'transparent',
                color: radiusKm === km ? '#000' : 'var(--gray-400)',
                cursor: 'pointer',
                transition: 'all 0.12s',
                fontWeight: radiusKm === km ? 700 : 400,
              }}
            >
              {km}km
            </button>
          ))}
        </div>
      </div>

      {/* No center state */}
      {!center && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '16px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🗺️</div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 13,
            color: 'var(--gray-400)', lineHeight: 1.5,
          }}>
            Tocca un punto sulla mappa<br />per centrare la ricerca
          </div>
        </div>
      )}

      {/* Spot list */}
      {center && (
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '10px 16px 12px',
        }}>
          {spots.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '20px 0',
              fontFamily: 'var(--font-mono)', fontSize: 14,
              color: 'var(--gray-400)',
            }}>
              Nessuno spot in {radiusKm} km.<br />
              <span style={{ fontSize: 12 }}>Prova ad aumentare il raggio.</span>
            </div>
          ) : (
            <>
              <div
                onClick={() => setExpanded(e => !e)}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: 'var(--orange)', letterSpacing: '0.08em',
                  marginBottom: 8, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {spots.length} SPOT TROVATI
                <span style={{ color: 'var(--gray-400)' }}>{expanded ? '▲' : '▼'}</span>
              </div>
              {spots.map(s => (
                <SpotDistanceRow key={s.id} spot={s} onClick={() => onSpotClick(s)} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SpotDistanceRow({ spot, onClick }: { spot: SpotWithDistance; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const tipo = TIPI_SPOT[spot.type];

  const dist = spot.distance < 1
    ? `${Math.round(spot.distance * 1000)} m`
    : `${spot.distance.toFixed(1)} km`;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '9px 10px', marginBottom: 4,
        background: hover ? 'rgba(255,106,0,0.07)' : 'var(--gray-700)',
        border: '1px solid var(--gray-600)',
        borderRadius: 8, cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ fontSize: 20, flexShrink: 0 }}>{tipo.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {spot.name}
        </div>
        {spot.city && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginTop: 1 }}>
            {spot.city} · {tipo.label}
          </div>
        )}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 13,
        color: 'var(--orange)', flexShrink: 0, fontWeight: 700,
      }}>
        {dist}
      </div>
    </button>
  );
}
