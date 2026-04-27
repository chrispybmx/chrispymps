'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { TIPI_SPOT, CITTA_ITALIANE, CITTA_COORDS, REGIONI_ITALIA, CONDIZIONI, DIFFICOLTA, APP_CONFIG } from '@/lib/constants';
import type { SpotType, SpotCondition, SpotMapPin } from '@/lib/types';
import SideMenu from './SideMenu';
import NotificationBell from './NotificationBell';
import Link from 'next/link';

interface TopBarProps {
  onSearch:          (query: string) => void;
  onFilterType:      (type: SpotType | null) => void;
  onFilterRegion:    (region: string | null) => void;
  onFilterCondition: (condition: SpotCondition | null) => void;
  onFilterDifficulty:(difficulty: string | null) => void;
  onAddSpot:         () => void;
  activeType:        SpotType | null;
  activeRegion:      string | null;
  activeCondition:   SpotCondition | null;
  activeDifficulty:  string | null;
  spots:             SpotMapPin[];
  filteredCount?:    number;
  onCitySelect:      (city: string, lat: number, lon: number) => void;
  onSpotSelect:      (pin: SpotMapPin) => void;
  onOpenAuth?:       () => void;
  darkMap?:          boolean;
  onToggleDarkMap?:  () => void;
}

interface NominatimPlace {
  name:        string;
  lat:         number;
  lon:         number;
  displayExtra: string;
  type:        string;
}

export default function TopBar({
  onSearch, onFilterType, onFilterRegion, onFilterCondition, onFilterDifficulty, onAddSpot,
  activeType, activeRegion, activeCondition, activeDifficulty,
  spots, filteredCount, onCitySelect, onSpotSelect, onOpenAuth,
  darkMap, onToggleDarkMap,
}: TopBarProps) {
  const [menuOpen,        setMenuOpen]        = useState(false);
  const [searchOpen,      setSearchOpen]      = useState(false);
  const [query,           setQuery]           = useState('');
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [sessionToken,    setSessionToken]    = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Load current user session for profile button + notification bell ── */
  useEffect(() => {
    import('@/lib/supabase-browser').then(({ supabaseBrowser }) => {
      supabaseBrowser().auth.getSession().then(({ data }) => {
        const un = data.session?.user?.user_metadata?.username
          ?? data.session?.user?.email?.split('@')[0]
          ?? null;
        setProfileUsername(un);
        setSessionToken(data.session?.access_token ?? null);
      });
    }).catch(() => {});
  }, []);

  /* ── Nominatim live geocoding ── */
  const [places,        setPlaces]        = useState<NominatimPlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);

  /* ── Ricerca utenti via API (include utenti senza spot) ── */
  interface ApiUser { id: string; username: string; bio?: string | null; spotCount: number }
  const [apiUsers,       setApiUsers]       = useState<ApiUser[]>([]);
  const [usersLoading,   setUsersLoading]   = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) { setPlaces([]); setApiUsers([]); return; }
    const t = setTimeout(async () => {
      /* Nominatim — solo se non sembra una ricerca utente pura */
      if (!isAtSearch) {
        setPlacesLoading(true);
        try {
          const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=it&accept-language=it`;
          const res  = await fetch(url, { headers: { 'User-Agent': 'ChrispyMaps/1.0' } });
          const data = await res.json() as Array<{ name: string; lat: string; lon: string; type: string; display_name: string }>;
          setPlaces(data.map(r => ({
            name:        r.name || r.display_name.split(',')[0],
            lat:         parseFloat(r.lat),
            lon:         parseFloat(r.lon),
            type:        r.type,
            displayExtra: r.display_name.split(',').slice(1, 3).join(',').trim(),
          })));
        } catch { setPlaces([]); }
        setPlacesLoading(false);
      }

      /* Ricerca utenti via API — sempre, per trovare anche chi non ha spot */
      setUsersLoading(true);
      try {
        const res = await fetch(`/api/users?q=${encodeURIComponent(needle)}`);
        const j   = await res.json();
        if (j.ok) setApiUsers(j.data ?? []);
      } catch { setApiUsers([]); }
      setUsersLoading(false);
    }, 380);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  /* ── Query normalizzata ── */
  const q = query.trim().toLowerCase();
  const isAtSearch = q.startsWith('@');
  const needle     = isAtSearch ? q.slice(1) : q;

  /* ── Tag matches: tipo + difficoltà ── */
  interface TagMatch {
    kind:   'type' | 'difficulty';
    value:  string;
    label:  string;
    emoji:  string;
    color:  string;
  }
  const tagMatches: TagMatch[] = q.length >= 2 ? [
    ...(Object.entries(TIPI_SPOT) as [SpotType, { label: string; emoji: string; color: string }][])
      .filter(([, info]) => info.label.toLowerCase().includes(needle))
      .map(([key, info]) => ({ kind: 'type' as const, value: key, label: info.label, emoji: info.emoji, color: info.color })),
    ...DIFFICOLTA
      .filter(d => d.label.toLowerCase().includes(needle))
      .map(d => ({ kind: 'difficulty' as const, value: d.value, label: d.label, emoji: '⚡', color: '#ffce4d' })),
  ] : [];

  /* ── Spot locali che matchano per nome ── */
  const spotMatches = q.length >= 1 && !isAtSearch
    ? spots.filter(s => s.name.toLowerCase().includes(q)).slice(0, 5)
    : [];

  /* ── Utenti: risultati API (include utenti senza spot) ── */
  const userMatches = apiUsers;

  /* ── Città con spot count ── */
  const cityCount: Record<string, number> = {};
  spots.forEach(s => { if (s.city) cityCount[s.city] = (cityCount[s.city] ?? 0) + 1; });
  const topCities = Object.entries(cityCount).sort((a, b) => b[1] - a[1]).slice(0, 12);

  /* ── Handlers ── */
  const handleTypeToggle = useCallback((type: SpotType) => {
    onFilterType(activeType === type ? null : type);
  }, [activeType, onFilterType]);

  const anyFilter = !!(activeType || activeRegion || activeDifficulty);

  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery('');
    onSearch('');
    setPlaces([]);
  };

  const pickCity = (cityValue: string) => {
    const coords = CITTA_COORDS[cityValue];
    if (coords) {
      onCitySelect(cityValue, coords[0], coords[1]);
      onSearch('');
      setSearchOpen(false);
      setQuery('');
    }
  };

  const pickPlace = (p: NominatimPlace) => {
    onCitySelect(p.name, p.lat, p.lon);
    onSearch('');
    setQuery('');
    setSearchOpen(false);
  };

  const pickSpot = (pin: SpotMapPin) => {
    setSearchOpen(false);
    setQuery(pin.name);
    onSearch(pin.name);
    onSpotSelect(pin);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && searchOpen) closeSearch(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen]);

  const hasResults = places.length > 0 || spotMatches.length > 0 || userMatches.length > 0 || tagMatches.length > 0 || usersLoading;

  const pickTag = (tag: TagMatch) => {
    if (tag.kind === 'type')       { onFilterType(tag.value as SpotType); }
    if (tag.kind === 'difficulty') { onFilterDifficulty(tag.value); }
    closeSearch();
  };

  return (
    <>
      {/* TopBar principale */}
      <header className="topbar" style={{ gap: 0 }}>
        <button onClick={() => setMenuOpen(true)} className="btn-ghost" aria-label="Apri menu" style={{ marginRight: 8, fontSize: 22 }}>
          ☰
        </button>
        <a href="/" style={{
          fontFamily: 'var(--font-mono)', fontSize: 22,
          color: 'var(--orange)', textDecoration: 'none',
          letterSpacing: '0.05em', flex: 1,
        }}>
          {APP_CONFIG.siteName}
          <span style={{ color: 'var(--gray-400)', fontSize: 14, marginLeft: 6 }}>BETA</span>
        </a>
        <button onClick={openSearch} className="btn-ghost" aria-label="Cerca spot" style={{ fontSize: 18 }}>
          🔍
        </button>
        <button onClick={onAddSpot} className="btn-primary" style={{ marginLeft: 8, padding: '8px 14px', fontSize: 14 }} aria-label="Aggiungi spot">
          + SPOT
        </button>
      </header>

      {/* Filter bar — dropdown + preferiti */}
      <div style={{
        position: 'fixed',
        top: 'var(--topbar-height)',
        left: 0, right: 0,
        background: 'rgba(10,10,10,0.92)',
        borderBottom: '1px solid var(--gray-700)',
        zIndex: 38,
        display: 'flex', alignItems: 'center',
        gap: 0,
      }}>
        {/* Scrollabile: tutti i dropdown */}
        <div style={{
          flex: 1,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          display: 'flex', alignItems: 'center',
          padding: '5px 8px',
          gap: 5,
          scrollbarWidth: 'none',
        } as React.CSSProperties}>

          <FilterDropdown
            value={activeRegion ?? ''}
            onChange={v => onFilterRegion(v || null)}
            active={!!activeRegion}
            placeholder="🗺️ REG"
          >
            <option value="">🗺️ REGIONE</option>
            {REGIONI_ITALIA.map(r => (
              <option key={r.label} value={r.label}>{r.label}</option>
            ))}
          </FilterDropdown>

          <FilterDropdown
            value={activeType ?? ''}
            onChange={v => onFilterType((v as SpotType) || null)}
            active={!!activeType}
            placeholder="🎯 TIPO"
          >
            <option value="">🎯 TIPO</option>
            {(Object.entries(TIPI_SPOT) as [SpotType, { label: string; emoji: string }][]).map(([key, info]) => (
              <option key={key} value={key}>{info.emoji} {info.label.toUpperCase()}</option>
            ))}
          </FilterDropdown>

          <FilterDropdown
            value={activeDifficulty ?? ''}
            onChange={v => onFilterDifficulty(v || null)}
            active={!!activeDifficulty}
            placeholder="⚡ LVL"
          >
            <option value="">⚡ LEVEL</option>
            {DIFFICOLTA.map(d => (
              <option key={d.value} value={d.value}>{d.label.toUpperCase()}</option>
            ))}
          </FilterDropdown>

          {/* Reset tutto — solo se un filtro è attivo */}
          {anyFilter && (
            <button
              onClick={() => { onFilterType(null); onFilterRegion(null); onFilterDifficulty(null); }}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                padding: '4px 8px',
                border: '1px solid var(--gray-600)',
                borderRadius: 2,
                background: 'transparent',
                color: 'var(--gray-400)',
                cursor: 'pointer', whiteSpace: 'nowrap',
                letterSpacing: '0.05em',
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Preferiti + Profilo — fisso a destra */}
        <div style={{
          padding: '7px 10px 7px 6px',
          flexShrink: 0,
          borderLeft: '1px solid var(--gray-700)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {/* Toggle mappa chiara/scura */}
          {onToggleDarkMap && (
            <button
              onClick={onToggleDarkMap}
              title={darkMap ? 'Mappa chiara' : 'Mappa scura'}
              style={{
                background: darkMap ? 'rgba(255,106,0,0.15)' : 'transparent',
                border: `1px solid ${darkMap ? 'var(--orange)' : 'var(--gray-600)'}`,
                borderRadius: 4,
                width: 30, height: 30, fontSize: 15,
                color: darkMap ? 'var(--orange)' : 'var(--gray-400)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
            >
              {darkMap ? '🌞' : '🌑'}
            </button>
          )}

          {/* Campanella notifiche — solo se loggato */}
          {sessionToken && (
            <NotificationBell token={sessionToken} />
          )}

          {/* Profilo — visibile solo se loggato */}
          {profileUsername ? (
            <Link
              href={`/u/${profileUsername}`}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 13,
                padding: '5px 10px',
                border: '1px solid var(--gray-600)',
                borderRadius: 2,
                background: 'transparent',
                color: 'var(--bone)',
                cursor: 'pointer', whiteSpace: 'nowrap',
                textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all 0.15s',
                minHeight: 32, touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              } as React.CSSProperties}
              title={`Il mio profilo (@${profileUsername})`}
            >
              👤
            </Link>
          ) : (
            <button
              onClick={onOpenAuth}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 13,
                padding: '5px 10px',
                border: '1px solid var(--gray-600)',
                borderRadius: 2,
                background: 'transparent',
                color: 'var(--gray-500)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center',
                minHeight: 32, touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              } as React.CSSProperties}
              title="Accedi per vedere il tuo profilo"
            >
              👤
            </button>
          )}
        </div>
      </div>

      {/* ══ SEARCH OVERLAY ══ */}
      {searchOpen && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(10,10,10,0.97)',
          zIndex: 99,
          display: 'flex', flexDirection: 'column',
          animation: 'fadeIn 0.15s ease-out',
        }}>
          <style>{`
            @media (hover: hover) and (pointer: fine) {
              .search-row-btn:hover { background: rgba(255,106,0,0.08) !important; }
              .search-user-row:hover { background: rgba(255,106,0,0.08) !important; }
              .favs-chip:hover { border-color: rgba(255,60,60,0.7) !important; color: #ff4d4d !important; }
            }
            .search-row-btn:active { background: rgba(255,106,0,0.12) !important; }
            .search-user-row:active { background: rgba(255,106,0,0.12) !important; }
          `}</style>
          {/* Input */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px',
            borderBottom: '1px solid var(--gray-700)',
            background: 'var(--gray-800)',
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>🔍</span>
            <input
              ref={inputRef}
              type="text"
              placeholder="Cerca spot, utente, #rail, #street, #beginner..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                flex: 1, border: 'none', background: 'transparent',
                fontSize: 18, padding: '4px 0', outline: 'none',
                color: 'var(--bone)', fontFamily: 'var(--font-mono)',
              }}
              autoComplete="off"
              spellCheck={false}
            />
            {placesLoading && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)' }}>...</span>
            )}
            <button onClick={closeSearch} style={{
              background: 'none', border: 'none', color: 'var(--gray-400)',
              fontSize: 22, cursor: 'pointer', padding: '0 4px', flexShrink: 0,
            }} aria-label="Chiudi">✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>

            {/* ── Risultati con query ── */}
            {query.trim().length >= 1 && (
              <>
                {/* Tag: tipo spot + livello — filtri rapidi */}
                {tagMatches.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <SectionLabel>🏷️ Tag / Filtri rapidi</SectionLabel>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {tagMatches.map(tag => (
                        <button
                          key={tag.kind + tag.value}
                          onClick={() => pickTag(tag)}
                          style={{
                            fontFamily: 'var(--font-mono)', fontSize: 14,
                            padding: '8px 14px',
                            border: `1px solid ${tag.color}55`,
                            borderRadius: 20,
                            background: `${tag.color}15`,
                            color: 'var(--bone)',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 7,
                            touchAction: 'manipulation',
                            transition: 'background 0.15s',
                          }}
                        >
                          <span>{tag.emoji}</span>
                          <span>{tag.label}</span>
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: 10,
                            color: tag.color, letterSpacing: '0.05em',
                          }}>
                            {tag.kind === 'type' ? `${spots.filter(s => s.type === tag.value).length} spot` : ''}
                          </span>
                          <span style={{ color: tag.color, fontSize: 13 }}>→</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Luoghi via Nominatim */}
                {places.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <SectionLabel>📍 Luoghi</SectionLabel>
                    {places.map((p, i) => (
                      <PlaceRow key={i} place={p} onPick={() => pickPlace(p)} />
                    ))}
                  </div>
                )}

                {/* Utenti */}
                {(userMatches.length > 0 || usersLoading) && (
                  <div style={{ marginBottom: 16 }}>
                    <SectionLabel>👤 Utenti{usersLoading ? ' …' : ''}</SectionLabel>
                    {userMatches.map((u) => (
                      <a
                        key={u.username}
                        href={`/u/${u.username}`}
                        onClick={() => setSearchOpen(false)}
                        className="search-user-row"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 14px', marginBottom: 4, textDecoration: 'none',
                          background: 'var(--gray-700)', border: '1px solid var(--gray-600)',
                          borderRadius: 8, transition: 'background 0.1s',
                          minHeight: 44, touchAction: 'manipulation',
                          WebkitTapHighlightColor: 'transparent',
                        } as React.CSSProperties}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', background: 'var(--orange)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--font-mono)', fontSize: 13, color: '#000', flexShrink: 0,
                        }}>
                          {u.username[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--bone)' }}>
                            @{u.username}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)' }}>
                            {u.spotCount === 0 ? 'nessuno spot' : `${u.spotCount} spot pubblicati`}
                            {u.bio ? ` · ${u.bio.slice(0, 40)}` : ''}
                          </div>
                        </div>
                        <span style={{ color: 'var(--orange)', fontSize: 16, flexShrink: 0 }}>→</span>
                      </a>
                    ))}
                  </div>
                )}

                {/* Spot nel database */}
                {spotMatches.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <SectionLabel>🎯 Spot</SectionLabel>
                    {spotMatches.map(pin => (
                      <SpotRow key={pin.id} pin={pin} onPick={() => pickSpot(pin)} />
                    ))}
                  </div>
                )}

                {/* Nessun risultato */}
                {!hasResults && !placesLoading && (
                  <div style={{
                    color: 'var(--gray-400)', fontFamily: 'var(--font-mono)',
                    fontSize: 14, padding: '24px 0', textAlign: 'center',
                  }}>
                    Nessun risultato per &quot;{query}&quot;
                  </div>
                )}
              </>
            )}

            {/* ── Empty state ── */}
            {query.trim().length === 0 && (
              <>
                {/* Città con spot */}
                {topCities.length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <SectionLabel>🔥 Città con spot</SectionLabel>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {topCities.map(([city, count]) => {
                        const cityLabel = CITTA_ITALIANE.find(c => c.value === city)?.label ?? city;
                        const hasCoords = !!CITTA_COORDS[city];
                        return (
                          <button key={city} onClick={() => pickCity(city)} disabled={!hasCoords} style={{
                            fontFamily: 'var(--font-mono)', fontSize: 14,
                            padding: '7px 13px',
                            border: '1px solid rgba(255,106,0,0.5)',
                            borderRadius: 20,
                            background: 'rgba(255,106,0,0.08)',
                            color: 'var(--bone)',
                            cursor: hasCoords ? 'pointer' : 'default',
                            display: 'flex', alignItems: 'center', gap: 6,
                          }}>
                            {cityLabel}
                            <span style={{
                              background: 'var(--orange)', color: '#000',
                              borderRadius: 10, padding: '1px 6px',
                              fontSize: 10, fontWeight: 700, lineHeight: 1.5,
                            }}>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Hint cerca qualsiasi luogo */}
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '16px',
                  background: 'var(--gray-800)',
                  border: '1px solid var(--gray-700)',
                  borderRadius: 10,
                }}>
                  <span style={{ fontSize: 24, flexShrink: 0 }}>🗺️</span>
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 14,
                      color: 'var(--bone)', marginBottom: 4,
                    }}>
                      Cerca qualsiasi luogo
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 12,
                      color: 'var(--gray-400)', lineHeight: 1.6,
                    }}>
                      Digita il nome di uno spot, città o utente.<br />
                      <span style={{ color: 'var(--gray-500)' }}>
                        Tipi: &quot;rail&quot;, &quot;park&quot;, &quot;street&quot;, &quot;gap&quot;...<br />
                        Livelli: &quot;beginner&quot;, &quot;pro&quot;...<br />
                        Utenti: &quot;@chrispy&quot; o solo &quot;chrispy&quot;
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} onOpenAuth={onOpenAuth} />
    </>
  );
}

/* ═══════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════ */

function PlaceRow({ place, onPick }: { place: NominatimPlace; onPick: () => void }) {
  const placeEmoji = place.type === 'city' || place.type === 'town' || place.type === 'village'
    ? '🏙️'
    : place.type === 'administrative'
    ? '📍'
    : '📌';

  return (
    <button
      onClick={onPick}
      className="search-row-btn"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: '11px 14px', marginBottom: 4,
        background: 'var(--gray-700)',
        border: '1px solid var(--gray-600)',
        borderRadius: 8, cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.1s', touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        minHeight: 44,
      } as React.CSSProperties}
    >
      <span style={{ fontSize: 20, flexShrink: 0 }}>{placeEmoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--bone)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {place.name}
        </div>
        {place.displayExtra && (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)',
            marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {place.displayExtra}
          </div>
        )}
      </div>
      <span style={{ color: 'var(--orange)', fontSize: 18, flexShrink: 0 }}>→</span>
    </button>
  );
}

function SpotRow({ pin, onPick }: { pin: SpotMapPin; onPick: () => void }) {
  const tipo = TIPI_SPOT[pin.type];

  return (
    <button
      onClick={onPick}
      className="search-row-btn"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: '11px 14px', marginBottom: 4,
        background: 'var(--gray-700)',
        border: '1px solid var(--gray-600)',
        borderRadius: 8, cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.1s', touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        minHeight: 44,
      } as React.CSSProperties}
    >
      <span style={{ fontSize: 22, flexShrink: 0 }}>{tipo.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--bone)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {pin.name}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginTop: 1,
        }}>
          {pin.city ? `${pin.city} · ` : ''}{tipo.label}
        </div>
      </div>
      <span style={{ color: 'var(--gray-400)', fontSize: 16, flexShrink: 0 }}>📍</span>
    </button>
  );
}

function FilterDropdown({ value, onChange, active, placeholder, children }: {
  value: string;
  onChange: (v: string) => void;
  active: boolean;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          padding: '4px 18px 4px 7px',
          border: `1px solid ${active ? 'var(--orange)' : 'var(--gray-600)'}`,
          borderRadius: 4,
          background: active ? 'rgba(255,106,0,0.15)' : 'rgba(26,26,26,0.9)',
          color: active ? 'var(--orange)' : 'var(--bone)',
          cursor: 'pointer',
          appearance: 'none',
          WebkitAppearance: 'none',
          minHeight: 30,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          outline: 'none',
          minWidth: 72,
          maxWidth: 110,
        } as React.CSSProperties}
      >
        {children}
      </select>
      <span style={{
        position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)',
        fontSize: 8, color: active ? 'var(--orange)' : 'var(--gray-500)',
        pointerEvents: 'none',
      }}>▾</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)',
      textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
    }}>
      {children}
    </div>
  );
}
