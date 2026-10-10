'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/hooks/useUser';
import { requestSignIn } from '@/lib/auth-navigation';
import { useRiderSessions } from './RiderSessions';
import { RiderStatsSharing } from './RiderProfileStats';
import AnalyticsPreferences from './AnalyticsPreferences';
import NewsletterPreferences from './NewsletterPreferences';
import styles from './PrivacySettings.module.css';

export default function PrivacySettings() {
  const user = useUser();
  const sessions = useRiderSessions();
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState('');
  const download = useRef<AbortController | null>(null);
  useEffect(() => {
    setMessage(''); setDownloading(false);
    return () => download.current?.abort();
  }, [user?.id]);
  async function exportData() {
    if (!user || download.current) return;
    const controller = new AbortController(); download.current = controller;
    setDownloading(true); setMessage('');
    try {
      const response = await fetch('/api/user/export', {
        headers: { Authorization: `Bearer ${user.accessToken}` },
        cache: 'no-store', signal: controller.signal,
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Download non disponibile. Riprova.');
      }
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = 'chrispy-maps-profilo-sessioni.json';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Download avviato. Il file contiene dati personali: conservalo in un luogo sicuro.');
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Download non disponibile.');
    } finally {
      if (download.current === controller) download.current = null;
      if (!controller.signal.aborted) setDownloading(false);
    }
  }
  const ownSnapshot = sessions?.user?.id === user?.id ? sessions?.snapshot : null;
  const active = ownSnapshot?.sessions.find(session => session.status === 'active');
  const sharing = Boolean(active?.sharing && sessions && sessions.now < Date.parse(active.deadlineAt));
  return <>
    <section className={styles.section} aria-labelledby="device-privacy">
      <h2 id="device-privacy">Statistiche del sito</h2>
      <AnalyticsPreferences />
      <p><Link href="/privacy#statistiche">Dati raccolti e conservazione</Link></p>
    </section>
    {user === undefined ? <p role="status">Caricamento account…</p> : !user ?
      <section className={styles.section}><h2>Il tuo account</h2><button className="btn-primary" onClick={requestSignIn}>Accedi alle tue preferenze</button></section> : <>
      <section className={styles.section} aria-labelledby="presence-privacy">
        <h2 id="presence-privacy">Presenza sulla mappa</h2>
        {!sessions ? <p>Presenza non disponibile.</p> : !ownSnapshot ? <p>Stato della presenza non disponibile.</p> : <>
          <p>{sharing ? 'La tua presenza allo spot è condivisa con la Community del pilot.' : 'Nessuna presenza condivisa attiva.'}</p>
          {sharing && active && <button type="button" className="btn-primary" disabled={sessions.busy} onClick={() => void sessions.run({action:'hide', id:active.id})}>Nascondi presenza</button>}
        </>}
        {sessions?.error && <p role="alert" className={styles.error}>{sessions.error} <button type="button" disabled={sessions.busy} onClick={() => void sessions.refresh()}>Riprova</button></p>}
        <p>La visibilità si sceglie per ogni sessione, partendo da Solo io. La presenza condivisa scade dopo 2 ore senza rinnovo. Nasconderla non interrompe il timer.</p>
        <Link className={styles.link} href="/sessioni">Gestisci le tue sessioni</Link>
      </section>
      <section className={styles.section} aria-labelledby="profile-privacy">
        <h2 id="profile-privacy">Statistiche del profilo</h2>
        {process.env.NEXT_PUBLIC_RIDER_SESSIONS_ENABLED === 'true' ? <RiderStatsSharing key={user.id} user={user} /> : <p>Condivisione dei totali non disponibile.</p>}
        <p>Lo storico dettagliato e le valutazioni della sessione restano privati.</p>
      </section>
      <NewsletterPreferences key={user.id} token={user.accessToken} />
      <section className={styles.section} aria-labelledby="account-data">
        <h2 id="account-data">I tuoi dati</h2>
        <p>Scarica account, profilo, preferenze rider, sessioni e spot salvati in formato JSON. Il file non include foto, commenti, messaggi, newsletter o log tecnici.</p>
        <div className={styles.actions}>
          <button className="btn-primary" disabled={downloading} onClick={() => void exportData()}>{downloading ? 'Preparazione…' : 'Scarica profilo e sessioni'}</button>
          <Link className={styles.link} href={`/u/${encodeURIComponent(user.username)}/modifica`}>Modifica profilo</Link>
        </div>
        {message && <p role="status">{message}</p>}
        <p>Per una copia degli altri dati o per rimuovere informazioni personali dai contributi pubblici: <a href="mailto:christian.ceresato@gmail.com?subject=Richiesta%20dati%20personali">contatta il titolare</a>.</p>
        <Link className={styles.link} href={`/u/${encodeURIComponent(user.username)}/modifica#elimina-account`}>Elimina account</Link>
      </section>
    </>}
    <section className={styles.section}><div className={styles.actions}><Link className={styles.link} href="/privacy">Informativa privacy</Link><Link className={styles.link} href="/regole">Regole della community</Link></div></section>
  </>;
}
