'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { SpotMapPin, SpotType, SpotCondition } from '@/lib/types';
import { TIPI_SPOT, CONDIZIONI } from '@/lib/constants';
import BottomNav from '@/components/BottomNav';

const TIPO_CHIPS: Array<{ key: SpotType | 'all'; label: string }> = [
  { key: 'all',      label: 'Tutti' },
  { key: 'street',   label: 'Street' },
  { key: 'park',     label: 'Park' },
  { key: 'bowl',     label: 'Bowl' },
  { key: 'rail',     label: 'Rail' },
  { key: 'ledge',    label: 'Ledge' },
  { key: 'gap',      label: 'Gap' },
  { key: 'plaza',    label: 'Plaza' },
  { key: 'diy',      label: 'DIY' },
  { key: 'pumptrack',label: 'Pump' },
  { key: 'trail',    label: 'Trail' },
];

const COND_CHIPS: Array<{ key: SpotCondition | 'all'; label: string; color: string }> = [
  { key: 'all',      label: 'Tutti',    color: '#555' },
  { key: 'alive',    label: 'Alive',    color: '#00c851' },
  { key: 'bustato',  label: 'Bustato',  color: '#ff6a00' },
  { key: 'demolito', label: 'Demolito', color: '#555' },
];

interface ScopriClientProps { spots: SpotMapPin[] }

export default function ScopriClient({ spots }: ScopriClientProps) {
  const [filterType,  setFilterType]  = useState<SpotType | 'all'>('all');
  const [filterCond,  setFilterCond]  = useState<SpotCondition | 'all'>('all');
  const [query,       setQuery]       = useState('');

  const filtered = useMemo(() => {
    return spots.filter(s => {
      if (filterType !== 'all' && s.type !== filterType) return false;
      if (filterCond !== 'all' && s.condition !== filterCond) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          (s.city ?? '').toLowerCase().includes(q) ||
          (s.submitted_by_username ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [spots, filterType, filterCond, query]);

  const handleTypeChip = useCallback((k: SpotType | 'all') => {
    setFilterType(k);
  }, []);

  return (
    <div style={{ height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--black)' }}>

      {/* ── Header fisso ── */}
      <div style={{
        background: 'rgba(8,8,8,0.97)',
        borderBottom: '1px solid var(--gray-700)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        flexShrink: 0,
      }}>
        {/* Titolo */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px 10px',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, color: 'var(--orange)', letterSpacing: '0.04em' }}>
            SCOPRI
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-500)' }}>
            {filtered.length} spot
          </div>
        </div>

        {/* Search input */}
        <div style={{ padding: '0 12px 10px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--gray-800)',
            border: '1px solid var(--gray-700)',
            borderRadius: 8,
            padding: '8px 12px',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>
            </svg>
            <input
              type="text"
              placeholder="Cerca spot, città, rider..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                flex: 1, border: 'none', background: 'transparent',
                fontFamily: 'var(--font-mono)', fontSize: 14,
                color: 'var(--bone)', outline: 'none',
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: 'var(--gray-400)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>✕</button>
            )}
          </div>
        </div>

        {/* Chip tipo */}
        <div style={{
          display: 'flex', gap: 6, padding: '0 12px 8px',
          overflowX: 'auto', scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}>
          {TIPO_CHIPS.map(({ key, label }) => {
            const isActive = filterType === key;
            const info = key !== 'all' ? TIPI_SPOT[key as SpotType] : null;
            return (
              <button
                key={key}
                onClick={() => handleTypeChip(key)}
                style={{
                  flexShrink: 0,
                  padding: '5px 12px',
                  borderRadius: 20,
                  border: `1px solid ${isActive ? 'var(--orange)' : 'var(--gray-700)'}`,
                  background: isActive ? 'var(--orange)' : 'transparent',
                  color: isActive ? '#000' : 'var(--gray-400)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {info?.emoji && <span style={{ fontSize: 12 }}>{info.emoji}</span>}
                {label.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Chip condizione */}
        <div style={{
          display: 'flex', gap: 6, padding: '0 12px 10px',
          overflowX: 'auto', scrollbarWidth: 'none',
        } as React.CSSProperties}>
          {COND_CHIPS.map(({ key, label, color }) => {
            const isActive = filterCond === key;
            return (
              <button
                key={key}
                onClick={() => setFilterCond(key)}
                style={{
                  flexShrink: 0,
                  padding: '4px 10px',
                  borderRadius: 20,
                  border: `1px solid ${isActive ? color : 'var(--gray-700)'}`,
                  background: isActive ? `${color}22` : 'transparent',
                  color: isActive ? color : 'var(--gray-500)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                {label.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Lista scroll ── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 8px)',
      } as React.CSSProperties}>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', fontFamily: 'var(--font-mono)', color: 'var(--gray-500)', fontSize: 14 }}>
            Nessuno spot trovato.<br/>
            <span style={{ fontSize: 11, color: 'var(--gray-600)' }}>Prova a cambiare filtro.</span>
          </div>
        ) : (
          filtered.map(spot => {
            const tipo = TIPI_SPOT[spot.type];
            const cond = CONDIZIONI[spot.condition];
            const cover = spot.cover_url;
            return (
              <Link
                key={spot.id}
                href={`/map/spot/${spot.slug}`}
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <div style={{
                  display: 'flex',
                  gap: 12,
                  padding: '12px 14px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  transition: 'background 0.1s',
                }}>

                  {/* Thumbnail */}
                  <div style={{
                    width: 72, height: 72, flexShrink: 0,
                    borderRadius: 8,
                    background: cover ? 'transparent' : 'var(--gray-800)',
                    border: '1px solid var(--gray-700)',
                    overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative',
                  }}>
                    {cover ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={cover} alt={spot.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                    ) : (
                      <span style={{ fontSize: 28 }}>{tipo.emoji}</span>
                    )}
                    {/* Tipo badge sovrapposto */}
                    <div style={{
                      position: 'absolute', bottom: 3, left: 3,
                      background: 'rgba(0,0,0,0.75)',
                      borderRadius: 4,
                      padding: '2px 5px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 8,
                      color: tipo.color,
                      letterSpacing: '0.04em',
                    }}>
                      {spot.type.toUpperCase()}
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 15,
                      color: 'var(--bone)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {spot.name}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      {spot.city && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)' }}>
                          {spot.city}
                        </span>
                      )}
                      {/* Condizione badge */}
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9,
                        padding: '2px 6px', borderRadius: 10,
                        background: `${cond.bg}22`,
                        color: cond.bg,
                        border: `1px solid ${cond.bg}55`,
                        letterSpacing: '0.04em',
                      }}>
                        {cond.label.toUpperCase()}
                      </span>
                    </div>
                    {spot.submitted_by_username && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-600)' }}>
                        @{spot.submitted_by_username}
                      </div>
                    )}
                  </div>

                  {/* Arrow */}
                  <div style={{ color: 'var(--gray-600)', fontSize: 18, alignSelf: 'center', flexShrink: 0 }}>›</div>

                </div>
              </Link>
            );
          })
        )}
      </div>

      <BottomNav />
    </div>
  );
}
