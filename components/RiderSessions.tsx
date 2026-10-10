'use client';

import { createContext,useCallback,useContext,useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { requestSignIn } from '@/lib/auth-navigation';
import type { UserSession } from '@/lib/auth-client';
import { sessionDuration,sessionClock,sessionSeconds,type RiderCommand,type RiderSession,type RiderSnapshot } from '@/lib/rider-sessions';
import MapIcon from './MapIcon';
import styles from './RiderSessions.module.css';
import { RiderStatsSharing } from './RiderProfileStats';

interface Context {
 user:UserSession|null|undefined; snapshot:RiderSnapshot|null; now:number; busy:boolean; error:string;
 refresh:()=>Promise<void>; run:(command:RiderCommand)=>Promise<boolean>; endpoint:string;
}
const Sessions=createContext<Context|null>(null);
export function useRiderSessions(){return useContext(Sessions);}
export function SessionCurrent(){const c=useContext(Sessions);const s=c?.snapshot?.sessions.find(s=>s.status==='active');return s?<><ActiveSession session={s}/><SessionError/></>:null;}
export function RiderSessionsRoot({children}:{children:React.ReactNode}) {
 if(process.env.NEXT_PUBLIC_RIDER_SESSIONS_ENABLED!=='true') return <>{children}</>;
 return <AuthenticatedSessions>{children}</AuthenticatedSessions>;
}
function AuthenticatedSessions({children}:{children:React.ReactNode}) {
 const user=useUser();
 return <RiderSessionsProvider user={user}>{children}<SessionDock /></RiderSessionsProvider>;
}
export function RiderSessionsProvider({children,user,endpoint='/api/rider-sessions'}:{children:React.ReactNode;user:UserSession|null|undefined;endpoint?:string}) {
 const [stored,setStored]=useState<{actor:string;data:RiderSnapshot}|null>(null);
 const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
 const [now,setNow]=useState(Date.now());
 const clock=useRef({server:Date.now(),local:0});
 const lock=useRef(false),generation=useRef(0),identity=useRef(user?.id);
 const invalidate=useCallback(()=>{generation.current+=1;},[]);
 identity.current=user?.id;
 const snapshot=stored?.actor===user?.id?stored?.data??null:null;
 const receive=useCallback((data:RiderSnapshot,actor:string)=>{
  clock.current={server:Date.parse(data.serverNow),local:performance.now()};
  setNow(clock.current.server);setStored({actor,data});setError('');
 },[]);
 const refresh=useCallback(async()=>{
  if(!user||lock.current)return;
  const ticket=++generation.current,actor=user.id;
  try {
   const response=await fetch(endpoint,{headers:{Authorization:`Bearer ${user.accessToken}`},cache:'no-store',signal:AbortSignal.timeout(12000)});
   const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'Sessioni non disponibili.');
   if(identity.current===actor&&ticket===generation.current)receive(result.data,actor);
  }catch(e){if(identity.current===actor&&ticket===generation.current)setError(e instanceof Error?e.message:'Connessione assente.');}
 },[user,endpoint,receive]);
 useEffect(()=>{
  setStored(null);setError('');++generation.current;void refresh();
  const update=()=>{if(!document.hidden)void refresh();};
  document.addEventListener('visibilitychange',update);window.addEventListener('focus',update);window.addEventListener('online',update);
  const poll=setInterval(update,30000);
  return()=>{invalidate();clearInterval(poll);document.removeEventListener('visibilitychange',update);window.removeEventListener('focus',update);window.removeEventListener('online',update);};
 },[refresh,invalidate]);
 useEffect(()=>{const tick=setInterval(()=>setNow(clock.current.server+performance.now()-clock.current.local),1000);return()=>clearInterval(tick);},[]);
 const deadline=snapshot?.sessions.find(s=>s.status==='active')?.deadlineAt;
 useEffect(()=>{
  if(!deadline)return;
  const delay=Math.max(0,Date.parse(deadline)-(clock.current.server+performance.now()-clock.current.local));
  const timer=setTimeout(()=>void refresh(),Math.min(delay+50,2147483647));return()=>clearTimeout(timer);
 },[deadline,refresh]);
 const run=useCallback(async(command:RiderCommand)=>{
  if(!user||lock.current)return false;
  lock.current=true;setBusy(true);setError('');++generation.current;
  const actor=user.id,key=`crock-session-command:${actor}`,signature=JSON.stringify(command);
  let requestId=crypto.randomUUID();
  try {
   // Retry uncertain writes with the same key, including after a browser refresh.
   try {const previous=JSON.parse(sessionStorage.getItem(key)||'null');if(previous?.signature===signature)requestId=previous.requestId;sessionStorage.setItem(key,JSON.stringify({signature,requestId}));}catch{}
   const response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${user.accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({requestId,command}),cache:'no-store',signal:AbortSignal.timeout(12000)});
   const result=await response.json();
   if(!response.ok||!result.ok)throw new Error(result.error||'Operazione non completata.');
   try{sessionStorage.removeItem(key);}catch{}
   if(identity.current===actor)receive(result.data,actor);
   return identity.current===actor;
  }catch(e){if(identity.current===actor)setError(e instanceof Error?e.message:'Connessione assente. Riprova.');return false;}
  finally{lock.current=false;setBusy(false);}
 },[user,endpoint,receive]);
 return <Sessions.Provider value={{user,snapshot,now,busy,error,refresh,run,endpoint}}>{children}</Sessions.Provider>;
}

function SessionError() {
 const c=useContext(Sessions);if(!c?.error)return null;
 return <p role="alert" className={styles.error}>{c.error} <button type="button" onClick={()=>void c.refresh()} disabled={c.busy}>Aggiorna</button></p>;
}
export function SpotSession({spotId}:{spotId:string}) {
 const c=useContext(Sessions);const [choosing,setChoosing]=useState(false);const [visibility,setVisibility]=useState<'private'|'community'>('private');
 const [presence,setPresence]=useState<{count:number;freshAt:string|null;validUntil:string|null;checked:number}|null>(null);
 useEffect(()=>{setChoosing(false);setVisibility('private');setPresence(null);},[spotId,c?.user?.id]);
 const token=c?.user?.accessToken,endpoint=c?.endpoint,canShare=c?.snapshot?.canShare;
 const changed=c?.snapshot?.serverNow;
 useEffect(()=>{
  setPresence(null);if(!token||!canShare||!endpoint)return;
  let alive=true;const controller=new AbortController();
  async function load(){if(document.hidden)return;try{
   const response=await fetch(`${endpoint}?spotId=${spotId}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal});
   const result=await response.json();if(alive&&response.ok&&result.ok)setPresence({...result.data,checked:Date.now()});
  }catch{if(alive)setPresence(null);}}
  void load();const timer=setInterval(load,20000);document.addEventListener('visibilitychange',load);
  return()=>{alive=false;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',load);};
 },[spotId,token,endpoint,canShare,changed]);
 if(!c)return null;
 const active=c.snapshot?.sessions.find(s=>s.status==='active');
 const finished=c.snapshot?.sessions.find(s=>s.spotId===spotId&&s.status==='confirmed');
 return <section className={styles.spot} aria-label="Sessione allo spot">
  {!active&&!choosing&&finished&&<SessionMood session={finished}/>}
  {presence&&presence.count>0&&Date.now()-presence.checked<30000&&presence.validUntil&&c.now<Date.parse(presence.validUntil)&&<p className={styles.presence}>{presence.count} rider hanno segnalato di essere qui<br/><small>Ultima segnalazione {presence.freshAt?new Date(presence.freshAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}):''} · Non verificata tramite GPS</small></p>}
  {active?<ActiveSession session={active}/>:!choosing?<button className={styles.primary} disabled={c.user===undefined||c.busy||Boolean(c.user&&!c.snapshot)} onClick={()=>{if(!c.user){requestSignIn();return;}setChoosing(true);}}><MapIcon name="play"/> Inizio sessione</button>:<form onSubmit={async e=>{e.preventDefault();if(await c.run({action:'start',spotId,visibility}))setChoosing(false);}}>
   <fieldset disabled={c.busy}><legend>Chi vede la tua presenza?</legend>
    <label><input type="radio" name={`visibility-${spotId}`} checked={visibility==='private'} onChange={()=>setVisibility('private')}/> Solo io</label>
    <label><input type="radio" name={`visibility-${spotId}`} checked={visibility==='community'} disabled={!c.snapshot?.canShare} onChange={()=>setVisibility('community')}/> Community{!c.snapshot?.canShare?' · pilot non abilitato':''}</label>
   </fieldset>
   <p className={styles.muted}>Tempo della sessione, non del movimento. Tra 2 ore servirà confermare la fine o rinnovare. Lo storico resta privato.</p>
   {visibility==='community'&&<p className={styles.muted}>Segnali la tua presenza in questo spot agli account autorizzati al pilot. Nessun percorso GPS.</p>}
   <div className={styles.actions}><button type="submit" className={styles.primary} disabled={c.busy}>{c.busy?'Avvio…':'Conferma e inizia'}</button><button type="button" disabled={c.busy} onClick={()=>setChoosing(false)}>Annulla</button></div>
  </form>}
  <SessionError/>
 </section>;
}

function ActiveSession({session:s}:{session:RiderSession}) {
 const c=useContext(Sessions)!;const expired=c.now>=Date.parse(s.deadlineAt);
 return <div className={styles.active}>
  <strong>{s.spotName}</strong><span className={styles.timer} aria-label="Durata della sessione">{sessionClock(sessionSeconds(s,c.now))}</span>
  {expired?<p>Fine da confermare. Il tempo è fermo.</p>:<>
   <p className={styles.muted}>{s.sharing?'Presenza Community':'Solo io'} · fino alle {new Date(s.deadlineAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</p>
   <div className={styles.actions}><button className={styles.primary} disabled={c.busy} onClick={()=>void c.run({action:'stop',id:s.id})}>Termina sessione</button>
    <button disabled={c.busy} onClick={()=>void c.run({action:'renew',id:s.id})}>Rinnova per 2 ore</button>
    {s.sharing&&<button disabled={c.busy} onClick={()=>void c.run({action:'hide',id:s.id})}>Nascondi presenza</button>}
   </div>
  </>}
 </div>;
}
export function SessionDock({onMap=false}:{onMap?:boolean}={}) {
 const pathname=usePathname();
 const c=useContext(Sessions);if(!c?.snapshot)return null;
 if(!onMap&&(pathname==='/'||pathname==='/map'))return null;
 if(pathname==='/impostazioni/privacy')return null;
 if(pathname&&/^\/u\/[^/]+\/?$/.test(pathname))return null;
 const active=c.snapshot.sessions.find(s=>s.status==='active'),pending=c.snapshot.sessions.filter(s=>s.status==='needs_confirmation').length;
 if(!active&&!pending)return null;
 return <aside className={`${styles.dock}${onMap?` ${styles.mapDock}`:''}`} aria-label="Sessione in corso">
  <Link href="/sessioni">{active?`${sessionClock(sessionSeconds(active,c.now))} · ${active.spotName}`:`${pending} sessioni da confermare`}</Link>
  {active&&c.now<Date.parse(active.deadlineAt)?<button disabled={c.busy} onClick={()=>void c.run({action:'stop',id:active.id})}>Termina sessione</button>:<Link href="/sessioni">Conferma fine</Link>}
  <SessionError/>
 </aside>;
}
export function RiderHistory({ownerId,compact=false}:{ownerId?:string;compact?:boolean}) {
 const c=useContext(Sessions);if(!c)return ownerId?null:<p>Sessioni non ancora disponibili.</p>;
 if(ownerId&&ownerId!==c.user?.id)return null;
 if(!c.user)return <button className={styles.primary} onClick={requestSignIn}>Accedi per le tue sessioni</button>;
 const pending=c.snapshot?.sessions.filter(s=>s.status==='needs_confirmation').length??0;
 return <section className={compact?styles.profileSummary:styles.history} aria-label="Le tue sessioni">
  {!compact&&<><h2>Le tue sessioni</h2><p className={styles.muted}>Storico privato · Fonte manuale</p></>}
  <SessionError/>
  {!c.snapshot?<p role="status">Caricamento sessioni…</p>:<>
   <div className={styles.totals}><span><strong>{sessionDuration(c.snapshot.confirmedSeconds)}</strong> Tempo di sessione</span><span><strong>{c.snapshot.confirmedCount}</strong> Sessioni</span></div>
   {compact?<>
    <div className={styles.profileLinks}><Link href="/sessioni">{c.snapshot.sessions.some(s=>s.status==='active')?'Sessione in corso':'Gestisci sessioni'}</Link>{pending>0&&<Link className={styles.warning} href="/sessioni">{pending} {pending===1?'sessione da confermare':'sessioni da confermare'}</Link>}</div>
    <details className={styles.profilePrivacy}><summary>Visibilità dei totali</summary><RiderStatsSharing key={c.user.id} user={c.user} endpoint={c.endpoint==='/api/rider-sessions-preview'?'/api/rider-stats-preview':'/api/rider-stats'}/></details>
   </>:<>
   <RiderStatsSharing key={c.user.id} user={c.user} endpoint={c.endpoint==='/api/rider-sessions-preview'?'/api/rider-stats-preview':'/api/rider-stats'}/>
   {c.snapshot.sessions.length===0&&<p>Non hai ancora registrato sessioni. <Link href="/">Trova uno spot</Link></p>}
   {c.snapshot.sessions.filter(s=>s.status!=='confirmed').map(s=><HistoryRow key={s.id} session={s}/>)}
   {c.snapshot.sessions.filter(s=>s.status==='confirmed').map(s=><HistoryRow key={s.id} session={s}/>)}
   </>}
  </>}
 </section>;
}
function localInput(value:string){const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,19);}
function SessionMood({session}:{session:RiderSession}) {
 const c=useContext(Sessions)!;
 const options=[{value:'sad',label:'Sessione difficile'},{value:'neutral',label:'Sessione così così'},{value:'happy',label:'Bella sessione'}] as const;
 return <div className={styles.moods} role="group" aria-label="Com’è andata la sessione? Risposta facoltativa e privata">
  {options.map(option=><button key={option.value} type="button" className={styles.mood} data-mood={option.value} aria-label={option.label} title={option.label} aria-pressed={session.mood===option.value} disabled={c.busy} onClick={()=>void c.run({action:'mood',id:session.id,mood:session.mood===option.value?null:option.value})}><MapIcon name={`face-${option.value}`} size={40}/></button>)}
 </div>;
}
function HistoryRow({session:s}:{session:RiderSession}) {
 const c=useContext(Sessions)!;const [editing,setEditing]=useState(false),[deleting,setDeleting]=useState(false);
 const [end,setEnd]=useState(localInput(s.endedAt||s.deadlineAt));const [error,setError]=useState('');
 useEffect(()=>{setEnd(localInput(s.endedAt||s.deadlineAt));},[s.endedAt,s.deadlineAt,s.version]);
 const pending=s.status==='needs_confirmation';
 async function save(e:React.FormEvent){e.preventDefault();const date=new Date(end);if(!Number.isFinite(date.getTime())){setError('Indica una data valida.');return;}setError('');if(await c.run({action:pending?'confirm':'edit',id:s.id,version:s.version,endedAt:date.toISOString()}))setEditing(false);}
 return <article className={styles.row}>
  {s.spotSlug&&s.spotStatus==='approved'?<Link href={`/?spot=${encodeURIComponent(s.spotSlug)}`}>{s.spotName}</Link>:<strong>{s.spotName}</strong>}
  {s.spotStatus==='pending'&&<p className={styles.muted}>Spot in attesa di approvazione · sessione privata</p>}
  <p className={styles.muted}>{new Date(s.startedAt).toLocaleString('it-IT')} · {sessionDuration(sessionSeconds(s,c.now))}</p>
  {s.status==='confirmed'&&<SessionMood session={s}/>}
  {s.status==='active'?<ActiveSession session={s}/>:<>
   {pending&&<p className={styles.warning}>Fine da confermare · esclusa dal totale</p>}
   {(pending||editing)&&<form onSubmit={save}>
    <label className={styles.end}>Fine sessione <input type="datetime-local" step="1" value={end} min={localInput(s.startedAt)} max={localInput(new Date(c.now).toISOString())} onChange={e=>setEnd(e.target.value)} required/></label>
    <small>Fuso orario: {Intl.DateTimeFormat().resolvedOptions().timeZone}</small>
    {error&&<p role="alert">{error}</p>}
    <div className={styles.actions}><button className={styles.primary} disabled={c.busy}>Conferma fine</button>{editing&&!pending&&<button type="button" onClick={()=>setEditing(false)}>Annulla</button>}</div>
   </form>}
   {!pending&&!editing&&<button disabled={c.busy} onClick={()=>setEditing(true)}>Correggi fine</button>}
  </>}
  {deleting?<div className={styles.actions}><span>Eliminare questa sessione?</span><button disabled={c.busy} onClick={()=>void c.run({action:'delete',id:s.id})}>Conferma eliminazione</button><button onClick={()=>setDeleting(false)}>Annulla</button></div>:<button className={styles.remove} disabled={c.busy} onClick={()=>setDeleting(true)}>Elimina sessione</button>}
 </article>;
}
