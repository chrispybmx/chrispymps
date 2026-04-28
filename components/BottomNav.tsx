'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface BottomNavProps {
  onAddSpot: () => void;
}

export default function BottomNav({ onAddSpot }: BottomNavProps) {
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);

  /* Carica l'username dal session token — stesso pattern di TopBar */
  useEffect(() => {
    import('@/lib/supabase-browser').then(({ supabaseBrowser }) => {
      supabaseBrowser().auth.getSession().then(({ data }) => {
        const un =
          data.session?.user?.user_metadata?.username ??
          data.session?.user?.email?.split('@')[0] ??
          null;
        setUsername(un);
      });
    }).catch(() => {});
  }, []);

  const isMap     = !!pathname?.startsWith('/map');
  const isProfile = !!pathname?.startsWith('/u/');

  return (
    <>
      <style>{`
        /* ── Mobile-only bottom nav ── */
        .mobile-bnav {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          height: calc(56px + env(safe-area-inset-bottom, 0px));
          padding-bottom: env(safe-area-inset-bottom, 0px);
          background: rgba(8,8,8,0.97);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: space-around;
          z-index: 45;
        }
        @media (min-width: 768px) {
          .mobile-bnav { display: none !important; }
        }
        .mbn-link {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          text-decoration: none;
          color: #555;
          font-family: var(--font-mono);
          font-size: 8px;
          letter-spacing: 0.06em;
          flex: 1;
          padding: 8px 0;
          transition: color 0.15s;
          -webkit-tap-highlight-color: transparent;
          border: none;
          background: none;
          cursor: pointer;
        }
        .mbn-link.active { color: var(--orange); }
        .mbn-add-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          gap: 3px;
        }
        .mbn-add {
          width: 44px;
          height: 44px;
          background: var(--orange);
          border-radius: 12px;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.1s, opacity 0.1s;
          -webkit-tap-highlight-color: transparent;
        }
        .mbn-add:active { transform: scale(0.92); opacity: 0.85; }
        .mbn-add-lbl {
          font-family: var(--font-mono);
          font-size: 8px;
          color: var(--orange);
          letter-spacing: 0.06em;
        }
      `}</style>

      <nav className="mobile-bnav" aria-label="Navigazione principale">

        {/* HOME */}
        <Link href="/" className={`mbn-link${pathname === '/' ? ' active' : ''}`} aria-label="Home">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor">
            <path d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1H5a1 1 0 01-1-1V10.5z" strokeLinejoin="round"/>
            <path d="M9 22V13h6v9" />
          </svg>
          HOME
        </Link>

        {/* MAPPA */}
        <Link href="/map" className={`mbn-link${isMap ? ' active' : ''}`} aria-label="Mappa">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" strokeLinejoin="round"/>
            <circle cx="12" cy="9" r="2.5" fill="currentColor" stroke="none"/>
          </svg>
          MAPPA
        </Link>

        {/* + SPOT — bottone centrale prominente */}
        <div className="mbn-add-wrap">
          <button className="mbn-add" onClick={onAddSpot} aria-label="Aggiungi spot">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="#000" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>
          <span className="mbn-add-lbl">SPOT</span>
        </div>

        {/* CERCA */}
        <Link href="/map" className="mbn-link" aria-label="Cerca">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor">
            <circle cx="11" cy="11" r="7"/>
            <path d="M16.5 16.5L21 21" strokeLinecap="round"/>
          </svg>
          CERCA
        </Link>

        {/* PROFILO */}
        {username ? (
          <Link href={`/u/${username}`} className={`mbn-link${isProfile ? ' active' : ''}`} aria-label="Profilo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round"/>
            </svg>
            PROFILO
          </Link>
        ) : (
          <Link href="/map" className="mbn-link" aria-label="Accedi">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round"/>
            </svg>
            PROFILO
          </Link>
        )}
      </nav>
    </>
  );
}
