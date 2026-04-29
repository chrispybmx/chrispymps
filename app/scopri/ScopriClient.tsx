'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { SpotMapPin, SpotType } from '@/lib/types';
import { TIPI_SPOT, CONDIZIONI, REGIONI_ITALIA, DIFFICOLTA } from '@/lib/constants';
import BottomNav from '@/components/BottomNav';

interface ScopriClientProps { spots: SpotMapPin[] }

export default function ScopriClient({ spots }: ScopriClientProps) {
  const [filterType,   setFilterType]   = useState<SpotType | ''>('');
  const [filterDiff,   setFilterDiff]   = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [query,        setQuery]        = useState('');

  const filtered = useMemo(() => {
    return spots.filter(s => {
      if (filterType && s.type !== filterType) return false;
      if (filterDiff && s.difficulty !== filterDiff) return false;
      if (filterRegion) {
        const region = REGIONI_ITALIA.find(r => r.label === filterRegion);
        if (region) {
          const [latMin, lonMin, latMax, lonMax] = region.bbox;
          if (s.lat < latMin || s.lat > latMax || s.lon < lonMin || s.lon > lonMax) return false;
        }
      }
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
  }, [spots, filterType, filterDiff, filterRegion, query]);

  const anyFilter = !!(filterType || filterDiff || filterRegion || query);

  const resetAll = useCallback(() => {
    setFilterType(''); setFilterDiff('');
    setFilterRegion(''); setQuery('');
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

        {/* Row 1: Titolo + spot count */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '12px 14px 8px', gap: 10,
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 24,
            color: 'var(--orange)', letterSpacing: '0.04em', flex: 1,
          }}>
            SCOPRI
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)' }}>
            {filtered.length} spot
          </div>
        </div>

        {/* Search input */}
        <div style={{ padding: '0 12px 8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--gray-800)', border: '1px solid var(--gray-700)',
            borderRadius: 8, padding: '8px 12px',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>
            </svg>
            <input
              type="text"
              placeholder="Nome spot, città, @rider..."
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

        {/* 3 dropdown filters: TIPO · DIFFICOLTÀ · REGIONE */}
        <div style={{
          display: 'flex', gap: 6, padding: '0 12px 10px',
          overflowX: 'auto', scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          alignItems: 'center',
        } as React.CSSProperties}>

          {/* TIPO */}
          <ScopriDropdown
            value={filterType}
            onChange={v => setFilterType(v as SpotType | '')}
            active={!!filterType}
          >
            <option value="">🎯 TIPO</option>
            {(Object.entries(TIPI_SPOT) as [SpotType, { label: string; emoji: string }][]).map(([key, info]) => (
              <option key={key} value={key}>{info.emoji} {info.label.toUpperCase()}</option>
            ))}
          </ScopriDropdown>

          {/* DIFFICOLTÀ */}
          <ScopriDropdown
            value={filterDiff}
            onChange={v => setFilterDiff(v)}
            active={!!filterDiff}
          >
            <option value="">⚡ LVL</option>
            {DIFFICOLTA.map(d => (
              <option key={d.value} value={d.value}>{d.label.toUpperCase()}</option>
            ))}
          </ScopriDropdown>

          {/* REGIONE */}
          <ScopriDropdown
            value={filterRegion}
            onChange={v => setFilterRegion(v)}
            active={!!filterRegion}
          >
            <option value="">🗺️ REG.</option>
            {REGIONI_ITALIA.map(r => (
              <option key={r.label} value={r.label}>{r.label}</option>
            ))}
          </ScopriDropdown>

          {/* Reset — solo se un filtro è attivo */}
          {anyFilter && (
            <button
              onClick={resetAll}
              style={{
                flexShrink: 0, padding: '6px 10px',
                border: '1px solid var(--gray-700)', borderRadius: 6,
                background: 'transparent',
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: 'var(--gray-500)', cursor: 'pointer', whiteSpace: 'nowrap',
                letterSpacing: '0.04em',
              }}
            >
              ✕ RESET
            </button>
          )}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 12px' }}>
          {filtered.map(spot => {
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
                  borderRadius: 10, overflow: 'hidden',
                  background: 'var(--gray-800)',
                  border: '1px solid var(--gray-700)',
                }}>
                  {/* Cover photo — square, consistent with profile */}
                  <div style={{
                    aspectRatio: '1/1', overflow: 'hidden',
                    background: '#111', position: 'relative',
                  }}>
                    {cover ? (
                      <img src={cover} alt={spot.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 36, opacity: 0.2 }}>{tipo.emoji}</span>
                      </div>
                    )}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', bottom: 6, left: 6, fontFamily: 'var(--font-mono)', fontSize: 9, color: tipo.color, background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 3 }}>
                      {tipo.emoji} {tipo.label.toUpperCase()}
                    </div>
                    {spot.condition === 'alive' ? (
                      <div style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#00c851', boxShadow: '0 0 6px #00c851' }} />
                    ) : (
                      <div style={{ position: 'absolute', top: 6, right: 6, fontFamily: 'var(--font-mono)', fontSize: 9, background: cond.bg, color: cond.color, padding: '2px 5px', borderRadius: 3 }}>
                        {cond.label.toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Info — fixed height for uniform grid */}
                  <div style={{ padding: '8px 10px', height: 60, overflow: 'hidden' }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3,
                    }}>
                      {spot.name}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {spot.city ? `📍 ${spot.city}` : ''}{spot.difficulty ? ` · ⚡ ${spot.difficulty.toUpperCase()}` : ''}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div style={{ color: 'var(--gray-600)', fontSize: 18, alignSelf: 'center', flexShrink: 0 }}>›</div>

                </div>
              </Link>
            );
          })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

/* ── Dropdown helper ── */
function ScopriDropdown({ value, onChange, active, children }: {
  value: string;
  onChange: (v: string) => void;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          padding: '6px 20px 6px 8px',
          border: `1px solid ${active ? 'var(--orange)' : 'var(--gray-700)'}`,
          borderRadius: 6,
          background: active ? 'rgba(255,106,0,0.12)' : 'var(--gray-800)',
          color: active ? 'var(--orange)' : 'var(--gray-400)',
          cursor: 'pointer',
          appearance: 'none', WebkitAppearance: 'none',
          outline: 'none',
          textTransform: 'uppercase', letterSpacing: '0.04em',
          minHeight: 32,
          minWidth: 80,
        } as React.CSSProperties}
      >
        {children}
      </select>
      <span style={{
        position: 'absolute', right: 6, top: '50%',
        transform: 'translateY(-50%)',
        fontSize: 8, color: active ? 'var(--orange)' : 'var(--gray-600)',
        pointerEvents: 'none',
      }}>▾</span>
    </div>
  );
}
