'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '@/hooks/useUser';
import type { UserSession } from '@/lib/auth-client';
import { sessionDuration } from '@/lib/rider-sessions';
import styles from './RiderSessions.module.css';

type Totals = { confirmedCount: number; confirmedSeconds: number };

export function RiderPublicStats({ ownerId, endpoint = '/api/rider-stats' }: { ownerId: string; endpoint?: string }) {
 const user = useUser();
 const token = user?.accessToken;
 const isOwner = user?.id === ownerId;
 const ready = user !== undefined;
 const [stored, setStored] = useState<{ owner: string; viewer: string | null; data: Totals } | null>(null);
 const viewer = user?.id ?? null;
 const totals = stored?.owner === ownerId && stored.viewer === viewer ? stored.data : null;
 useEffect(() => {
  setStored(null);
  if (!ready || isOwner || process.env.NEXT_PUBLIC_RIDER_SESSIONS_ENABLED !== 'true') return;
  let active = true, generation = 0;
  const controller = new AbortController();
  const load = async () => {
   const ticket = ++generation;
   if (document.hidden) { setStored(null); return; }
   try {
    const response = await fetch(`${endpoint}?target=${ownerId}`, {
     headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store', signal: controller.signal,
    });
    const result = await response.json();
    if (active && ticket === generation) setStored(response.ok && result.ok && result.data ? { owner: ownerId, viewer, data: result.data } : null);
   } catch { if (active && ticket === generation) setStored(null); }
  };
  // Totals change at most once a day: reload on return to the page, no polling.
  void load();
  window.addEventListener('focus', load);
  document.addEventListener('visibilitychange', load);
  return () => { active = false; controller.abort(); window.removeEventListener('focus', load); document.removeEventListener('visibilitychange', load); };
 }, [ownerId, token, ready, isOwner, viewer, endpoint]);
 if (!totals || isOwner || !ready) return null;
 return <section className={styles.publicStats} aria-label="Session del rider">
  <div className={styles.totals}>
   <span><strong>{sessionDuration(totals.confirmedSeconds)}</strong> Tempo di sessione</span>
   <span><strong>{totals.confirmedCount}</strong> Sessioni</span>
  </div>
 </section>;
}

export function RiderStatsSharing({ user, endpoint = '/api/rider-stats' }: { user: UserSession; endpoint?: string }) {
 const [shared, setShared] = useState<boolean | null>(null);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const controller = useRef<AbortController | null>(null);
 const request = useCallback(async (value?: boolean) => {
  controller.current?.abort();
  const current = new AbortController(); controller.current = current;
  setBusy(true); setError('');
  try {
   const response = await fetch(endpoint, {
    method: value === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${user.accessToken}`, 'Content-Type': 'application/json' },
    ...(value === undefined ? {} : { body: JSON.stringify({ shared: value }) }),
    cache: 'no-store', signal: current.signal,
   });
   const result = await response.json();
   if (!response.ok || !result.ok) throw new Error(result.error || 'Salvataggio non riuscito.');
   if (!current.signal.aborted) setShared(result.data.shared);
  } catch (e) { if (!current.signal.aborted) setError(e instanceof Error ? e.message : 'Connessione assente.'); }
  finally { if (!current.signal.aborted) setBusy(false); }
 }, [user.accessToken, endpoint]);
 useEffect(() => { setShared(null); void request(); return () => controller.current?.abort(); }, [request]);
 return <div className={styles.sharing}>
  <label><input type="checkbox" checked={shared === true} disabled={shared === null || busy} onChange={e => void request(e.target.checked)} /> Mostra tempo e session al pubblico</label>
  <p className={styles.muted}>Anche a chi non ha un account. Solo i totali, senza spot, date o faccine. Puoi nasconderli quando vuoi.</p>
  {busy && <p role="status" className={styles.muted}>Aggiornamento…</p>}
  {error && <p role="alert" className={styles.error}>{error} <button type="button" onClick={() => void request()}>Riprova</button></p>}
 </div>;
}
