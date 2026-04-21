'use client';

import { useState, useCallback } from 'react';
import { TIPI_SPOT, APP_CONFIG } from '@/lib/constants';
import type { SpotType } from '@/lib/types';
import SideMenu from './SideMenu';

interface TopBarProps {
  onSearch:     (query: string) => void;
  onFilterType: (type: SpotType | null) => void;
  onAddSpot:    () => void;
  activeType:   SpotType | null;
}

export default function TopBar({ onSearch, onFilterType, onAddSpot, activeType }: TopBarProps) {
  const [menuOpen, setMenuOpen]     = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery]           = useState('');

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onSearch(val);
  }, [onSearch]);

  const handleTypeToggle = useCallback((type: SpotType) => {
    onFilterType(activeType === type ? null : type);
  }, [activeType, onFilterType]);

  return (
    <>
      {/* TopBar principale */}
      <header className="topbar" style={{ gap: 0 }}>
        {/* Logo */}
        <button
          onClick={() => setMenuOpen(true)}
          className="btn-ghost"
          aria-label="Apri menu"
          style={{ marginRight: 8, fontSize: 22 }}
        >
          ☰
        </button>

        <a
          href="/map"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 22,
            color: 'var(--orange)',
            textDecoration: 'none',
            letterSpacing: '0.05em',
            flex: 1,
          }}
        >
          {APP_CONFIG.siteName}
          <span style={{ color: 'var(--gray-400)', fontSize: 14, marginLeft: 6 }}>
            BETA
          </span>
        </a>

        {/* Search toggle */}
        <button
          onClick={() => setSearchOpen((o) => !o)}
          className="btn-ghost"
          aria-label="Cerca città o spot"
          style={{ fontSize: 18 }}
        >
          🔍
        </button>

        {/* Aggiungi spot */}
        <button
          onClick={onAddSpot}
          className="btn-primary"
          style={{ marginLeft: 8, padding: '8px 14px', fontSize: 14 }}
          aria-label="Aggiungi spot"
        >
          + SPOT
        </button>
      </header>

      {/* Search bar espandibile */}
      {searchOpen && (
        <div
          style={{
            position: 'fixed',
            top: 'var(--topbar-height)',
            left: 0, right: 0,
            background: 'rgba(10,10,10,0.96)',
            borderBottom: '1px solid var(--gray-700)',
            padding: '12px 16px',
            zIndex: 39,
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <input
            type="search"
            className="input-vhs"
            placeholder="Cerca città, quartiere, nome spot..."
            value={query}
            onChange={handleSearch}
            autoFocus
            aria-label="Cerca spot"
          />
        </div>
      )}

      {/* Filtri tipo spot — scrollabile orizzontalmente */}
      <div
        style={{
          position: 'fixed',
          top: searchOpen
            ? 'calc(var(--topbar-height) + 68px)'
            : 'var(--topbar-height)',
          left: 0, right: 0,
          background: 'rgba(10,10,10,0.9)',
          borderBottom: '1px solid var(--gray-700)',
          zIndex: 38,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '8px 16px',
          display: 'flex',
          gap: 8,
          transition: 'top 0.15s ease-out',
        }}
        style2={{ scrollbarWidth: 'none' } as React.CSSProperties}
      >
        {/* Pulsante "Tutti" */}
        <button
          onClick={() => onFilterType(null)}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            padding: '4px 12px',
            border: `1px solid ${activeType === null ? 'var(--orange)' : 'var(--gray-600)'}`,
            borderRadius: 2,
            background: activeType === null ? 'var(--orange)' : 'transparent',
            color: activeType === null ? 'var(--black)' : 'var(--bone)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            transition: 'all 0.15s',
          }}
        >
          TUTTI
        </button>

        {(Object.entries(TIPI_SPOT) as [SpotType, typeof TIPI_SPOT[SpotType]][]).map(([type, info]) => {
          const active = activeType === type;
          return (
            <button
              key={type}
              onClick={() => handleTypeToggle(type)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                padding: '4px 12px',
                border: `1px solid ${active ? info.color : 'var(--gray-600)'}`,
                borderRadius: 2,
                background: active ? info.color : 'transparent',
                color: active ? 'var(--black)' : 'var(--bone)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                transition: 'all 0.15s',
              }}
            >
              {info.emoji} {info.label.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Side Menu drawer */}
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
