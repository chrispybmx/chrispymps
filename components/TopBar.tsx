'use client';

import { trackMetric } from '@/lib/product-metrics';
import { useState, useCallback, useRef, useEffect } from 'react';
import { TIPI_SPOT, OSTACOLI, CITTA_ITALIANE, CITTA_COORDS, REGIONI_ITALIA, CONDIZIONI, DIFFICOLTA, APP_CONFIG, DEBOUNCE_SEARCH_MS } from '@/lib/constants';
import type { Ostacolo, SpotType, SpotCondition, SpotMapPin } from '@/lib/types';
import { geocodeForward, type GeoPlace } from '@/lib/geocoding';
import { useUser } from '@/hooks/useUser';
import SideMenu from './SideMenu';
import NotificationBell from './NotificationBell';
import Link from 'next/link';
import MapIcon from './MapIcon';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import { useLanguage } from '@/components/LanguageProvider';

interface MapProximityControls {
  activeRadius: number | null;
  hasLocation: boolean;
  isLocating: boolean;
  onRadiusChange: (km: number | null) => void;
  onLocate: () => void;
}

interface TopBarProps {
  proximity?: MapProximityControls;
  onSearch:          (query: string) => void;
  onFilterType:      (type: SpotType | null) => void;
  onFilterRegion:    (region: string | null) => void;
  onFilterCondition: (condition: SpotCondition | null) => void;
  onFilterDifficulty:(difficulty: string | null) => void;
  /** «Dove trovo un rail» e' la domanda vera del rider. Fino a ora il sito non
   *  poteva rispondere: l'informazione non era registrata da nessuna parte. */
  onFilterOstacolo:  (o: Ostacolo | null) => void;
  onAddSpot:         () => void;
  activeSearch?: string;
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
  activeSearch = '', activeType, activeRegion, activeCondition, activeDifficulty, activeOstacolo,
  spots, filteredCount, onCitySelect, onSpotSelect, onOpenAuth, proximity,
}: TopBarProps) {
  const { text } = useLanguage();
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
  interface ApiUser { username: string; bio?: string | null; spotCount: number }
  const [apiUsers,       setApiUsers]       = useState<ApiUser[]>([]);
  const [usersLoading,   setUsersLoading]   = useState(false);

  useEffect(() => {
    let active = true;
    const term = query.trim();
    const isUser = term.startsWith('@');
    setPlaces([]); setApiUsers([]);
    if (!searchOpen || term.length < 2) { setPlacesLoading(false); setUsersLoading(false); return; }
    setPlacesLoading(!isUser); setUsersLoading(true);
    const controller = new AbortController();
    const t = setTimeout(() => {
      if (!isUser) geocodeForward(term, { limit: 5 })
        .then(data => { if (active) setPlaces(data); })
        .catch(() => { if (active) setPlaces([]); })
        .finally(() => { if (active) setPlacesLoading(false); });
      fetch(`/api/users?q=${encodeURIComponent(term.replace(/^@/, ''))}`, { signal: controller.signal })
        .then(res => res.json()).then(j => { if (active && j.ok) setApiUsers(j.data ?? []); })
        .catch(() => { if (active) setApiUsers([]); })
        .finally(() => { if (active) setUsersLoading(false); });
    }, DEBOUNCE_SEARCH_MS);
    return () => { active = false; clearTimeout(t); controller.abort(); };
  }, [query, searchOpen]);

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
      .filter(d => `${d.label} ${difficultyLabel(d.value, text)}`.toLowerCase().includes(needle))
      .map(d => ({ kind: 'difficulty' as const, value: d.value, label: difficultyLabel(d.value, text), emoji: '⚡', color: '#ffce4d' })),
  ] : [];

  /* ── Spot locali che matchano per nome ── */
  const spotMatches = q.length >= 1 && !isAtSearch
    ? spots.filter(s => [s.name, s.city, s.region, s.country, s.country_code].some(value => value?.toLowerCase().includes(q))).slice(0, 5)
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

  const anyFilter = !!(activeType || activeRegion || activeCondition || activeDifficulty || activeOstacolo || proximity?.activeRadius);

  const openSearch = () => {
    setQuery(activeSearch);
    setSearchOpen(true);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery('');
    setPlaces([]);
  }, []);

  const pickCity = (cityValue: string) => {
    const citySpots = spots.filter(s => s.city?.toLowerCase() === cityValue.toLowerCase());
    const coords = CITTA_COORDS[cityValue.toLowerCase()] ?? (citySpots.length ? [citySpots.reduce((sum, s) => sum + s.lat, 0) / citySpots.length, citySpots.reduce((sum, s) => sum + s.lon, 0) / citySpots.length] : null);
    if (coords) {
    trackMetric('search_used', 'map');
      onCitySelect(cityValue, coords[0], coords[1]);
      setSearchOpen(false);
      setQuery('');
    }
  };

  const pickPlace = (p: GeoPlace) => {
    trackMetric('search_used', 'map');
    onCitySelect(p.name, p.lat, p.lon);
    setQuery('');
    setSearchOpen(false);
  };

  const pickSpot = (pin: SpotMapPin) => {
    setSearchOpen(false);
    setQuery(pin.name);
    trackMetric('search_used', 'map');
    onSpotSelect(pin);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && searchOpen) closeSearch(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen, closeSearch]);

  const searchPanelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(searchOpen, searchPanelRef, closeSearch);
  const hasResults = placesLoading || places.length > 0 || spotMatches.length > 0 || userMatches.length > 0 || tagMatches.length > 0 || usersLoading;

  const pickTag = (tag: TagMatch) => {
    if (tag.kind === 'type')       { onFilterType(tag.value as SpotType); }
    if (tag.kind === 'difficulty') { onFilterDifficulty(tag.value); }
    onSearch('');
    closeSearch();
  };

  return (
    <>
      <header className="topbar cm-topbar">
        <button onClick={() => setMenuOpen(true)} className="cm-icon-button" aria-label={text('Apri menu', 'Open menu')}><MapIcon name="menu" /></button>
        <a href="/" className="cm-wordmark" aria-label="Chrispy Maps"><strong>Chrispy</strong><span>Maps</span></a>
        <span className="cm-brand-context">BMX / Skate / Scooter</span>
        <button onClick={openSearch} className="cm-search-trigger" aria-label={text('Cerca città o spot', 'Search cities or spots')}><MapIcon name="search" /><span>{activeSearch || text('Cerca città o spot', 'Search cities or spots')}</span></button>
        <button onClick={() => setFilterSheetOpen(true)} className="cm-filter-trigger" aria-pressed={anyFilter}><MapIcon name="filter" /><span>{text('Filtri', 'Filters')}{anyFilter ? ` · ${[activeType, activeRegion, activeCondition, activeDifficulty, activeOstacolo, proximity?.activeRadius].filter(Boolean).length}` : ''}</span></button>
        <div className="topbar-mobile-actions">{sessionToken && <NotificationBell token={sessionToken} />}</div>
        <button onClick={onAddSpot} className="btn-primary topbar-add-btn cm-add-spot"><MapIcon name="plus" />{text('Aggiungi spot', 'Add spot')}</button>
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

        <div className="cm-quick-filters" aria-label={text('Categorie spot', 'Spot categories')}>
          <button onClick={() => { onSearch(''); onFilterType(null); onFilterRegion(null); onFilterCondition(null); onFilterDifficulty(null); onFilterOstacolo(null); proximity?.onRadiusChange(null); }} aria-pressed={!anyFilter && !activeSearch}>{text('Tutti gli spot', 'All spots')}</button>
          {(['street','park','rail','ledge','bowl','pumptrack'] as SpotType[]).map(type => <button key={type} onClick={() => handleTypeToggle(type)} aria-pressed={activeType === type}><MapIcon name={type} size={18} />{TIPI_SPOT[type].label}</button>)}
        </div>
        {/* Bottone FILTRI */}
        <button
          onClick={() => setFilterSheetOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            fontFamily: 'var(--font-mono)', fontSize: 14,
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
            boxShadow: 'none',
          } as React.CSSProperties}
          className="cm-secondary-filter" aria-label={text('Apri filtri', 'Open filters')}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          {text('FILTRI', 'FILTERS')}
          {anyFilter && (
            <span style={{
              background: '#000', color: 'var(--orange)',
              borderRadius: '50%', width: 17, height: 17,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, lineHeight: 1, flexShrink: 0,
            }}>
              {[activeType, activeRegion, activeCondition, activeDifficulty, activeOstacolo, proximity?.activeRadius].filter(Boolean).length}
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
              <ActiveChip label={TIPI_SPOT[activeType].label} onRemove={() => onFilterType(null)} />
            )}
            {activeOstacolo && <ActiveChip label={obstacleLabel(activeOstacolo, text)} onRemove={() => onFilterOstacolo(null)} />}
            {activeRegion && (
              <ActiveChip label={activeRegion} onRemove={() => onFilterRegion(null)} />
            )}
            {activeCondition && (
              <ActiveChip label={conditionLabel(activeCondition, text)} onRemove={() => onFilterCondition(null)} />
            )}
            {activeDifficulty && (
              <ActiveChip label={difficultyLabel(activeDifficulty, text)} onRemove={() => onFilterDifficulty(null)} />
            )}
          </div>
        )}

        {/* Reset tutto */}
        {anyFilter && (
          <button
            onClick={() => { onFilterType(null); onFilterRegion(null); onFilterCondition(null); onFilterDifficulty(null); onFilterOstacolo(null); proximity?.onRadiusChange(null); }}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 14,
              padding: '0 10px', height: 36,
              border: 'none',
              borderRadius: 8, background: 'rgba(255,255,255,0.07)',
              color: 'var(--gray-400)', cursor: 'pointer',
              whiteSpace: 'nowrap', flexShrink: 0,
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            } as React.CSSProperties}
            aria-label={text('Azzera filtri', 'Clear filters')}
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
              fontFamily: 'var(--font-mono)', fontSize: 14,
              padding: '5px 10px', border: '1px solid var(--gray-600)',
              borderRadius: 2, background: 'transparent',
              color: 'var(--bone)', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 5,
              minHeight: 44, touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            } as React.CSSProperties} aria-label={text('Il tuo profilo', 'Your profile')}><MapIcon name="user" /></Link>
          ) : (
            <button onClick={onOpenAuth} style={{
              fontFamily: 'var(--font-mono)', fontSize: 14,
              padding: '5px 10px', border: '1px solid var(--gray-600)',
              borderRadius: 2, background: 'transparent',
              color: 'var(--gray-500)', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              minHeight: 44, touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            } as React.CSSProperties} aria-label={text('Accedi al profilo', 'Sign in to your profile')}><MapIcon name="user" /></button>
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
          proximity={proximity}
        />
      )}

      {/* Search panel */}
      {searchOpen && (
        <div
          ref={searchPanelRef} className="cm-search-panel" role="dialog" aria-modal="true" aria-label={text('Cerca città o spot', 'Search cities or spots')}
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
            <MapIcon name="search" />
            <input
              ref={inputRef}
              type="text"
              placeholder={text('Cerca città o spot', 'Search cities or spots')} aria-label={text('Cerca città o spot', 'Search cities or spots')}
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
            {(query || activeSearch) && <button className="cm-text-button" onClick={() => { setQuery(''); onSearch(''); inputRef.current?.focus(); }} aria-label={text('Cancella ricerca', 'Clear search')}>{text('Cancella', 'Clear')}</button>}
            {placesLoading && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)' }}>...</span>
            )}
            <button onClick={closeSearch} style={{
              background: 'none', border: 'none', color: 'var(--gray-400)',
              fontSize: 22, cursor: 'pointer', padding: '0 4px', flexShrink: 0,
            }} aria-label={text('Chiudi', 'Close')}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>

            {/* ── Risultati con query ── */}
            {query.trim().length >= 1 && (
              <>
                {/* Tag: tipo spot + livello — filtri rapidi */}
                {tagMatches.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <SectionLabel>{text('Filtri rapidi', 'Quick filters')}</SectionLabel>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {tagMatches.map(tag => (
                        <button
                          key={tag.kind + tag.value}
                          onClick={() => pickTag(tag)}
                          style={{
                            fontFamily: 'var(--font-mono)', fontSize: 14,
                            padding: '8px 14px',
                            border: `1px solid ${tag.color}55`,
                            borderRadius: 6,
                            background: `${tag.color}15`,
                            color: 'var(--bone)',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 7,
                            touchAction: 'manipulation',
                            transition: 'background 0.15s',
                          }}
                        >
                          <MapIcon name={tag.kind === 'type' ? tag.value : 'filter'} size={18} />
                          <span>{tag.label}</span>
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: 14,
                            color: tag.color, letterSpacing: '0.05em',
                          }}>
                            {tag.kind === 'type' ? `${spots.filter(s => s.type === tag.value).length} spot` : ''}
                          </span>
                          <span style={{ color: tag.color, fontSize: 14 }}>→</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Spot nel database */}
                {spotMatches.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <SectionLabel>{text('Spot', 'Spots')}</SectionLabel>
                    {spotMatches.map(pin => (
                      <SpotRow key={pin.id} pin={pin} onPick={() => pickSpot(pin)} />
                    ))}
                  </div>
                )}

                {/* Luoghi via Nominatim */}
                {places.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <SectionLabel>{text('Luoghi', 'Places')}</SectionLabel>
                    {places.map((p, i) => (
                      <PlaceRow key={i} place={p} onPick={() => pickPlace(p)} />
                    ))}
                  </div>
                )}

                {/* Utenti */}
                {(userMatches.length > 0 || usersLoading) && (
                  <div style={{ marginBottom: 16 }}>
                    <SectionLabel>{text('Rider', 'Riders')}{usersLoading ? ' …' : ''}</SectionLabel>
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
                          fontFamily: 'var(--font-mono)', fontSize: 14, color: '#000', flexShrink: 0,
                        }}>
                          {u.username[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--bone)' }}>
                            @{u.username}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)' }}>
                            {u.spotCount === 0 ? text('nessuno spot', 'no spots yet') : text(`${u.spotCount} spot pubblicati`, `${u.spotCount} published spots`)}
                            {u.bio ? ` · ${u.bio.slice(0, 40)}` : ''}
                          </div>
                        </div>
                        <span style={{ color: 'var(--orange)', fontSize: 16, flexShrink: 0 }}>→</span>
                      </a>
                    ))}
                  </div>
                )}

                {/* Nessun risultato */}
                {!hasResults && !placesLoading && (
                  <div style={{
                    color: 'var(--gray-400)', fontFamily: 'var(--font-mono)',
                    fontSize: 14, padding: '24px 0', textAlign: 'center',
                  }}>
                    {text('Nessun risultato per', 'No results for')} &quot;{query}&quot;
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
                    <SectionLabel>{text('Città con spot', 'Cities with spots')}</SectionLabel>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {topCities.map(([city, count]) => {
                        const cityLabel = CITTA_ITALIANE.find(c => c.value === city)?.label ?? city;
                        const hasCoords = true;
                        return (
                          <button key={city} onClick={() => pickCity(city)} disabled={!hasCoords} style={{
                            fontFamily: 'var(--font-mono)', fontSize: 14,
                            padding: '7px 13px',
                            border: '1px solid rgba(255,106,0,0.5)',
                            borderRadius: 6,
                            background: 'rgba(255,106,0,0.08)',
                            color: 'var(--bone)',
                            cursor: hasCoords ? 'pointer' : 'default',
                            display: 'flex', alignItems: 'center', gap: 6,
                          }}>
                            {cityLabel}
                            <span style={{
                              background: 'var(--orange)', color: '#000',
                              borderRadius: 10, padding: '1px 6px',
                              fontSize: 14, fontWeight: 700, lineHeight: 1.5,
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
                  <span style={{ fontSize: 24, flexShrink: 0 }}><MapIcon name="layers" size={24} /></span>
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 14,
                      color: 'var(--bone)', marginBottom: 4,
                    }}>
                      {text('Cerca qualsiasi luogo', 'Search anywhere')}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 14,
                      color: 'var(--gray-400)', lineHeight: 1.6,
                    }}>
                      {text('Digita il nome di uno spot, città o utente.', 'Type a spot name, city or rider.')}<br />
                      <span style={{ color: 'var(--gray-500)' }}>
                        {text('Tipi', 'Categories')}: &quot;rail&quot;, &quot;park&quot;, &quot;street&quot;, &quot;gap&quot;...<br />
                        {text('Livelli', 'Levels')}: &quot;beginner&quot;, &quot;pro&quot;...<br />
                        {text('Utenti', 'Riders')}: &quot;@chrispy&quot; {text('o solo', 'or just')} &quot;chrispy&quot;
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
      <span style={{ fontSize: 20, flexShrink: 0 }}><MapIcon name="pin" /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--bone)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {place.name}
        </div>
        {place.displayExtra && (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)',
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
      <span style={{ fontSize: 22, flexShrink: 0 }}><MapIcon name={pin.type} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--bone)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {pin.name}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)', marginTop: 1,
        }}>
          {[pin.city, pin.country, tipo.label].filter(Boolean).join(' · ')}
        </div>
      </div>
      <span style={{ color: 'var(--gray-400)', fontSize: 16, flexShrink: 0 }}><MapIcon name="pin" /></span>
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
          fontFamily: 'var(--font-mono)', fontSize: 14,
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
      fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--orange)',
      textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

/* ── Chip filtro attivo nella filter bar ── */
function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { text } = useLanguage();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      fontFamily: 'var(--font-mono)', fontSize: 14,
      padding: '4px 8px 4px 10px',
      background: 'rgba(255,106,0,0.15)',
      border: '1px solid rgba(255,106,0,0.4)',
      borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0,
      color: 'var(--orange)',
    }}>
      {label}
      <button
        onClick={onRemove}
        style={{
          background: 'none', border: 'none', color: 'var(--orange)',
          cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0,
          display: 'flex', alignItems: 'center',
          touchAction: 'manipulation',
        }}
        aria-label={text(`Rimuovi filtro ${label}`, `Remove ${label} filter`)}
      >✕</button>
    </div>
  );
}

/* ── Filter Sheet (slide-up) ── */
function FilterSheet({
  activeType, activeRegion, activeCondition, activeDifficulty, activeOstacolo,
  onFilterType, onFilterRegion, onFilterCondition, onFilterDifficulty, onFilterOstacolo,
  onClose, filteredCount, proximity,
}: {
  proximity?: MapProximityControls;
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
  const { text } = useLanguage();
  const filterRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, filterRef, onClose);
  const hasFilters = !!(activeType || activeRegion || activeCondition || activeDifficulty || activeOstacolo || proximity?.activeRadius);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 79, backdropFilter: 'none' }}
      />
      {/* Sheet */}
      <div ref={filterRef} className="cm-filter-sheet" role="dialog" aria-label={text('Filtra gli spot', 'Filter spots')} aria-modal="true" style={{
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
            {text('Filtra gli spot', 'Filter spots')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {hasFilters && (
              <button
                onClick={() => { onFilterType(null); onFilterRegion(null); onFilterCondition(null); onFilterDifficulty(null); onFilterOstacolo(null); proximity?.onRadiusChange(null); }}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 14,
                  padding: '6px 12px', border: '1px solid var(--gray-600)',
                  borderRadius: 4, background: 'transparent',
                  color: 'var(--gray-400)', cursor: 'pointer',
                  touchAction: 'manipulation',
                }}
              >
                {text('RESET', 'RESET')}
              </button>
            )}
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: 'var(--gray-400)',
              fontSize: 22, cursor: 'pointer', padding: '0 4px',
            }} aria-label={text('Chiudi', 'Close')}>✕</button>
          </div>
        </div>

        <div style={{ padding: '20px' }}>

          {/* TIPO */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              {text('Tipo spot', 'Spot category')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(Object.entries(TIPI_SPOT) as [SpotType, { label: string; emoji: string; color: string }][]).map(([key, info]) => (
                <button
                  key={key}
                  aria-pressed={activeType === key}
                  onClick={() => onFilterType(activeType === key ? null : key)}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 14,
                    padding: '8px 14px',
                    border: `1px solid ${activeType === key ? info.color : 'var(--gray-600)'}`,
                    borderRadius: 6,
                    background: activeType === key ? `${info.color}22` : 'transparent',
                    color: activeType === key ? info.color : 'var(--gray-400)',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', gap: 6,
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'all 0.15s',
                  } as React.CSSProperties}
                >
                  <MapIcon name={key} />
                  <span>{info.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* COSA C'È — l'ostacolo, non il contesto */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              {text('Cosa c’è', 'Obstacles')}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(Object.entries(OSTACOLI) as [Ostacolo, typeof OSTACOLI[Ostacolo]][]).map(([o, info]) => (
                <button
                  key={o}
                  aria-pressed={activeOstacolo === o}
                  onClick={() => onFilterOstacolo(activeOstacolo === o ? null : o)}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 14,
                    padding: '7px 13px',
                    border: `1px solid ${activeOstacolo === o ? 'var(--orange)' : 'var(--gray-600)'}`,
                    borderRadius: 6,
                    background: activeOstacolo === o ? 'rgba(255,106,0,0.15)' : 'transparent',
                    color: activeOstacolo === o ? 'var(--orange)' : 'var(--gray-400)',
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'all 0.15s',
                  } as React.CSSProperties}
                >
                  <MapIcon name={o} /> {obstacleLabel(o, text)}
                </button>
              ))}
            </div>
          </div>

          {/* DIFFICOLTÀ */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              {text('Difficoltà', 'Difficulty')}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {DIFFICOLTA.map(d => (
                <button
                  key={d.value}
                  aria-pressed={activeDifficulty === d.value}
                  onClick={() => onFilterDifficulty(activeDifficulty === d.value ? null : d.value)}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 14,
                    padding: '8px 16px',
                    border: `1px solid ${activeDifficulty === d.value ? '#ffce4d' : 'var(--gray-600)'}`,
                    borderRadius: 6,
                    background: activeDifficulty === d.value ? 'rgba(255,206,77,0.15)' : 'transparent',
                    color: activeDifficulty === d.value ? '#ffce4d' : 'var(--gray-400)',
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'all 0.15s',
                  } as React.CSSProperties}
                >
                  {difficultyLabel(d.value, text)}
                </button>
              ))}
            </div>
          </div>

          {proximity && <div className="cm-radius-filter">
            <label htmlFor="cm-radius">{text('Distanza dalla tua posizione', 'Distance from your location')}</label>
            <select id="cm-radius" value={proximity.activeRadius ?? ''} onChange={e => proximity.onRadiusChange(e.target.value ? Number(e.target.value) : null)}>
              <option value="">{text('Nessun limite', 'No limit')}</option>
              {[10, 25, 50].map(km => <option key={km} value={km} disabled={!proximity.hasLocation}>{text(`Entro ${km} km`, `Within ${km} km`)}</option>)}
            </select>
            {proximity.hasLocation
              ? <p>{text('Facoltativo. Distanza in linea d’aria.', 'Optional. Straight-line distance.')}</p>
              : <button type="button" className="cm-text-button" disabled={proximity.isLocating} onClick={proximity.onLocate}>{proximity.isLocating ? text('Localizzazione…', 'Locating…') : text('Usa la mia posizione', 'Use my location')}</button>}
          </div>}

          {/* REGIONE */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              {text('Regione', 'Italian region')}
            </div>
            <div style={{ position: 'relative' }}>
              <select
                aria-label={text('Regione', 'Italian region')}
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
                <option value="">{text('Tutte le regioni', 'All Italian regions')}</option>
                {REGIONI_ITALIA.map(r => (
                  <option key={r.label} value={r.label}>{r.label}</option>
                ))}
              </select>
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--gray-400)', pointerEvents: 'none' }}>▾</span>
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
            {text(`Mostra ${filteredCount} spot`, `Show ${filteredCount} spots`)}
          </button>
        </div>
      </div>
    </>
  );
}

function difficultyLabel(value: string, text: (it: string, en: string) => string): string {
  return value === 'beginner' ? text('Principiante', 'Beginner') : value === 'intermediate' ? text('Intermedio', 'Intermediate') : value === 'pro' ? 'Pro' : value;
}
function obstacleLabel(value: Ostacolo, text: (it: string, en: string) => string): string {
  return text(OSTACOLI[value].label, value === 'stairs' ? 'Stairs' : value === 'curb' ? 'Curb' : OSTACOLI[value].label);
}
function conditionLabel(value: SpotCondition, text: (it: string, en: string) => string): string {
  return value === 'alive' ? text('Utilizzabile', 'Rideable') : value === 'bustato' ? text('Bustato', 'Access issues') : text('Demolito', 'Demolished');
}
