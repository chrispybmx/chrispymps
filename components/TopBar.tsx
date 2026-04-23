'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { TIPI_SPOT, CITTA_ITALIANE, CITTA_COORDS, APP_CONFIG } from '@/lib/constants';
import type { SpotType, SpotMapPin } from '@/lib/types';
import SideMenu from './SideMenu';

interface TopBarProps {
  onSearch:        (query: string) => void;
  onFilterType:    (type: SpotType | null) => void;
  onAddSpot:       () => void;
  activeType:      SpotType | null;
  spots:           SpotMapPin[];
  filteredCount?:  number;
  onCitySelect:    (city: string, lat: number, lon: number) => void;
  onSpotSelect:    (pin: SpotMapPin) => void;
  onOpenAuth?:     () => void;
}

interface NominatimPlace {
  name:        string;
  lat:         number;
  lon:         number;
  displayExtra: string;
  type:        string;
}

export default function TopBar({
  onSearch, onFilterType, onAddSpot, activeType,
  spots, filteredCount, onCitySelect, onSpotSelect, onOpenAuth,
}: TopBarProps) {
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query,      setQuery]      = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Nominatim live geocoding ── */
  const [places,        setPlaces]        = useState<NominatimPlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) { setPlaces([]); return; }
    const t = setTimeout(async () => {
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
    }, 380);
    return () => clearTimeout(t);
  }, [query]);

  /* ── Spot locali che matchano (nome o username) ── */
  const q = query.trim().toLowerCase();
  const isAtSearch = q.startsWith('@'); // es. "@chrispy"

  const spotMatches = q.length >= 1
    ? spots.filter(s => {
        if (isAtSearch) return s.submitted_by_username?.toLowerCase().includes(q.slice(1)) ?? false;
        return s.name.toLowerCase().includes(q);
      }).slice(0, 6)
    : [];

  /* ── Utenti unici che matchano ── */
  const userMatches: { username: string; count: number }[] = q.length >= 2
    ? Object.entries(
        spots.reduce((acc, s) => {
          const un = s.submitted_by_username?.toLowerCase() ?? '';
          const needle = isAtSearch ? q.slice(1) : q;
          if (un && un.includes(needle)) {
            acc[s.submitted_by_username!] = (acc[s.submitted_by_username!] ?? 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>)
      )
        .map(([username, count]) => ({ username, count }))
        .slice(0, 4)
    : [];

  /* ── Città con spot count ── */
  const cityCount: Record<string, number> = {};
  spots.forEach(s => { if (s.city) cityCount[s.city] = (cityCount[s.city] ?? 0) + 1; });
  const topCities = Object.entries(cityCount).sort((a, b) => b[1] - a[1]).slice(0, 12);

  /* ── Handlers ── */
  const handleTypeToggle = useCallback((type: SpotType) => {
    onFilterType(activeType === type ? null : type);
  }, [activeType, onFilterType]);

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

  const hasResults = places.length > 0 || spotMatches.length > 0 || userMatches.length > 0;

  return (
    <>
      {/* TopBar principale */}
      <header className="topbar" style={{ gap: 0 }}>
        <button onClick={() => setMenuOpen(true)} className="btn-ghost" aria-label="Apri menu" style={{ marginRight: 8, fontSize: 22 }}>
          ☰
        </button>
        <a href="/map" style={{
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

      {/* Filter chips + preferiti */}
      <div style={{
        position: 'fixed',
        top: 'var(--topbar-height)',
        left: 0, right: 0,
        background: 'rgba(10,10,10,0.92)',
        borderBottom: '1px solid var(--gray-700)',
        zIndex: 38,
        display: 'flex', alignItems: 'center',
      }}>
        {/* Chips scrollabili */}
        <div
          style={{
            flex: 1,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '8px 0 8px 16px',
            display: 'flex', gap: 8,
          }}
          ref={(el) => { if (el) el.style.setProperty('scrollbar-width', 'none'); }}
        >
          <FilterChip label="TUTTI" active={activeType === null} color="var(--orange)" onClick={() => onFilterType(null)} count={filteredCount ?? spots.length} />
          {(['street', 'park', 'bowl', 'trail', 'diy', 'rail', 'ledge', 'plaza', 'gap'] as SpotType[]).map((type) => {
            const info = TIPI_SPOT[type];
            return (
              <FilterChip
                key={type}
                label={`${info.emoji} ${info.label.toUpperCase()}`}
                active={activeType === type}
                color={info.color}
                onClick={() => handleTypeToggle(type)}
                count={spots.filter(s => s.type === type).length}
              />
            );
          })}
        </div>

        {/* Preferiti — fisso a destra, stesso stile chip */}
        <div style={{
          padding: '8px 12px 8px 8px',
          flexShrink: 0,
          borderLeft: '1px solid var(--gray-700)',
          background: 'rgba(10,10,10,0.92)',
        }}>
          <a
            href="/preferiti"
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 13,
              padding: '4px 12px',
              border: '1px solid var(--gray-600)',
              borderRadius: 2,
              background: 'transparent',
              color: 'var(--bone)',
              cursor: 'pointer', whiteSpace: 'nowrap',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 5,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,60,60,0.7)';
              (e.currentTarget as HTMLElement).style.color = '#ff4d4d';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--gray-600)';
              (e.currentTarget as HTMLElement).style.color = 'var(--bone)';
            }}
          >
            ❤️ <span>I MIEI SPOT</span>
          </a>
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
              type="search"
              placeholder="Cerca città, spot, @utente..."
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
                {userMatches.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <SectionLabel>👤 Utenti</SectionLabel>
                    {userMatches.map(({ username, count }) => (
                      <a
                        key={username}
                        href={`/u/${username}`}
                        onClick={() => setSearchOpen(false)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 14px', marginBottom: 4, textDecoration: 'none',
                          background: 'var(--gray-700)', border: '1px solid var(--gray-600)',
                          borderRadius: 8, transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,106,0,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--gray-700)')}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', background: 'var(--orange)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--font-mono)', fontSize: 13, color: '#000', flexShrink: 0,
                        }}>
                          {username[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--bone)' }}>
                            @{username}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)' }}>
                            {count} spot
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
                      color: 'var(--gray-400)', lineHeight: 1.5,
                    }}>
                      Digita il nome di una città, quartiere o zona.<br />
                      Es: &quot;Merano&quot;, &quot;Pigneto Roma&quot;, &quot;Navigli&quot;...
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
  const [hover, setHover] = useState(false);

  const placeEmoji = place.type === 'city' || place.type === 'town' || place.type === 'village'
    ? '🏙️'
    : place.type === 'administrative'
    ? '📍'
    : '📌';

  return (
    <button
      onClick={onPick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: '11px 14px', marginBottom: 4,
        background: hover ? 'rgba(255,106,0,0.08)' : 'var(--gray-700)',
        border: '1px solid var(--gray-600)',
        borderRadius: 8, cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.1s',
      }}
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
  const [hover, setHover] = useState(false);
  const tipo = TIPI_SPOT[pin.type];

  return (
    <button
      onClick={onPick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: '11px 14px', marginBottom: 4,
        background: hover ? 'rgba(255,106,0,0.08)' : 'var(--gray-700)',
        border: '1px solid var(--gray-600)',
        borderRadius: 8, cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.1s',
      }}
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

function FilterChip({ label, active, color, onClick, count }: {
  label: string; active: boolean; color: string; onClick: () => void; count?: number;
}) {
  return (
    <button onClick={onClick} style={{
      fontFamily: 'var(--font-mono)', fontSize: 13, padding: '4px 12px',
      border: `1px solid ${active ? color : 'var(--gray-600)'}`,
      borderRadius: 2,
      background: active ? color : 'transparent',
      color: active ? 'var(--black)' : 'var(--bone)',
      cursor: 'pointer', whiteSpace: 'nowrap',
      textTransform: 'uppercase', letterSpacing: '0.06em',
      transition: 'all 0.15s',
      display: 'flex', alignItems: 'center', gap: 4,
    }}>
      {label}
      {count !== undefined && count > 0 && (
        <span style={{ background: active ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.1)', borderRadius: 8, padding: '0 5px', fontSize: 11 }}>
          {count}
        </span>
      )}
    </button>
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
