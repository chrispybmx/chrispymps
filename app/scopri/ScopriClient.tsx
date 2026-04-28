'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import type { SpotMapPin, SpotType, SpotCondition } from '@/lib/types';
import { TIPI_SPOT, CONDIZIONI, REGIONI_ITALIA, DIFFICOLTA } from '@/lib/constants';
import BottomNav from '@/components/BottomNav';
import NotificationBell from '@/components/NotificationBell';

/* ── Costanti ── */
const FAVS_KEY = 'cmaps_favs_v1';

function getFavIds(): string[] {
  try { return JSON.parse(localStorage.getItem(FAVS_KEY) ?? '[]') as string[]; }
  catch { return []; }
}

const TIPO_CHIPS: Array<{ key: SpotType | 'all'; label: string }> = [
  { key: 'all',       label: 'Tutti' },
  { key: 'street',    label: 'Street' },
  { key: 'park',      label: 'Park' },
  { key: 'bowl',      label: 'Bowl' },
  { key: 'rail',      label: 'Rail' },
  { key: 'ledge',     label: 'Ledge' },
  { key: 'gap',       label: 'Gap' },
  { key: 'plaza',     label: 'Plaza' },
  { key: 'diy',       label: 'DIY' },
  { key: 'pumptrack', label: 'Pump' },
  { key: 'trail',     label: 'Trail' },
];

interface ScopriClientProps { spots: SpotMapPin[] }

export default function ScopriClient({ spots }: ScopriClientProps) {
  const [filterType,   setFilterType]   = useState<SpotType | 'all'>('all');
  const [filterCond,   setFilterCond]   = useState<SpotCondition | 'all'>('all');
  const [filterDiff,   setFilterDiff]   = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [query,        setQuery]        = useState('');
  const [favsMode,     setFavsMode]     = useState(false);
  const [favIds,       setFavIds]       = useState<string[]>([]);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  /* Carica sessione + preferiti al mount */
  useEffect(() => {
    setFavIds(getFavIds());
    import('@/lib/supabase-browser').then(({ supabaseBrowser }) => {
      supabaseBrowser().auth.getSession().then(({ data }) => {
        setSessionToken(data.session?.access_token ?? null);
      });
    }).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return spots.filter(s => {
      if (filterType !== 'all' && s.type !== filterType) return false;
      if (filterCond !== 'all' && s.condition !== filterCond) return false;
      if (filterDiff && s.difficulty !== filterDiff) return false;
      if (filterRegion) {
        const region = REGIONI_ITALIA.find(r => r.label === filterRegion);
        if (region) {
          const [latMin, lonMin, latMax, lonMax] = region.bbox;
          if (s.lat < latMin || s.lat > latMax || s.lon < lonMin || s.lon > lonMax) return false;
        }
      }
      if (favsMode && !favIds.includes(s.id)) return false;
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
  }, [spots, filterType, filterCond, filterDiff, filterRegion, favsMode, favIds, query]);

  const handleTypeChip = useCallback((k: SpotType | 'all') => setFilterType(k), []);

  const anyFilter = filterType !== 'all' || filterCond !== 'all' || filterDiff !== '' ||
    filterRegion !== '' || query !== '' || favsMode;

  const resetAll = useCallback(() => {
    setFilterType('all'); setFilterCond('all'); setFilterDiff('');
    setFilterRegion(''); setQuery(''); setFavsMode(false);
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

        {/* Row 1: Titolo + azioni */}
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

          {/* Spot count */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)' }}>
            {filtered.length} spot
          </div>

          {/* Preferiti toggle */}
          <button
            onClick={() => setFavsMode(v => !v)}
            title={favsMode ? 'Mostra tutti' : 'Solo preferiti'}
            style={{
              width: 34, height: 34,
              background: favsMode ? 'rgba(255,60,60,0.15)' : 'transparent',
              border: `1px solid ${favsMode ? 'rgba(255,80,80,0.5)' : 'var(--gray-700)'}`,
              borderRadius: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, transition: 'all 0.15s',
            }}
          >
            {favsMode ? '❤️' : '🤍'}
          </button>

          {/* Campanella notifiche — solo se loggato */}
          {sessionToken && <NotificationBell token={sessionToken} />}
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
          display: 'flex', gap: 6, padding: '0 12px 6px',
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
                  flexShrink: 0, padding: '5px 11px', borderRadius: 20,
                  border: `1px solid ${isActive ? 'var(--orange)' : 'var(--gray-700)'}`,
                  background: isActive ? 'var(--orange)' : 'transparent',
                  color: isActive ? '#000' : 'var(--gray-400)',
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  cursor: 'pointer', transition: 'all 0.12s',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {info?.emoji && <span style={{ fontSize: 12 }}>{info.emoji}</span>}
                {label.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Chip condizione + difficoltà */}
        <div style={{
          display: 'flex', gap: 5, padding: '0 12px 6px',
          overflowX: 'auto', scrollbarWidth: 'none',
        } as React.CSSProperties}>
          {/* Condizione */}
          {(['all', 'alive', 'bustato', 'demolito'] as const).map(k => {
            const isActive = filterCond === k;
            const cond = k !== 'all' ? CONDIZIONI[k] : null;
            const color = cond?.bg ?? '#666';
            return (
              <button key={k} onClick={() => setFilterCond(k)} style={{
                flexShrink: 0, padding: '4px 10px', borderRadius: 20,
                border: `1px solid ${isActive ? color : 'var(--gray-700)'}`,
                background: isActive ? `${color}22` : 'transparent',
                color: isActive ? color : 'var(--gray-500)',
                fontFamily: 'var(--font-mono)', fontSize: 10,
                cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap',
              }}>
                {k === 'all' ? 'COND.' : cond?.label.toUpperCase()}
              </button>
            );
          })}

          {/* Separatore */}
          <div style={{ width: 1, background: 'var(--gray-700)', margin: '4px 3px', flexShrink: 0 }} />

          {/* Difficoltà */}
          {DIFFICOLTA.map(d => {
            const isActive = filterDiff === d.value;
            return (
              <button key={d.value} onClick={() => setFilterDiff(isActive ? '' : d.value)} style={{
                flexShrink: 0, padding: '4px 10px', borderRadius: 20,
                border: `1px solid ${isActive ? '#ffce4d' : 'var(--gray-700)'}`,
                background: isActive ? 'rgba(255,206,77,0.12)' : 'transparent',
                color: isActive ? '#ffce4d' : 'var(--gray-500)',
                fontFamily: 'var(--font-mono)', fontSize: 10,
                cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap',
              }}>
                ⚡ {d.label.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Regione dropdown + Reset */}
        <div style={{ padding: '0 12px 10px', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <select
              value={filterRegion}
              onChange={e => setFilterRegion(e.target.value)}
              style={{
                width: '100%',
                fontFamily: 'var(--font-mono)', fontSize: 11,
                padding: '7px 24px 7px 10px',
                border: `1px solid ${filterRegion ? 'var(--orange)' : 'var(--gray-700)'}`,
                borderRadius: 8,
                background: filterRegion ? 'rgba(255,106,0,0.08)' : 'var(--gray-800)',
                color: filterRegion ? 'var(--orange)' : 'var(--gray-400)',
                cursor: 'pointer',
                appearance: 'none', WebkitAppearance: 'none',
                outline: 'none', letterSpacing: '0.04em', textTransform: 'uppercase',
              } as React.CSSProperties}
            >
              <option value="">🗺️ TUTTE LE REGIONI</option>
              {REGIONI_ITALIA.map(r => (
                <option key={r.label} value={r.label}>{r.label}</option>
              ))}
            </select>
            <span style={{
              position: 'absolute', right: 8, top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 8, color: filterRegion ? 'var(--orange)' : 'var(--gray-500)',
              pointerEvents: 'none',
            }}>▾</span>
          </div>

          {anyFilter && (
            <button
              onClick={resetAll}
              style={{
                flexShrink: 0, padding: '7px 12px',
                border: '1px solid var(--gray-700)', borderRadius: 8,
                background: 'transparent',
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: 'var(--gray-500)', cursor: 'pointer', whiteSpace: 'nowrap',
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
            {favsMode ? 'Nessuno spot nei preferiti.' : 'Nessuno spot trovato.'}<br/>
            <span style={{ fontSize: 11, color: 'var(--gray-600)' }}>
              {favsMode ? 'Salva spot con ❤️ dalla mappa.' : 'Prova a cambiare filtro.'}
            </span>
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
                  display: 'flex', gap: 12, padding: '12px 14px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}>

                  {/* Thumbnail */}
                  <div style={{
                    width: 72, height: 72, flexShrink: 0, borderRadius: 8,
                    background: cover ? 'transparent' : 'var(--gray-800)',
                    border: '1px solid var(--gray-700)', overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative',
                  }}>
                    {cover ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={cover} alt={spot.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                    ) : (
                      <span style={{ fontSize: 28 }}>{tipo.emoji}</span>
                    )}
                    <div style={{
                      position: 'absolute', bottom: 3, left: 3,
                      background: 'rgba(0,0,0,0.75)', borderRadius: 4, padding: '2px 5px',
                      fontFamily: 'var(--font-mono)', fontSize: 8,
                      color: tipo.color, letterSpacing: '0.04em',
                    }}>
                      {spot.type.toUpperCase()}
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--bone)',
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
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9,
                        padding: '2px 6px', borderRadius: 10,
                        background: `${cond.bg}22`, color: cond.bg,
                        border: `1px solid ${cond.bg}55`, letterSpacing: '0.04em',
                      }}>
                        {cond.label.toUpperCase()}
                      </span>
                      {spot.difficulty && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#ffce4d' }}>
                          ⚡ {spot.difficulty.toUpperCase()}
                        </span>
                      )}
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
