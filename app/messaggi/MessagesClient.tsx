'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useUser } from '@/hooks/useUser';
import MapIcon from '@/components/MapIcon';
import { SESSION_INVITES_PUBLIC, SESSION_STATUS_LABELS, type SessionInbox, type SessionInvite, type SessionMessage, type SessionThread } from '@/lib/session-invites';
import { displaySessionDate, mergeSessionInvites, mergeSessionMessages, SessionApiError, sessionDateISO, sessionError, sessionStatus } from './helpers';

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
type SpotChoice = { id: string; slug: string; name: string; city?: string };
type RiderChoice = { username: string; spotCount: number };
type Draft = { body: string; clientId: string };
type Action = 'accept' | 'decline' | 'cancel' | 'block' | 'unblock' | 'report';

function Avatar({ username, url }: { username: string; url: string | null }) {
  return <span className="cm-msg-avatar" aria-hidden="true">{url ? <img src={url} alt="" width={40} height={40} loading="lazy" referrerPolicy="no-referrer" /> : username.slice(0, 2).toUpperCase()}</span>;
}

export default function MessagesClient() {
  const user = useUser();
  const userId = user?.id;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selectedId = params.get('invite');
  const composing = params.has('to') || params.has('spot') || params.has('new');
  const token = user?.accessToken;
  const [authOpen, setAuthOpen] = useState(false);
  const [inbox, setInbox] = useState<SessionInvite[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [inboxError, setInboxError] = useState('');
  const [inboxReload, setInboxReload] = useState(0);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [inboxMore, setInboxMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);
  const [unblockingUser, setUnblockingUser] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<SessionInbox['blockedUsers']>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [unavailable, setUnavailable] = useState(!SESSION_INVITES_PUBLIC);
  const [thread, setThread] = useState<SessionThread | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState('');
  const [threadReload, setThreadReload] = useState(0);
  const [olderMessages, setOlderMessages] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [toolsOpen, setToolsOpen] = useState(false);
  const [safetyAction, setSafetyAction] = useState<'block' | 'report' | null>(null);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const [recipient, setRecipient] = useState(params.get('to')?.replace(/^@/, '') ?? '');
  const [riderQuery, setRiderQuery] = useState('');
  const [riders, setRiders] = useState<RiderChoice[]>([]);
  const [riderLoading, setRiderLoading] = useState(false);
  const [riderError, setRiderError] = useState('');
  const [spotId, setSpotId] = useState(params.get('spot') ?? '');
  const [spotQuery, setSpotQuery] = useState('');
  const [spots, setSpots] = useState<SpotChoice[] | null>(null);
  const [spotError, setSpotError] = useState('');
  const [spotReload, setSpotReload] = useState(0);
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [composeError, setComposeError] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [timeZone, setTimeZone] = useState('');
  const inviteAttempt = useRef<{ payload: string; id: string } | null>(null);
  const currentId = useRef(selectedId);
  const currentRoute = useRef(params.toString());
  const currentUser = useRef(user?.id);
  const pageRef = useRef<HTMLElement>(null);
  const messageList = useRef<HTMLDivElement>(null);
  const messageInput = useRef<HTMLTextAreaElement>(null);
  const followLatest = useRef(true);
  currentId.current = selectedId;
  currentRoute.current = params.toString();
  currentUser.current = user?.id;

  const api = useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const response = await fetch(`/api/session-invites${path}`, {
      ...options, cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}`, ...options.headers },
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      const code = typeof result.code === 'string' ? result.code : '';
      if (code === 'FEATURE_UNAVAILABLE') setUnavailable(true);
      throw new SessionApiError(response.status, code, typeof result.error === 'string' ? result.error : 'Richiesta non riuscita.');
    }
    return result as T;
  }, [token]);

  const onError = useCallback((error: unknown, write: (message: string) => void) => {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    write(sessionError(error));
    if (error instanceof SessionApiError && error.status === 401) setAuthOpen(true);
  }, []);

  useEffect(() => { setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone); }, []);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const resize = () => pageRef.current?.style.setProperty('--cm-msg-height', `${viewport.height}px`);
    resize(); viewport.addEventListener('resize', resize);
    return () => viewport.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    setInbox([]); setThread(null); setDrafts({}); setInboxError(''); setThreadError(''); setNotice('');
    setBlockedUsers([]); setEmailEnabled(false);
  }, [userId]);
  useEffect(() => {
    const seededRecipient = params.get('to');
    const seededSpot = params.get('spot');
    if (seededRecipient) setRecipient(seededRecipient.replace(/^@/, ''));
    if (seededSpot) setSpotId(seededSpot);
  }, [params]);

  // Read only while this page is visible. Aborted/old account responses never repopulate private state.
  useEffect(() => {
    if (!userId || unavailable) { setInboxLoading(false); return; }
    const controller = new AbortController();
    let stopped = false;
    let running = false;
    let first = true;
    setInboxLoading(true);
    const load = async () => {
      if (stopped || running || document.visibilityState !== 'visible') return;
      running = true;
      try {
        const data = await api<SessionInbox>('', { signal: controller.signal });
        if (stopped || document.visibilityState !== 'visible') return;
        setInbox(rows => mergeSessionInvites(rows, data.data));
        setEmailEnabled(data.emailEnabled); setBlockedUsers(data.blockedUsers); setInboxError('');
        if (first) { setInboxMore(data.hasMore); setOlderCursor(data.nextBefore); first = false; }
      } catch (error) { if (!stopped) onError(error, setInboxError); }
      finally { running = false; if (!stopped) setInboxLoading(false); }
    };
    const visibility = () => { if (document.visibilityState === 'visible') void load(); };
    void load();
    const timer = window.setInterval(load, 60000);
    document.addEventListener('visibilitychange', visibility);
    return () => { stopped = true; controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', visibility); };
  }, [api, userId, unavailable, inboxReload, onError]);

  useEffect(() => {
    setThread(null); setThreadError(''); setToolsOpen(false); setSafetyAction(null); setReason(''); setNotice('');
    followLatest.current = true;
  }, [selectedId]);

  useEffect(() => {
    if (!userId || !selectedId || composing || unavailable) return;
    const id = selectedId;
    const controller = new AbortController();
    let stopped = false;
    let running = false;
    let initial = true;
    let lastId: number | null = null;
    let lastRead: number | null | undefined;
    setThreadLoading(true);
    const load = async () => {
      if (stopped || running || document.visibilityState !== 'visible') return;
      running = true;
      try {
        const query = !initial && lastId != null ? `?after=${lastId}` : '';
        const result = await api<{ data: SessionThread }>(`/${encodeURIComponent(id)}${query}`, { signal: controller.signal });
        if (stopped || currentId.current !== id || document.visibilityState !== 'visible') return;
        const data = result.data;
        for (const message of data.messages) lastId = Math.max(lastId ?? 0, message.id);
        const first = initial;
        initial = false;
        setThread(previous => ({ ...data, messages: mergeSessionMessages(previous?.invite.id === id ? previous.messages : [], data.messages, id), hasMore: first ? data.hasMore : previous?.hasMore ?? data.hasMore }));
        setInbox(rows => mergeSessionInvites(rows, [data.invite]));
        setThreadError('');
        if (document.visibilityState === 'visible' && (lastRead !== lastId || data.invite.unread)) {
          await api(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ action: 'read', readThrough: data.invite.updated_at }), signal: controller.signal });
          if (!stopped) { lastRead = lastId; setInbox(rows => rows.map(item => item.id === id ? { ...item, unread: false } : item)); }
        }
        // Catch up in bounded batches on the next poll; never reread an entire conversation.
      } catch (error) { if (!stopped) onError(error, setThreadError); }
      finally { running = false; if (!stopped) setThreadLoading(false); }
    };
    const visibility = () => { if (document.visibilityState === 'visible') void load(); };
    void load();
    const timer = window.setInterval(load, 15000);
    document.addEventListener('visibilitychange', visibility);
    return () => { stopped = true; controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', visibility); };
  }, [api, userId, selectedId, composing, unavailable, threadReload, onError]);

  useEffect(() => {
    if (followLatest.current && messageList.current) messageList.current.scrollTop = messageList.current.scrollHeight;
  }, [thread?.messages.length, selectedId]);

  useEffect(() => {
    if (!composing || unavailable || spots) return;
    const controller = new AbortController();
    setSpotError('');
    fetch('/api/spots', { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error('Non riusciamo a caricare gli spot. Riprova.');
      if (!controller.signal.aborted) setSpots(data.data);
    }).catch(error => { if (!controller.signal.aborted) setSpotError(sessionError(error)); });
    return () => controller.abort();
  }, [composing, unavailable, spots, spotReload]);

  useEffect(() => {
    setRiders([]); setRiderError('');
    if (!composing || !user || recipient || riderQuery.trim().length < 2 || unavailable) { setRiderLoading(false); return; }
    const controller = new AbortController();
    setRiderLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/users?q=${encodeURIComponent(riderQuery.trim().replace(/^@/, ''))}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error('Non riusciamo a cercare i rider. Riprova.');
        if (!controller.signal.aborted) setRiders((data.data as RiderChoice[]).filter(rider => rider.username.toLowerCase() !== user.username.toLowerCase()));
      } catch (error) { if (!controller.signal.aborted) setRiderError(sessionError(error)); }
      finally { if (!controller.signal.aborted) setRiderLoading(false); }
    }, 300);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [composing, user, recipient, riderQuery, unavailable]);

  async function loadOlderInbox() {
    if (!olderCursor || loadingOlder) return;
    const actor = user?.id;
    setLoadingOlder(true);
    try {
      const result = await api<SessionInbox>(`?before=${encodeURIComponent(olderCursor)}`);
      if (currentUser.current !== actor) return;
      setInbox(rows => mergeSessionInvites(rows, result.data)); setInboxMore(result.hasMore); setOlderCursor(result.nextBefore); setInboxError('');
    } catch (error) { if (currentUser.current === actor) onError(error, setInboxError); }
    finally { setLoadingOlder(false); }
  }

  async function loadOlderMessages() {
    if (!thread || olderMessages || !thread.messages[0]) return;
    const id = thread.invite.id;
    const actor = user?.id;
    const scroll = messageList.current;
    const oldHeight = scroll?.scrollHeight ?? 0;
    const oldTop = scroll?.scrollTop ?? 0;
    setOlderMessages(true); followLatest.current = false;
    try {
      const result = await api<{ data: SessionThread }>(`/${encodeURIComponent(id)}?before=${thread.messages[0].id}`);
      if (currentId.current !== id || currentUser.current !== actor) return;
      setThread(previous => previous?.invite.id === id ? { ...previous, hasMore: result.data.hasMore, messages: mergeSessionMessages(previous.messages, result.data.messages, id) } : previous);
      requestAnimationFrame(() => { if (currentId.current === id && scroll) scroll.scrollTop = oldTop + scroll.scrollHeight - oldHeight; });
    } catch (error) { if (currentId.current === id && currentUser.current === actor) onError(error, setThreadError); }
    finally { setOlderMessages(false); }
  }

  async function performAction(action: Action) {
    if (!thread || actionBusy) return;
    const id = thread.invite.id;
    const actor = user?.id;
    setActionBusy(true); setThreadError('');
    try {
      await api(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ action, ...(action === 'report' ? { reason: reason.trim() } : {}) }) });
      if (currentId.current !== id || currentUser.current !== actor) return;
      setSafetyAction(null); setToolsOpen(false); setReason('');
      setNotice(action === 'report' ? 'Segnalazione inviata. Verrà esaminata.' : action === 'unblock' ? 'Rider sbloccato. Questo invito resta chiuso; potete proporne uno nuovo.' : '');
      setThreadReload(value => value + 1); setInboxReload(value => value + 1);
    } catch (error) { if (currentId.current === id && currentUser.current === actor) onError(error, setThreadError); }
    finally { setActionBusy(false); }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!thread || sending || !selectedId) return;
    const id = selectedId;
    const actor = user?.id;
    const draft = drafts[id];
    if (!draft?.body.trim()) return;
    setSending(true); setThreadError('');
    try {
      const result = await api<{ data: SessionMessage }>(`/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({ body: draft.body.trim(), clientId: draft.clientId }) });
      if (currentUser.current !== actor) return;
      setDrafts(previous => previous[id]?.clientId === draft.clientId ? { ...previous, [id]: { body: '', clientId: crypto.randomUUID() } } : previous);
      if (currentId.current !== id) return;
      followLatest.current = true;
      setThread(previous => previous?.invite.id === id ? { ...previous, messages: mergeSessionMessages(previous.messages, [result.data], id) } : previous);
      messageInput.current?.focus();
    } catch (error) { if (currentId.current === id && currentUser.current === actor) onError(error, setThreadError); }
    finally { setSending(false); }
  }

  async function submitInvite(event: FormEvent) {
    event.preventDefault();
    if (!user) { setAuthOpen(true); return; }
    if (inviteSending) return;
    const actor = user.id;
    const route = currentRoute.current;
    setComposeError('');
    try {
      if (!recipient) throw new Error('Scegli il rider da invitare.');
      if (recipient.toLowerCase() === user.username.toLowerCase()) throw new Error('Scegli un altro rider: non puoi invitare te stesso.');
      if (!spots?.some(spot => spot.id === spotId)) throw new Error('Scegli uno spot disponibile.');
      const startsAt = sessionDateISO(day, time);
      if (!timeZone) throw new Error('Non riusciamo a rilevare il tuo fuso orario. Ricarica la pagina.');
      const payload = { recipient, spotId, startsAt, timeZone, note: note.trim() };
      const serialized = JSON.stringify(payload);
      if (inviteAttempt.current?.payload !== serialized) inviteAttempt.current = { payload: serialized, id: crypto.randomUUID() };
      setInviteSending(true);
      const result = await api<{ id: string }>('', { method: 'POST', body: JSON.stringify({ ...payload, clientId: inviteAttempt.current.id }) });
      if (currentUser.current !== actor) return;
      setInboxReload(value => value + 1);
      if (currentRoute.current !== route) return;
      inviteAttempt.current = null; setNote(''); setDay(''); setTime('');
      router.replace(`${pathname}?invite=${encodeURIComponent(result.id)}`, { scroll: false });
    } catch (error) { if (currentUser.current === actor && currentRoute.current === route) onError(error, setComposeError); }
    finally { setInviteSending(false); }
  }

  async function changeEmail(value: boolean) {
    if (savingPreference) return;
    const actor = user?.id;
    setSavingPreference(true);
    try {
      await api('', { method: 'PATCH', body: JSON.stringify({ emailEnabled: value }) });
      if (currentUser.current === actor) { setEmailEnabled(value); setInboxError(''); }
    } catch (error) { if (currentUser.current === actor) onError(error, setInboxError); }
    finally { setSavingPreference(false); }
  }

  async function unblockRider(blockedId: string) {
    if (!user || unblockingUser) return;
    const actor = user.id;
    setUnblockingUser(blockedId); setInboxError('');
    try {
      await api('', { method: 'PATCH', body: JSON.stringify({ unblockUserId: blockedId }) });
      if (currentUser.current !== actor) return;
      setBlockedUsers(previous => previous.filter(blocked => blocked.id !== blockedId));
      setInboxReload(value => value + 1); setThreadReload(value => value + 1);
    } catch (error) { if (currentUser.current === actor) onError(error, setInboxError); }
    finally { setUnblockingUser(null); }
  }

  const openInbox = () => router.replace(pathname, { scroll: false });
  const visibleInbox = inbox.filter(item => item.sender_id === userId || item.recipient_id === userId);
  const invite = thread?.invite.id === selectedId && (thread.invite.sender_id === userId || thread.invite.recipient_id === userId) ? thread.invite : undefined;
  const peer = invite ? (invite.sender_id === user?.id ? invite.recipient_username : invite.sender_username) : '';
  const peerId = invite ? (invite.sender_id === user?.id ? invite.recipient_id : invite.sender_id) : '';
  const peerAvatar = invite ? (invite.sender_id === user?.id ? invite.recipient_avatar : invite.sender_avatar) : null;
  const status = invite ? sessionStatus(invite) : null;
  const canChat = status === 'accepted' && !thread?.blocked;
  const ownsBlock = blockedUsers.some(blocked => blocked.id === peerId);
  const chosenSpot = spots?.find(spot => spot.id === spotId);
  const matches = spots?.filter(spot => `${spot.name} ${spot.city ?? ''}`.toLocaleLowerCase('it').includes(spotQuery.trim().toLocaleLowerCase('it'))).slice(0, 8) ?? [];

  return <main ref={pageRef} className={`cm-messages${selectedId || composing ? ' cm-messages-detail' : ''}`}>
    <header className="cm-msg-topbar">
      <Link href="/" className="cm-msg-brand" aria-label="Chrispy Maps, torna alla mappa">Chrispy <span>Maps</span></Link>
      <Link href="/" className="cm-msg-link"><MapIcon name="pin" size={18} /> Mappa</Link>
    </header>
    {unavailable ? <section className="cm-msg-standalone"><h1>Le session arrivano qui.</h1><p>Gli inviti alle session non sono ancora attivi. Nel frattempo puoi scoprire spot e rider sulla mappa.</p><Link className="cm-msg-button cm-msg-primary" href="/">Torna alla mappa <MapIcon name="arrow" /></Link></section> : <>
      <div className="cm-msg-layout">
        <aside className="cm-msg-inbox" aria-label="Inviti e conversazioni">
          <div className="cm-msg-section-heading"><h1>Messaggi</h1><Link href="/messaggi?new=1" className="cm-msg-button cm-msg-primary cm-msg-icon-button" aria-label="Proponi una session"><MapIcon name="plus" /></Link></div>
          <p className="cm-msg-intro">Inviti a una session e conversazioni tra rider.</p>
          {user ? <>
            <button className="cm-msg-preferences" onClick={() => setSettingsOpen(value => !value)} aria-expanded={settingsOpen}>Preferenze e rider bloccati <span aria-hidden="true">{settingsOpen ? '−' : '+'}</span></button>
            {settingsOpen && <div className="cm-msg-settings"><label className="cm-msg-checkbox"><input type="checkbox" checked={emailEnabled} disabled={savingPreference} onChange={event => void changeEmail(event.target.checked)} /><span>Avvisami via email quando ricevo un invito<small>Nessun messaggio della chat viene incluso.</small></span></label>{blockedUsers.length > 0 && <><h2>Rider bloccati</h2><p>Lo sblocco permette nuovi inviti. Le conversazioni chiuse restano chiuse.</p><ul className="cm-msg-blocked-riders">{blockedUsers.map(blocked => <li key={blocked.id}><span>@{blocked.username}</span><button className="cm-msg-button" aria-label={`Sblocca @${blocked.username}`} disabled={unblockingUser !== null} onClick={() => void unblockRider(blocked.id)}>{unblockingUser === blocked.id ? "Attendi…" : "Sblocca"}</button></li>)}</ul></>}</div>}
            {inboxError && <div className="cm-msg-error" role="alert">{inboxError}<button className="cm-msg-text-button" onClick={() => setInboxReload(value => value + 1)}>Riprova</button></div>}
            <div className="cm-msg-inbox-list">
              {inboxLoading && !visibleInbox.length ? <p className="cm-msg-empty" role="status">Caricamento inviti…</p> : !visibleInbox.length && !inboxError ? <div className="cm-msg-empty"><MapIcon name="calendar" size={28} /><h2>Nessun invito, per ora.</h2><p>Invita un rider. Se accetta, qui potete accordarvi in privato.</p><Link href="/messaggi?new=1" className="cm-msg-button">Proponi una session</Link><Link href="/scopri" className="cm-msg-text-button">Cerca uno spot</Link></div> : visibleInbox.map(item => {
                const sent = item.sender_id === user.id;
                const name = sent ? item.recipient_username : item.sender_username;
                return <Link key={item.id} href={`/messaggi?invite=${encodeURIComponent(item.id)}`} scroll={false} className={`cm-msg-inbox-row${selectedId === item.id ? ' is-selected' : ''}`} aria-current={selectedId === item.id ? 'page' : undefined}>
                  <Avatar username={name} url={sent ? item.recipient_avatar : item.sender_avatar} /><span className="cm-msg-inbox-copy"><strong>@{name}{item.unread && <span className="cm-msg-unread">Non letto</span>}</strong><span>{item.spot_name}</span><small>{displaySessionDate(item.starts_at, item.time_zone)} · {item.time_zone}</small><span className="cm-msg-row-status">{sent && sessionStatus(item) === 'pending' ? 'Invito inviato' : SESSION_STATUS_LABELS[sessionStatus(item)]}</span></span><span aria-hidden="true">→</span>
                </Link>;
              })}
              {inboxMore && <button className="cm-msg-button cm-msg-more" onClick={() => void loadOlderInbox()} disabled={loadingOlder}>{loadingOlder ? 'Caricamento…' : 'Inviti precedenti'}</button>}
            </div>
          </> : user === undefined ? <p className="cm-msg-empty" role="status">Verifica accesso…</p> : <div className="cm-msg-empty"><h2>Gira con altri rider.</h2><p>Accedi per ricevere inviti e accordarti su dove e quando girare.</p><button className="cm-msg-button cm-msg-primary" onClick={() => setAuthOpen(true)}>Accedi</button></div>}
        </aside>

        <section className="cm-msg-content" aria-label={composing ? 'Proponi una session' : 'Conversazione'}>
          {composing ? <div className="cm-msg-compose">
            <button className="cm-msg-back" onClick={openInbox}>← Messaggi</button><h1>Proponi una session</h1><p>Invita un rider a girare in uno spot. La chat si apre quando accetta.</p>
            <form onSubmit={submitInvite} className="cm-msg-invite-form">
              <fieldset disabled={inviteSending}><legend>Con chi</legend>{recipient ? <div className="cm-msg-choice"><Link href={`/u/${encodeURIComponent(recipient)}`}>@{recipient}</Link><button type="button" className="cm-msg-text-button" onClick={() => { setRecipient(''); setRiderQuery(''); }}>Cambia rider</button></div> : <><label htmlFor="session-rider">Cerca un rider</label><input id="session-rider" type="search" value={riderQuery} onChange={event => setRiderQuery(event.target.value)} placeholder="Username del rider" autoComplete="off" maxLength={30} disabled={!user} />{!user && <p className="cm-msg-hint">Accedi per cercare un rider. La proposta resta qui.</p>}{riderLoading && <p className="cm-msg-hint" role="status">Ricerca…</p>}{riderError && <p className="cm-msg-error" role="alert">{riderError}</p>}{riders.length > 0 && <ul className="cm-msg-search-results">{riders.map(rider => <li key={rider.username}><button type="button" onClick={() => { setRecipient(rider.username); setRiderQuery(''); }}>@{rider.username}<span>{rider.spotCount} spot</span></button></li>)}</ul>}{user && !riderLoading && !riderError && riderQuery.trim().length >= 2 && !riders.length && <p className="cm-msg-hint">Nessun rider trovato.</p>}</>}</fieldset>
              <fieldset disabled={inviteSending}><legend>Dove</legend>{chosenSpot ? <div className="cm-msg-choice"><span><strong>{chosenSpot.name}</strong>{chosenSpot.city && <small>{chosenSpot.city}</small>}</span><button type="button" className="cm-msg-text-button" onClick={() => { setSpotId(''); setSpotQuery(''); }}>Cambia spot</button></div> : <><label htmlFor="session-spot">Cerca uno spot</label><input id="session-spot" type="search" value={spotQuery} onChange={event => setSpotQuery(event.target.value)} placeholder="Nome dello spot o città" autoComplete="off" />{spots && spotId && !chosenSpot && <p className="cm-msg-error">Lo spot del link non è disponibile. Scegline un altro.</p>}{!spots && !spotError && <p className="cm-msg-hint" role="status">Caricamento spot…</p>}{spotError && <div className="cm-msg-error" role="alert">{spotError}<button type="button" className="cm-msg-text-button" onClick={() => setSpotReload(value => value + 1)}>Riprova</button></div>}{spots && spotQuery.trim().length > 0 && <ul className="cm-msg-search-results">{matches.map(spot => <li key={spot.id}><button type="button" onClick={() => { setSpotId(spot.id); setSpotQuery(''); }}><strong>{spot.name}</strong>{spot.city && <span>{spot.city}</span>}</button></li>)}{!matches.length && <li className="cm-msg-hint">Nessuno spot trovato.</li>}</ul>}</>}</fieldset>
              <fieldset disabled={inviteSending}><legend>Quando</legend><div className="cm-msg-date-fields"><label htmlFor="session-day">Giorno<input id="session-day" type="date" required value={day} onChange={event => setDay(event.target.value)} /></label><label htmlFor="session-time">Ora<input id="session-time" type="time" required value={time} onChange={event => setTime(event.target.value)} /></label></div><p className="cm-msg-hint">Orario nel tuo fuso: <strong>{timeZone || 'rilevamento…'}</strong>. Sarà visibile anche al destinatario.</p></fieldset>
              <label htmlFor="session-note">Un messaggio <span className="cm-msg-muted">(facoltativo)</span><textarea id="session-note" rows={3} value={note} onChange={event => setNote(event.target.value)} maxLength={500} placeholder="A che ora arrivi, cosa vuoi girare…" disabled={inviteSending} /></label>
              {composeError && <p className="cm-msg-error" role="alert">{composeError}</p>}
              <button type={user ? "submit" : "button"} onClick={() => { if (!user) setAuthOpen(true); }} disabled={inviteSending || user === undefined} className="cm-msg-button cm-msg-primary">{inviteSending ? 'Invio invito…' : user ? 'Invia invito' : 'Accedi per invitare'}<MapIcon name="arrow" /></button>
              <p className="cm-msg-hint">Il rider potrà accettare o rifiutare. Nessun messaggio privato viene inviato prima dell’accettazione.</p>
            </form>
          </div> : selectedId ? <div className="cm-msg-thread">
            <div className="cm-msg-thread-heading"><button className="cm-msg-back" onClick={openInbox}>← Messaggi</button>{invite && <button className="cm-msg-button" aria-expanded={toolsOpen} onClick={() => { setToolsOpen(value => !value); setSafetyAction(null); }}>Opzioni</button>}</div>
            {!user ? <div className="cm-msg-empty"><h1>Un invito per girare insieme.</h1><p>Accedi per vedere se questo invito è per te.</p><button className="cm-msg-button cm-msg-primary" onClick={() => setAuthOpen(true)} disabled={user === undefined}>Accedi</button></div> : <>
              {threadLoading && !thread && <p className="cm-msg-empty" role="status">Caricamento conversazione…</p>}
              {invite && <><div className="cm-msg-thread-person"><Avatar username={peer} url={peerAvatar} /><div><Link href={`/u/${encodeURIComponent(peer)}`}>@{peer}</Link><p>{thread?.blocked ? 'Conversazione chiusa' : SESSION_STATUS_LABELS[status!]}</p></div></div>
                <div className="cm-msg-spot-summary"><Link href={`/map/spot/${encodeURIComponent(invite.spot_slug)}`}><MapIcon name="pin" size={18} /><strong>{invite.spot_name}</strong><span aria-hidden="true">↗</span></Link><p>{displaySessionDate(invite.starts_at, invite.time_zone)} <span>· {invite.time_zone}</span></p>{invite.spot_city && <small>{invite.spot_city}</small>}</div>
                {toolsOpen && <div className="cm-msg-safety"><div className="cm-msg-safety-buttons"><button className="cm-msg-button" onClick={() => setSafetyAction('report')} disabled={actionBusy}>Segnala</button>{ownsBlock ? <button className="cm-msg-button" onClick={() => void performAction('unblock')} disabled={actionBusy}>Sblocca rider</button> : <button className="cm-msg-button" onClick={() => setSafetyAction('block')} disabled={actionBusy}>Blocca rider</button>}</div>{safetyAction === 'block' && <><p>Il blocco chiude questa conversazione e impedisce nuovi inviti e messaggi tra voi. Potrai sbloccare il rider dalle opzioni.</p><button className="cm-msg-button" onClick={() => void performAction('block')} disabled={actionBusy}>{actionBusy ? 'Attendi…' : 'Conferma blocco'}</button></>}{safetyAction === 'report' && <form onSubmit={event => { event.preventDefault(); void performAction('report'); }}><label htmlFor="report-reason">Cosa è successo?<textarea id="report-reason" rows={3} value={reason} maxLength={1000} minLength={3} required onChange={event => setReason(event.target.value)} /></label><p>I moderatori riceveranno il motivo, l’invito e gli ultimi 20 messaggi di questa conversazione.</p><button className="cm-msg-button" disabled={actionBusy || reason.trim().length < 3} type="submit">{actionBusy ? 'Invio…' : 'Invia segnalazione'}</button></form>}</div>}
                <div className="cm-msg-timeline" ref={messageList} onScroll={() => { const list = messageList.current; if (list) followLatest.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80; }}>
                  {thread?.hasMore && <button className="cm-msg-button cm-msg-more" disabled={olderMessages} onClick={() => void loadOlderMessages()}>{olderMessages ? 'Caricamento…' : 'Messaggi precedenti'}</button>}
                  <div className="cm-msg-original"><span>Invito di @{invite.sender_username}</span>{invite.note ? <p>{invite.note}</p> : <p>Una session a {invite.spot_name}.</p>}</div>
                  {status === 'pending' && !thread?.blocked && <div className="cm-msg-response">{invite.recipient_id === user.id ? <><h2>Vi trovate allo spot?</h2><p>Accettando apri la chat con @{peer} per accordarvi.</p><div><button className="cm-msg-button cm-msg-primary" disabled={actionBusy} onClick={() => void performAction('accept')}>Accetta invito</button><button className="cm-msg-button" disabled={actionBusy} onClick={() => void performAction('decline')}>Rifiuta</button></div></> : <><h2>Invito inviato.</h2><p>Quando @{peer} accetta, potete scrivervi qui.</p><button className="cm-msg-button" disabled={actionBusy} onClick={() => void performAction('cancel')}>Annulla invito</button></>}</div>}
                  {(status === 'expired' || status === 'cancelled' || status === 'declined' || status === 'blocked' || thread?.blocked) && <p className="cm-msg-closed">{thread?.blocked || status === 'blocked' ? 'Questa conversazione è chiusa. Non potete scambiarvi messaggi.' : status === 'expired' ? 'Il giorno dell’invito è passato senza un’accettazione.' : status === 'cancelled' ? 'L’invito è stato annullato.' : 'L’invito è stato rifiutato. La chat non è stata aperta.'}</p>}
                  {canChat && !thread?.messages.length && <p className="cm-msg-conversation-start">Invito accettato. Potete accordarvi qui.</p>}
                  <ol className="cm-msg-message-list" aria-label="Messaggi della conversazione" aria-live="polite" aria-relevant="additions">{thread?.messages.map(message => <li key={message.id} className={message.sender_id === user.id ? 'is-mine' : ''}><div><span className="cm-msg-sr-only">{message.sender_id === user.id ? 'Tu' : peer}: </span><p>{message.body}</p><time dateTime={message.created_at}>{new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(message.created_at))}</time></div></li>)}</ol>
                </div>
              </>}
              {notice && <p className="cm-msg-notice" role="status">{notice}</p>}
              {threadError && <div className="cm-msg-error" role="alert">{threadError}<button className="cm-msg-text-button" onClick={() => setThreadReload(value => value + 1)}>Aggiorna conversazione</button></div>}
              {canChat && selectedId && <form onSubmit={sendMessage} className="cm-msg-send"><label htmlFor="session-message" className="cm-msg-sr-only">Messaggio a @{peer}</label><textarea id="session-message" ref={messageInput} rows={2} maxLength={2000} value={drafts[selectedId]?.body ?? ''} onChange={event => setDrafts(previous => ({ ...previous, [selectedId]: { body: event.target.value, clientId: crypto.randomUUID() } }))} placeholder={`Scrivi a @${peer}`} /><button className="cm-msg-button cm-msg-primary" type="submit" disabled={sending || !drafts[selectedId]?.body.trim()}>{sending ? 'Invio…' : 'Invia'}</button></form>}
            </>}
          </div> : <div className="cm-msg-welcome"><MapIcon name="calendar" size={36} /><h2>Proponi una session a un rider.</h2><p>Apri un invito o proponine uno a un rider. La chat rimane tra voi.</p><Link href="/messaggi?new=1" className="cm-msg-button cm-msg-primary">Proponi una session <MapIcon name="arrow" /></Link></div>}
        </section>
      </div>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onSuccess={() => { setAuthOpen(false); setInboxReload(value => value + 1); setThreadReload(value => value + 1); }} />
    </>}
  </main>;
}
