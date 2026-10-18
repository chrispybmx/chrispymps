'use client';
import { useEffect, useState } from 'react';
import { useLanguage } from './LanguageProvider';
export default function SiteConnectionStatus() {
  const { text } = useLanguage();
  const [offline, setOffline] = useState(false);
  const [update, setUpdate] = useState(false);
  useEffect(() => {
    const online = () => setOffline(!navigator.onLine);
    const updated = () => setUpdate(true);
    online(); window.addEventListener('online', online); window.addEventListener('offline', online);
    window.addEventListener('chrispy:update-ready', updated);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', online); window.removeEventListener('chrispy:update-ready', updated); };
  }, []);
  if (!offline && !update) return null;
  return <aside role="status" style={{position:'fixed',bottom:76,left:12,right:12,zIndex:90,background:'var(--gray-800)',border:'1px solid var(--gray-600)',padding:'12px 16px',fontSize:14}}>
    {offline ? text('Sei offline. Alcuni contenuti già consultati possono essere disponibili; gli aggiornamenti richiedono una connessione.', 'You are offline. Some previously viewed content may be available; updates require a connection.') : <>{text('È disponibile una nuova versione. Aggiorna quando hai finito il contributo.', 'A new version is available. Refresh when you have finished your contribution.')} <button className="btn-ghost" onClick={() => window.location.reload()}>{text('Aggiorna', 'Refresh')}</button><button className="btn-ghost" onClick={() => setUpdate(false)}>{text('Più tardi', 'Later')}</button></>}
  </aside>;
}
