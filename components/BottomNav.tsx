'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';

interface BottomNavProps {
  /** Callback per aprire il modal aggiungi spot — opzionale.
   *  Se non fornito, il + naviga su /map?add=1 */
  onAddSpot?: () => void;
  /** Callback per aprire il modal auth (quando utente non loggato tappa profilo) */
  onOpenAuth?: () => void;
}

export default function BottomNav({ onAddSpot, onOpenAuth }: BottomNavProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const user     = useUser(); // undefined=loading, null=guest, UserSession=logged

  const handleAdd = () => {
    if (onAddSpot) onAddSpot();
    else router.push('/map?add=1');
  };

  const isMap       = !!pathname?.startsWith('/map');
  const isClassifica= !!pathname?.startsWith('/classifica');
  const isScopri    = !!pathname?.startsWith('/scopri');
  const isProfile   = !!pathname?.startsWith('/u/');

  return (
    <>
      <style>{`
        .mobile-bnav {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          height: calc(60px + env(safe-area-inset-bottom, 0px));
          padding-bottom: env(safe-area-inset-bottom, 0px);
          background: rgba(8,8,8,0.97);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
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
          gap: 4px;
          text-decoration: none;
          color: #444;
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: 0.06em;
          flex: 1;
          padding: 8px 0 4px;
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
          gap: 4px;
        }
        .mbn-add {
          width: 50px;
          height: 50px;
          background: var(--orange);
          border-radius: 14px;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.12s, opacity 0.12s;
          -webkit-tap-highlight-color: transparent;
          box-shadow: 0 2px 16px rgba(255,106,0,0.35);
          margin-top: -8px;
        }
        .mbn-add:active { transform: scale(0.90); opacity: 0.85; }
        .mbn-add-lbl {
          font-family: var(--font-mono);
          font-size: 9px;
          color: var(--orange);
          letter-spacing: 0.06em;
        }
      `}</style>

      <nav className="mobile-bnav" aria-label="Navigazione principale">

        {/* MAPPA */}
        <Link href="/map" className={`mbn-link${isMap ? ' active' : ''}`} aria-label="Mappa">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="1.6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/>
            <path d="M8 2v16M16 6v16"/>
          </svg>
          MAPPA
        </Link>

        {/* CLASSIFICA */}
        <Link href="/classifica" className={`mbn-link${isClassifica ? ' active' : ''}`} aria-label="Classifica">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="1.6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2"  y="14" width="4" height="8" rx="1"/>
            <rect x="10" y="9"  width="4" height="13" rx="1"/>
            <rect x="18" y="4"  width="4" height="18" rx="1"/>
            <path d="M20 4l-3-3m0 0l-3 3m3-3v8"/>
          </svg>
          CLASSIFICA
        </Link>

        {/* + SPOT — CTA centrale */}
        <div className="mbn-add-wrap">
          <button className="mbn-add" onClick={handleAdd} aria-label="Aggiungi spot">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="#000" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>
          <span className="mbn-add-lbl">SPOT</span>
        </div>

        {/* SCOPRI */}
        <Link href="/scopri" className={`mbn-link${isScopri ? ' active' : ''}`} aria-label="Scopri spot">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="1.6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M14.5 8.5L16 8l-.5 1.5-5 5L9 15l.5-1.5 5-5z"/>
            <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>
          </svg>
          SCOPRI
        </Link>

        {/* PROFILO — button per gestire il caricamento asincrono della sessione */}
        <button
          className={`mbn-link${isProfile ? ' active' : ''}`}
          aria-label="Profilo"
          onClick={() => {
            if (user === undefined) return; // sessione ancora in caricamento, ignora il tap
            if (user) router.push(`/u/${user.username}`);
            else if (onOpenAuth) onOpenAuth(); // non loggato → apri auth modal
            else router.push('/map');
          }}
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="1.6" stroke="currentColor" strokeLinecap="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
          {user === undefined ? '···' : 'PROFILO'}
        </button>

      </nav>
    </>
  );
}
