'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import MapIcon from '@/components/MapIcon';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { useLanguage } from '@/components/LanguageProvider';
import { useRiderSessions } from '@/components/RiderSessions';
import { useDialogFocus } from '@/hooks/useDialogFocus';

interface BottomNavProps {
  /** Callback per aprire il modal aggiungi spot — opzionale.
   *  Se non fornito, il + naviga su /map?add=1 */
  onAddSpot?: () => void;
  onStartSession?: () => void;
  /** Callback per aprire il modal auth (quando utente non loggato tappa profilo) */
  onOpenAuth?: () => void;
}

export default function BottomNav({ onAddSpot, onStartSession, onOpenAuth }: BottomNavProps) {
  const { text } = useLanguage();
  const pathname = usePathname();
  const router   = useRouter();
  const user     = useUser(); // undefined=loading, null=guest, UserSession=logged
  const sessions=useRiderSessions();
  const [actionsOpen,setActionsOpen]=useState(false);
  const [interactive,setInteractive]=useState(false);
  const [animateSheet,setAnimateSheet]=useState(false);
  const actionsRef=useRef<HTMLDivElement>(null);
  const triggerRef=useRef<HTMLButtonElement>(null);
  const previousPath=useRef(pathname);
  useDialogFocus(actionsOpen,actionsRef,()=>setActionsOpen(false));
  useEffect(()=>{setInteractive(true);},[]);
  useEffect(()=>{if(previousPath.current!==pathname){previousPath.current=pathname;setActionsOpen(false);}},[pathname]);
  useEffect(()=>{
    if(!actionsOpen)return;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const desktop=window.matchMedia('(min-width:768px)');
    const resized=()=>{if(desktop.matches)setActionsOpen(false);};
    desktop.addEventListener('change',resized);
    return()=>{document.body.style.overflow=overflow;desktop.removeEventListener('change',resized);};
  },[actionsOpen]);

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
          font-size: .75rem;
          font-weight: 600;
          line-height: 1.25;
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
          gap: 3px;
          align-self: flex-end;
          padding-bottom: 8px;
          min-width: 0;
          position: relative;
        }
        .mobile-bnav .mbn-add {
          width: 68px;
          height: 68px;
          flex-shrink: 0;
          box-sizing: border-box;
          background: var(--orange);
          color: var(--black);
          border-radius: 50%;
          border: 4px solid var(--black);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.12s, opacity 0.12s;
          -webkit-tap-highlight-color: transparent;
          box-shadow: 0 5px 12px rgba(0,0,0,.28);
          margin-top: -20px;
        }
        .mobile-bnav .mbn-add:active { transform: translateY(2px); box-shadow: 0 2px 5px rgba(0,0,0,.2); }
        .mbn-sheet-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.48); z-index:79; }
        .mbn-actions {
          position:fixed; bottom:0; left:0; right:0; z-index:80;
          max-height:calc(100dvh - 32px); overflow-y:auto; box-sizing:border-box;
          padding:12px 20px calc(20px + env(safe-area-inset-bottom,0px));
          background:var(--black); color:var(--bone); border-top:1px solid var(--gray-600);
          border-radius:8px 8px 0 0; transform:translateY(0);
        }
        .mbn-actions[data-motion=true] { transition:transform 240ms cubic-bezier(.25,1,.5,1); }
        @starting-style { .mbn-actions[data-motion=true] { transform:translateY(100%); } }
        @media(prefers-reduced-motion:reduce) { .mbn-actions[data-motion=true] { transition:none; } }
        .mbn-sheet-grip { width:32px; height:3px; border-radius:2px; margin:0 auto 8px; background:var(--gray-500); }
        .mbn-sheet-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; }
        .mbn-sheet-heading h2 { margin:0; font-family:var(--font-heading); font-size:24px; letter-spacing:0; }
        .mbn-sheet-close { width:44px; height:44px; flex-shrink:0; display:grid; place-items:center; border:0; color:var(--bone); background:transparent; cursor:pointer; }
        .mbn-sheet-action {
          display:flex; align-items:center; gap:16px; width:100%; min-height:76px;
          padding:16px 0; color:var(--bone); background:transparent; border:0;
          font:inherit; font-size:18px; font-weight:600; text-align:left; cursor:pointer;
        }
        .mbn-sheet-action svg:first-child { color:var(--orange); flex-shrink:0; }
        .mbn-sheet-action svg:last-child { margin-left:auto; color:var(--gray-400); flex-shrink:0; }
        .mbn-sheet-action+.mbn-sheet-action { border-top:1px solid var(--gray-700); }
        @media(hover:hover) { .mbn-actions button:hover { background:var(--gray-800); } }
        .mbn-actions button:focus-visible { outline:2px solid var(--orange); outline-offset:2px; }
        .mbn-add[aria-expanded=true] svg { transform:rotate(45deg); }
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
          <button ref={triggerRef} type="button" className="mbn-add cm-add-spot" disabled={!interactive} onClick={event=>{event.currentTarget.focus();setAnimateSheet(event.detail>0);setActionsOpen(open=>!open);}} aria-haspopup="dialog" aria-expanded={actionsOpen} aria-controls="mbn-create-actions" aria-label={text('Spot e sessioni', 'Spots and sessions')} title={text('Spot e sessioni', 'Spots and sessions')}>
            <MapIcon name="plus" size={32}/>
          </button>
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
            if(sessions?.endpoint==='/api/rider-sessions-preview'){router.push('/u/rider_demo');return;}
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
      {actionsOpen&&createPortal(<>
        <div className="mbn-sheet-backdrop" aria-hidden="true" onClick={()=>setActionsOpen(false)}/>
        <div ref={actionsRef} id="mbn-create-actions" className="mbn-actions" data-motion={animateSheet} role="dialog" aria-modal="true" aria-labelledby="mbn-actions-title">
          <div className="mbn-sheet-grip" aria-hidden="true"/>
          <header className="mbn-sheet-heading"><h2 id="mbn-actions-title">{text('Cosa vuoi fare?','Choose an action')}</h2><button type="button" className="mbn-sheet-close" onClick={()=>setActionsOpen(false)} aria-label={text('Chiudi azioni','Close actions')} title={text('Chiudi azioni','Close actions')}><MapIcon name="close" size={24}/></button></header>
          {sessions&&<button type="button" className="mbn-sheet-action" onClick={()=>{setActionsOpen(false);if(onStartSession)onStartSession();else router.push('/?session=1');}}><MapIcon name="play" size={26}/><span>{text('Vai in sessione','Start a session')}</span><MapIcon name="arrow"/></button>}
          <button type="button" className="mbn-sheet-action" onClick={()=>{setActionsOpen(false);handleAdd();}}><MapIcon name="pin" size={26}/><span>{text('Aggiungi spot','Add spot')}</span><MapIcon name="arrow"/></button>
        </div>
      </>,document.body)}
    </>
  );
}
