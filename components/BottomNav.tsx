'use client';

import Link from 'next/link';
import MapIcon from '@/components/MapIcon';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { useLanguage } from '@/components/LanguageProvider';

interface BottomNavProps {
  /** Callback per aprire il modal aggiungi spot — opzionale.
   *  Se non fornito, il + naviga su /map?add=1 */
  onAddSpot?: () => void;
  /** Callback per aprire il modal auth (quando utente non loggato tappa profilo) */
  onOpenAuth?: () => void;
}

export default function BottomNav({ onAddSpot, onOpenAuth }: BottomNavProps) {
  const { text } = useLanguage();
  const pathname = usePathname();
  const router   = useRouter();
  const user     = useUser(); // undefined=loading, null=guest, UserSession=logged

  const handleAdd = () => {
    if (onAddSpot) onAddSpot();
    else router.push('/map?add=1');
  };

  const isMap       = (pathname === '/' || !!pathname?.startsWith('/map'));
  const isSaved     = !!pathname?.startsWith('/preferiti');
  const isScopri    = !!pathname?.startsWith('/scopri') || !!pathname?.startsWith('/sfoglia');
  const isProfile   = !!pathname?.startsWith('/u/');

  return (
    <>
      <style>{`
        .mobile-bnav {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          height: calc(60px + env(safe-area-inset-bottom, 0px));
          padding-bottom: env(safe-area-inset-bottom, 0px);
          background: var(--black);

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
          color: var(--gray-400);
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0;
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
          gap: 0;
        }
        .mbn-add {
          width: 48px;
          height: 44px;
          background: var(--orange);
          border-radius: 3px;
          border: 1px solid #ad4200;
          border-bottom-width: 3px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.12s, opacity 0.12s;
          -webkit-tap-highlight-color: transparent;
          box-shadow: none;
          margin-top: 0;
        }
        .mbn-add:active { transform: translateY(2px); }
        .mbn-add-lbl {
          font-family: var(--font-mono);
          font-size: 11px;
          white-space: nowrap;
          line-height: 14px;
          color: var(--orange);
          letter-spacing: 0;
        }
      `}</style>

      <nav className="mobile-bnav" aria-label={text('Navigazione principale', 'Main navigation')}>

        {/* MAPPA */}
        <Link href="/map" className={`mbn-link${isMap ? ' active' : ''}`} aria-current={isMap ? 'page' : undefined} aria-label={text('Mappa', 'Map')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="1.6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/>
            <path d="M8 2v16M16 6v16"/>
          </svg>
          {text('Mappa', 'Map')}
        </Link>

        {/* SALVATI */}
        <Link href="/preferiti" className={`mbn-link${isSaved ? ' active' : ''}`} aria-current={isSaved ? 'page' : undefined} aria-label={text('Spot salvati', 'Saved spots')}>
          <MapIcon name="heart" size={24} filled={isSaved} />
          {text('Salvati', 'Saved')}
        </Link>

        {/* + SPOT — CTA centrale */}
        <div className="mbn-add-wrap">
          <button className="mbn-add cm-add-spot" onClick={handleAdd} aria-label={text('Aggiungi spot', 'Add spot')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="#000" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>
          <span className="mbn-add-lbl">{text('Aggiungi spot', 'Add spot')}</span>
        </div>

        {/* SCOPRI */}
        <Link href="/scopri" className={`mbn-link${isScopri ? ' active' : ''}`} aria-current={isScopri ? 'page' : undefined} aria-label={text('Scopri spot', 'Discover spots')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="1.6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M14.5 8.5L16 8l-.5 1.5-5 5L9 15l.5-1.5 5-5z"/>
            <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>
          </svg>
          {text('Scopri', 'Discover')}
        </Link>

        {/* PROFILO — button per gestire il caricamento asincrono della sessione */}
        <button
          className={`mbn-link${isProfile ? ' active' : ''}`}
          aria-label={text('Profilo', 'Profile')}
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
          {user === undefined ? '···' : text('Profilo', 'Profile')}
        </button>

      </nav>
    </>
  );
}
