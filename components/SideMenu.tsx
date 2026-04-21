'use client';

import { useEffect } from 'react';
import { LINKS, APP_CONFIG } from '@/lib/constants';

interface SideMenuProps {
  open:    boolean;
  onClose: () => void;
}

const MENU_ITEMS = [
  { href: '/map',          label: 'Mappa',           emoji: '🗺️' },
  { href: '/map/support',  label: 'Supporta il prog', emoji: '☕' },
  { href: '/map/about',    label: 'Chi siamo',        emoji: '🏴' },
  { href: LINKS.instagram, label: '@chrispy_bmx',     emoji: '📸', external: true },
  { href: LINKS.youtube,   label: 'YouTube',          emoji: '▶️', external: true },
];

export default function SideMenu({ open, onClose }: SideMenuProps) {
  // Blocca scroll body quando il menu è aperto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Chiudi con ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 59,
            backdropFilter: 'blur(2px)',
          }}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <nav
        role="dialog"
        aria-modal="true"
        aria-label="Menu principale"
        style={{
          position: 'fixed',
          top: 0, left: 0, bottom: 0,
          width: 280,
          background: 'var(--gray-800)',
          borderRight: '1px solid var(--gray-700)',
          zIndex: 60,
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--gray-700)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--orange)' }}>
              {APP_CONFIG.siteName}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)' }}>
              {APP_CONFIG.tagline.toUpperCase()}
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost"
            aria-label="Chiudi menu"
            style={{ fontSize: 20 }}
          >
            ✕
          </button>
        </div>

        {/* Voci menu */}
        <ul style={{ listStyle: 'none', flex: 1, padding: '8px 0' }}>
          {MENU_ITEMS.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                onClick={item.external ? undefined : onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 20px',
                  color: 'var(--bone)',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 18,
                  letterSpacing: '0.03em',
                  transition: 'background 0.1s, color 0.1s',
                  borderLeft: '3px solid transparent',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--gray-700)';
                  (e.currentTarget as HTMLElement).style.borderLeftColor = 'var(--orange)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--orange)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = '';
                  (e.currentTarget as HTMLElement).style.borderLeftColor = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'var(--bone)';
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 20, minWidth: 28 }}>{item.emoji}</span>
                <span>{item.label}</span>
                {item.external && (
                  <span style={{ marginLeft: 'auto', color: 'var(--gray-400)', fontSize: 13 }}>↗</span>
                )}
              </a>
            </li>
          ))}
        </ul>

        {/* Footer menu */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--gray-700)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--gray-400)',
          lineHeight: 1.6,
        }}>
          <div>ChrispyMPS v1.0 — BETA</div>
          <div>Community BMX Italia</div>
          <div style={{ marginTop: 8 }}>
            <a href="/map/about" style={{ color: 'var(--orange)', textDecoration: 'none' }}>
              Privacy & Contatti
            </a>
          </div>
        </div>
      </nav>
    </>
  );
}
