'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { TIPI_SPOT, OSTACOLI, CITTA_ITALIANE, CITTA_COORDS, REGIONI_ITALIA, CONDIZIONI, DIFFICOLTA, APP_CONFIG, DEBOUNCE_SEARCH_MS } from '@/lib/constants';
import type { Ostacolo, SpotType, SpotCondition, SpotMapPin } from '@/lib/types';
import { geocodeForward, type GeoPlace } from '@/lib/geocoding';
import { useUser } from '@/hooks/useUser';
import SideMenu from './SideMenu';
import NotificationBell from './NotificationBell';
import Link from 'next/link';

interface TopBarProps {
  onSearch:          (query: string) => void;
  onFilterType:      (type: SpotType | null) => void;
  onFilterRegion:    (region: string | null) => void;
  onFilterCondition: (condition: SpotCondition | null) => void;
  onFilterDifficulty:(difficulty: string | null) => void;
  /** «Dove trovo un rail» e' la domanda vera del rider. Fino a ora il sito non
   *  poteva rispondere: l'informazione non era registrata da nessuna parte. */
  onFilterOstacolo:  (o: Ostacolo | null) => void;
  onAddSpot:         () => void;
  activeType:        SpotType | null;
  activeRegion:      string | null;
  activeCondition:   SpotCondition | null;
  activeDifficulty:  string | null;
  activeOstacolo:    Ostacolo | null;
  spots:             SpotMapPin[];
  filteredCount?:    number;
  onCitySelect:      (city: string, lat: number, lon: number) => void;
  onSpotSelect:      (pin: SpotMapPin) => void;
  onOpenAuth?:       () => void;
}

export default function TopBar({
  onSearch, onFilterType, onFilterRegion, onFilterCondition, onFilterDifficulty, onFilterOstacolo, onAddSpot,
  activeType, activeRegion, activeCondition, activeDifficulty, activeOstacolo,
  spots, filteredCount, onCitySelect, onSpotSelect, onOpenAuth,
}: TopBarProps) {
  const [menuOpen,        setMenuOpen]        = useState(false);
  const [searchOpen,      setSearchOpen]      = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [query,           setQuery]           = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Sessione utente (hook centralizzato) ── */
  const user = useUser(); // undefined=loading, null=guest, UserSession=logged
  const profileUsername = user?.username ?? null;
  const sessionToken    = user?.accessToken ?? null;

  /* ── Nominatim live geocoding ── */
  const [places,        setPlaces]        = useState<GeoPlace[]>([]);
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
          setPlaces(await geocodeForward(query, { limit: 5 }));
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
    }, DEBOUNCE_SEARCH_MS);
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
  const topCities = Object.entries(cityCount).sort((a, b) => b[1] - a[1]).slice(0, 3);

  /* ── Handlers ── */
  const handleTypeToggle = useCallback((type: SpotType) => {
    onFilterType(activeType === type ? null : type);
  }, [activeType, onFilterType]);

  const anyFilter = !!(activeType || activeRegion || activeDifficulty || activeOstacolo);

  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery('');
    onSearch('');
    setPlaces([]);
  }, [onSearch]);

  const pickCity = (cityValue: string) => {
    const coords = CITTA_COORDS[cityValue];
    if (coords) {
      onCitySelect(cityValue, coords[0], coords[1]);
      onSearch('');
      setSearchOpen(false);
      setQuery('');
    }
  };

  const pickPlace = (p: GeoPlace) => {
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
  }, [searchOpen, closeSearch]);

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
        {/* Notifiche + Preferiti — solo su mobile */}
        <div className="topbar-mobile-actions" style={{ alignItems: 'center', gap: 2 }}>
          {sessionToken && <NotificationBell token={sessionToken} />}
        </div>
        {/* FILTRI button — mobile only (filter bar hidden on mobile) */}
        <button
          onClick={() => setFilterSheetOpen(true)}
          className="topbar-filter-btn"
          style={{
            background: anyFilter ? 'var(--orange)' : 'transparent',
            border: 'none',
            borderRadius: 4,
            width: 40, height: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative',
            color: anyFilter ? '#000' : 'var(--gray-400)',
          }}
          aria-label="Filtri"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          {anyFilter && (
            <span style={{
              position: 'absolute', top: 4, right: 4,
              width: 8, height: 8, borderRadius: '50%',
              background: anyFilter ? '#000' : 'var(--orange)',
            }} />
          )}
        </button>
        <button onClick={openSearch} className="btn-ghost" aria-label="Cerca spot" style={{ fontSize: 18 }}>
          🔍
        </button>
        <button onClick={onAddSpot} className="btn-primary topbar-add-btn" style={{ marginLeft: 8, padding: '8px 14px', fontSize: 14 }} aria-label="Aggiungi spot">
          + SPOT
        </button>
      </header>

      {/* Filter bar */}
      <div style={{
        display: 'flex',
        position: 'fixed',
        top: 'var(--topbar-height)',
        left: 0, right: 0,
        background: 'rgba(10,10,10,0.92)',
        borderBottom: '1px solid var(--gray-700)',
        zIndex: 38,
        alignItems: 'center',
        padding: '6px 10px',
        gap: 8,
      }} className="map-filter-bar">

        {/* Bottone FILTRI */}
        <button
          onClick={() => setFilterSheetOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            fontFamily: 'var(--font-mono)', fontSize: 11,
            padding: '0 14px',
            height: 36,
            border: 'none',
            borderRadius: 8,
            background: anyFilter ? 'var(--orange)' : 'rgba(255,255,255,0.07)',
            color: anyFilter ? '#000' : 'var(--gray-300)',
            cursor: 'pointer', whiteSpace: 'nowrap',
            letterSpacing: '0.06em',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            flexShrink: 0,
            fontWeight: anyFilter ? 700 : 400,
            transition: 'background 0.15s, color 0.15s',
            boxShadow: anyFilter ? '0 0 12px rgba(255,106,0,0.35)' : 'none',
          } as React.CSSProperties}
          aria-label="Apri filtri"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          FILTRI
          {anyFilter && (
            <span style={{
              background: '#000', color: 'var(--orange)',
              borderRadius: '50%', width: 17, height: 17,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, lineHeight: 1, flexShrink: 0,
            }}>
              {[activeType, activeRegion, activeCondition, activeDifficulty, activeOstacolo].filter(Boolean).length}
            </span>
          )}
        </button>

        {/* Chips filtri attivi — scorribili */}
        {anyFilter && (
          <div style={{
            flex: 1, display: 'flex', gap: 6, overflowX: 'auto',
            scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
            alignItems: 'center',
          } as React.CSSProperties}>
            {activeType && (
              <ActiveChip label={`${TIPI_SPOT[activeType].emoji} ${TIPI_SPOT[activeType].label}`} onRemove={() => onFilterType(null)} />
            )}
            {activeRegion && (
              <ActiveChip label={activeRegion} onRemove={() => onFilterRegion(null)} />
            )}
            {activeCondition && (
              <ActiveChip label={activeCondition.toUpperCase()} onRemove={() => onFilterCondition(null)} />
            )}
            {activeDifficulty && (
              <ActiveChip label={`⚡ ${activeDifficulty}`} onRemove={() => onFilterDifficulty(null)} />
            )}
          </div>
        )}

        {/* Reset tutto */}
        {anyFilter && (
          <button
            onClick={() => { onFilterType(null); onFilterRegion(null); onFilterCondition(null); onFilterDifficulty(null); }}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              padding: '0 10px', height: 36,
              border: 'none',
              borderRadius: 8, background: 'rgba(255,255,255,0.07)',
              color: 'var(--gray-400)', cursor: 'pointer',
              whiteSpace: 'nowrap', flexShrink: 0,
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            } as React.CSSProperties}
            aria-label="Azzera filtri"
          >
            ✕
          </button>
        )}

        {/* Profilo — desktop only */}
        <div className="map-profile-section" style={{
          flexShrink: 0, borderLeft: '1px solid var(--gray-700)',
          paddingLeft: 10, alignItems: 'center', gap: 6,
        }}>
          {sessionToken && (
            <div className="filterbar-bell">
              <NotificationBell token={sessionToken} />
            </div>
          )}
          {profileUsername ? (
            <Link href={`/u/${profileUsername}`} style={{
              fontFamily: 'var(--font-mono)', fontSize: 13,
              padding: '5px 10px', border: '1px solid var(--gray-600)',
              borderRadius: 2, background: 'transparent',
              color: 'var(--bone)', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 5,
              minHeight: 32, touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            } as React.CSSProperties}>👤</Link>
          ) : (
            <button onClick={onOpenAuth} style={{
              fontFamily: 'var(--font-mono)', fontSize: 13,
              padding: '5px 10px', border: '1px solid var(--gray-600)',
              borderRadius: 2, background: 'transparent',
              color: 'var(--gray-500)', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              minHeight: 32, touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            } as React.CSSProperties}>👤</button>
          )}
        </div>
      </div>

      {/* ══ FILTER SHEET ══ */}
      {filterSheetOpen && (
        <FilterSheet
          activeType={activeType}
          activeRegion={activeRegion}
          activeCondition={activeCondition}
          activeDifficulty={activeDifficulty}
          activeOstacolo={activeOstacolo}
          onFilterType={onFilterType}
          onFilterRegion={onFilterRegion}
          onFilterCondition={onFilterCondition}
          onFilterDifficulty={onFilterDifficulty}
          onFilterOstacolo={onFilterOstacolo}
          onClose={() => setFilterSheetOpen(false)}
          filteredCount={filteredCount ?? spots.length}
        />
      )}

      {/* ══ SEARCH OVERLAY ══ */}
      {searchOpen && (
        <div
          onTouchStart={e => { (e.currentTarget as HTMLElement).dataset.sx = String(e.touches[0].clientX); }}
          onTouchEnd={e => {
            const sx = parseFloat((e.currentTarget as HTMLElement).dataset.sx ?? '0');
            const dx = (e.changedTouches[0]?.clientX ?? 0) - sx;
            if (dx > 100) closeSearch(); // swipe right to dismiss
          }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(10,10,10,0.97)',
            zIndex: 99,
            display: 'flex', flexDirection: 'column',
            animation: 'slideDown 0.2s ease-out',
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

function PlaceRow({ place, onPick }: { place: GeoPlace; onPick: () => void }) {
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
          minHeight: 44,
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

/* ── Chip filtro attivo nella filter bar ── */
function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      fontFamily: 'var(--font-mono)', fontSize: 11,
      padding: '4px 8px 4px 10px',
      background: 'rgba(255,106,0,0.15)',
      border: '1px solid rgba(255,106,0,0.4)',
      borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0,
      color: 'var(--orange)',
    }}>
      {label}
      <button
        onClick={onRemove}
        style={{
          background: 'none', border: 'none', color: 'var(--orange)',
          cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0,
          display: 'flex', alignItems: 'center',
          touchAction: 'manipulation',
        }}
        aria-label={`Rimuovi filtro ${label}`}
      >✕</button>
    </div>
  );
}

/* ── Filter Sheet (slide-up) ── */
function FilterSheet({
  activeType, activeRegion, activeCondition, activeDifficulty, activeOstacolo,
  onFilterType, onFilterRegion, onFilterCondition, onFilterDifficulty, onFilterOstacolo,
  onClose, filteredCount,
}: {
  activeType: SpotType | null;
  activeRegion: string | null;
  activeCondition: SpotCondition | null;
  activeDifficulty: string | null;
  activeOstacolo: Ostacolo | null;
  onFilterType: (t: SpotType | null) => void;
  onFilterRegion: (r: string | null) => void;
  onFilterCondition: (c: SpotCondition | null) => void;
  onFilterDifficulty: (d: string | null) => void;
  onFilterOstacolo: (o: Ostacolo | null) => void;
  onClose: () => void;
  filteredCount: number;
}) {
  const hasFilters = !!(activeType || activeRegion || activeCondition || activeDifficulty);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 79, backdropFilter: 'blur(2px)' }}
      />
      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--gray-800)',
        borderTop: '2px solid var(--orange)',
        borderRadius: '16px 16px 0 0',
        zIndex: 80,
        maxHeight: '80dvh', overflowY: 'auto',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
        animation: 'slideUp 0.25s ease-out',
      }}>
        <div className="bottom-sheet-handle" />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px 16px',
          borderBottom: '1px solid var(--gray-700)',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--orange)' }}>
            ⚡ FILTRI
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {hasFilters && (
              <button
                onClick={() => { onFilterType(null); onFilterRegion(null); onFilterCondition(null); onFilterDifficulty(null); }}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  padding: '6px 12px', border: '1px solid var(--gray-600)',
                  borderRadius: 4, background: 'transparent',
                  color: 'var(--gray-400)', cursor: 'pointer',
                  touchAction: 'manipulation',
                }}
              >
                RESET
              </button>
            )}
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: 'var(--gray-400)',
              fontSize: 22, cursor: 'pointer', padding: '0 4px',
            }} aria-label="Chiudi">✕</button>
          </div>
        </div>

        <div style={{ padding: '20px' }}>

          {/* TIPO */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Tipo spot
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(Object.entries(TIPI_SPOT) as [SpotType, { label: string; emoji: string; color: string }][]).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => onFilterType(activeType === key ? null : key)}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 13,
                    padding: '8px 14px',
                    border: `1px solid ${activeType === key ? info.color : 'var(--gray-600)'}`,
                    borderRadius: 20,
                    background: activeType === key ? `${info.color}22` : 'transparent',
                    color: activeType === key ? info.color : 'var(--gray-400)',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', gap: 6,
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'all 0.15s',
                  } as React.CSSProperties}
                >
                  <span>{info.emoji}</span>
                  <span>{info.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* COSA C'È — l'ostacolo, non il contesto */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Cosa c&apos;è
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(Object.entries(OSTACOLI) as [Ostacolo, typeof OSTACOLI[Ostacolo]][]).map(([o, info]) => (
                <button
                  key={o}
                  onClick={() => onFilterOstacolo(activeOstacolo === o ? null : o)}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 12,
                    padding: '7px 13px',
                    border: `1px solid ${activeOstacolo === o ? 'var(--orange)' : 'var(--gray-600)'}`,
                    borderRadius: 20,
                    background: activeOstacolo === o ? 'rgba(255,106,0,0.15)' : 'transparent',
                    color: activeOstacolo === o ? 'var(--orange)' : 'var(--gray-400)',
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'all 0.15s',
                  } as React.CSSProperties}
                >
                  {info.emoji} {info.label}
                </button>
              ))}
            </div>
          </div>

          {/* DIFFICOLTÀ */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Difficoltà
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {DIFFICOLTA.map(d => (
                <button
                  key={d.value}
                  onClick={() => onFilterDifficulty(activeDifficulty === d.value ? null : d.value)}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 13,
                    padding: '8px 16px',
                    border: `1px solid ${activeDifficulty === d.value ? '#ffce4d' : 'var(--gray-600)'}`,
                    borderRadius: 20,
                    background: activeDifficulty === d.value ? 'rgba(255,206,77,0.15)' : 'transparent',
                    color: activeDifficulty === d.value ? '#ffce4d' : 'var(--gray-400)',
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'all 0.15s',
                  } as React.CSSProperties}
                >
                  ⚡ {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* REGIONE */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Regione
            </div>
            <div style={{ position: 'relative' }}>
              <select
                value={activeRegion ?? ''}
                onChange={e => onFilterRegion(e.target.value || null)}
                style={{
                  width: '100%', fontFamily: 'var(--font-mono)', fontSize: 14,
                  padding: '12px 36px 12px 14px',
                  border: `1px solid ${activeRegion ? 'var(--orange)' : 'var(--gray-600)'}`,
                  borderRadius: 8, background: 'var(--gray-700)',
                  color: activeRegion ? 'var(--orange)' : 'var(--bone)',
                  appearance: 'none', WebkitAppearance: 'none', outline: 'none',
                  cursor: 'pointer',
                } as React.CSSProperties}
              >
                <option value="">Tutte le regioni</option>
                {REGIONI_ITALIA.map(r => (
                  <option key={r.label} value={r.label}>{r.emoji} {r.label}</option>
                ))}
              </select>
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--gray-400)', pointerEvents: 'none' }}>▾</span>
            </div>
          </div>

        </div>

        {/* Footer — Vedi risultati */}
        <div style={{ padding: '0 20px 8px' }}>
          <button
            onClick={onClose}
            style={{
              width: '100%', fontFamily: 'var(--font-mono)', fontSize: 15,
              padding: '14px', background: 'var(--orange)', color: '#000',
              border: 'none', borderRadius: 10, cursor: 'pointer',
              fontWeight: 700, letterSpacing: '0.04em',
              touchAction: 'manipulation',
            }}
          >
            VEDI {filteredCount} SPOT
          </button>
        </div>
      </div>
    </>
  );
}
