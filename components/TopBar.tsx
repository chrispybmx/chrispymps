'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { TIPI_SPOT, CITTA_ITALIANE, CITTA_COORDS, APP_CONFIG } from '@/lib/constants';
import type { SpotType, SpotMapPin } from '@/lib/types';
import SideMenu from './SideMenu';

interface TopBarProps {
  onSearch:     (query: string) => void;
  onFilterType: (type: SpotType | null) => void;
  onAddSpot:    () => void;
  activeType:   SpotType | null;
  spots:        SpotMapPin[];
  onCitySelect: (city: string, lat: number, lon: number) => void;
  onSpotSelect: (pin: SpotMapPin) => void;
}

export default function TopBar({
  onSearch, onFilterType, onAddSpot, activeType,
  spots, onCitySelect, onSpotSelect,
}: TopBarProps) {
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query,      setQuery]      = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Città con spot count
  const cityCount: Record<string, number> = {};
  spots.forEach(s => { if (s.city) cityCount[s.city] = (cityCount[s.city] ?? 0) + 1; });
  const topCities = Object.entries(cityCount).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Suggerimenti live
  const suggestions = query.trim().length >= 1 ? getSuggestions(query, spots, cityCount) : [];

  const handleSearch = useCallback((val: string) => {
    setQuery(val);
    onSearch(val);
  }, [onSearch]);

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
  };

  const pickCity = (cityValue: string) => {
    const coords = CITTA_COORDS[cityValue];
    if (coords) {
      onCitySelect(cityValue, coords[0], coords[1]);
      handleSearch(cityValue);
      setSearchOpen(false);
    }
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

      {/* Filter chips */}
      <div
        style={{
          position: 'fixed',
          top: 'var(--topbar-height)',
          left: 0, right: 0,
          background: 'rgba(10,10,10,0.92)',
          borderBottom: '1px solid var(--gray-700)',
          zIndex: 38,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '8px 16px',
          display: 'flex', gap: 8,
        }}
        ref={(el) => { if (el) el.style.setProperty('scrollbar-width', 'none'); }}
      >
        <FilterChip label="TUTTI" active={activeType === null} color="var(--orange)" onClick={() => onFilterType(null)} />
        {(Object.entries(TIPI_SPOT) as [SpotType, typeof TIPI_SPOT[SpotType]][]).map(([type, info]) => (
          <FilterChip
            key={type}
            label={`${info.emoji} ${info.label.toUpperCase()}`}
            active={activeType === type}
            color={info.color}
            onClick={() => handleTypeToggle(type)}
            count={spots.filter(s => s.type === type).length}
          />
        ))}
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
              placeholder="Città, nome spot, zona..."
              value={query}
              onChange={e => handleSearch(e.target.value)}
              style={{
                flex: 1, border: 'none', background: 'transparent',
                fontSize: 18, padding: '4px 0', outline: 'none',
                color: 'var(--bone)', fontFamily: 'var(--font-mono)',
              }}
              autoComplete="off"
              spellCheck={false}
            />
            <button onClick={closeSearch} style={{
              background: 'none', border: 'none', color: 'var(--gray-400)',
              fontSize: 22, cursor: 'pointer', padding: '0 4px', flexShrink: 0,
            }} aria-label="Chiudi">✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

            {/* Risultati live */}
            {query.trim().length >= 1 && (
              suggestions.length === 0 ? (
                <div style={{ color: 'var(--gray-400)', fontFamily: 'var(--font-mono)', fontSize: 14, padding: '20px 0', textAlign: 'center' }}>
                  Nessun risultato per &quot;{query}&quot;
                </div>
              ) : (
                suggestions.map((s, i) => (
                  <SuggestionRow key={i} s={s} onPickCity={pickCity} onPickSpot={pickSpot} />
                ))
              )
            )}

            {/* Stato vuoto */}
            {query.trim().length === 0 && (
              <>
                {/* Città */}
                {topCities.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <SectionLabel>🏙️ Esplora per città</SectionLabel>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {topCities.map(([city, count]) => {
                        const cityLabel = CITTA_ITALIANE.find(c => c.value === city)?.label ?? city;
                        const hasCoords = !!CITTA_COORDS[city];
                        return (
                          <button key={city} onClick={() => pickCity(city)} disabled={!hasCoords} style={{
                            fontFamily: 'var(--font-mono)', fontSize: 14,
                            padding: '8px 14px',
                            border: '1px solid var(--gray-600)',
                            borderRadius: 4, background: 'var(--gray-700)',
                            color: 'var(--bone)',
                            cursor: hasCoords ? 'pointer' : 'default',
                            display: 'flex', alignItems: 'center', gap: 6,
                          }}>
                            {cityLabel}
                            <span style={{
                              background: 'var(--orange)', color: '#000',
                              borderRadius: 10, padding: '1px 6px',
                              fontSize: 11, fontWeight: 700,
                            }}>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tipi */}
                <div>
                  <SectionLabel>🎯 Filtra per tipo</SectionLabel>
                  {(Object.entries(TIPI_SPOT) as [SpotType, typeof TIPI_SPOT[SpotType]][]).map(([type, info]) => {
                    const cnt = spots.filter(s => s.type === type).length;
                    return (
                      <TypeRow
                        key={type}
                        info={info}
                        active={activeType === type}
                        count={cnt}
                        onClick={() => { onFilterType(activeType === type ? null : type); closeSearch(); }}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

/* ── Utility ── */

type Suggestion =
  | { kind: 'spot';  pin: SpotMapPin }
  | { kind: 'city';  value: string; label: string; count: number };

function getSuggestions(q: string, spots: SpotMapPin[], cityCount: Record<string, number>): Suggestion[] {
  const ql = q.toLowerCase();
  const results: Suggestion[] = [];
  spots.filter(s =>
    s.name.toLowerCase().includes(ql) || (s.city ?? '').toLowerCase().includes(ql)
  ).slice(0, 6).forEach(pin => results.push({ kind: 'spot', pin }));

  CITTA_ITALIANE
    .filter(c => c.label.toLowerCase().includes(ql) || c.value.toLowerCase().includes(ql))
    .slice(0, 3)
    .forEach(c => {
      if (!results.find(r => r.kind === 'city' && (r as { kind: 'city'; value: string }).value === c.value)) {
        results.push({ kind: 'city', value: c.value, label: c.label, count: cityCount[c.value] ?? 0 });
      }
    });
  return results;
}

function SuggestionRow({ s, onPickCity, onPickSpot }: {
  s: Suggestion; onPickCity: (v: string) => void; onPickSpot: (p: SpotMapPin) => void;
}) {
  const [hover, setHover] = useState(false);
  const bg = hover ? 'rgba(255,106,0,0.08)' : 'var(--gray-700)';

  if (s.kind === 'city') {
    return (
      <button onClick={() => onPickCity(s.value)}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', marginBottom: 4, background: bg, border: '1px solid var(--gray-600)', borderRadius: 6, cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontSize: 20 }}>🏙️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--bone)' }}>{s.label}</div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 1 }}>{s.count > 0 ? `${s.count} spot` : 'Nessuno spot ancora'}</div>
        </div>
        <span style={{ color: 'var(--orange)', fontSize: 18 }}>→</span>
      </button>
    );
  }
  const tipo = TIPI_SPOT[s.pin.type];
  return (
    <button onClick={() => onPickSpot(s.pin)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', marginBottom: 4, background: bg, border: '1px solid var(--gray-600)', borderRadius: 6, cursor: 'pointer', textAlign: 'left' }}>
      <span style={{ fontSize: 22 }}>{tipo.emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--bone)' }}>{s.pin.name}</div>
        <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 1 }}>{s.pin.city ? `${s.pin.city} · ` : ''}{tipo.label}</div>
      </div>
      <span style={{ color: 'var(--gray-400)', fontSize: 18 }}>📍</span>
    </button>
  );
}

function TypeRow({ info, active, count, onClick }: {
  info: typeof TIPI_SPOT[keyof typeof TIPI_SPOT]; active: boolean; count: number; onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        padding: '11px 14px', marginBottom: 4, borderRadius: 4, cursor: 'pointer', textAlign: 'left',
        background: active ? 'rgba(255,106,0,0.12)' : hover ? 'rgba(255,106,0,0.06)' : 'none',
        border: `1px solid ${active ? 'var(--orange)' : 'var(--gray-700)'}`,
        transition: 'all 0.12s',
      }}>
      <span style={{ fontSize: 24 }}>{info.emoji}</span>
      <div style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 15, color: active ? 'var(--orange)' : 'var(--bone)' }}>
        {info.label}
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: count > 0 ? 'var(--orange)' : 'var(--gray-400)' }}>
        {count > 0 ? `${count} spot` : '—'}
      </span>
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
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
      {children}
    </div>
  );
}
