'use client';
import { useEffect,useMemo,useRef,useState } from 'react';
import Link from 'next/link';
import type { SpotMapPin } from '@/lib/types';
import { sessionNearby,sessionStartCandidates } from '@/lib/session-nearby';
import { requestSignIn } from '@/lib/auth-navigation';
import { SessionCurrent,useRiderSessions } from './RiderSessions';
import MapIcon from './MapIcon';
import styles from './NearbySessionStart.module.css';

type Point={lat:number;lon:number};
export default function NearbySessionStart({spots,onClose,onStarted,onAddSpot,addedSpot}:{
 spots:SpotMapPin[];onClose:()=>void;onStarted:(spot:SpotMapPin)=>void;
 onAddSpot:(point?:Point)=>void;addedSpot?:SpotMapPin|null;
}) {
 const c=useRiderSessions();
 const [origin,setOrigin]=useState<Point|null>(null),[locating,setLocating]=useState(true);
 const [locationError,setLocationError]=useState(''),[query,setQuery]=useState('');
 const [manual,setManual]=useState(false),[visibility,setVisibility]=useState<'private'|'community'>('private');
 const [draft,setDraft]=useState(false),[name,setName]=useState(''),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const [draftSpot,setDraftSpot]=useState<SpotMapPin|null>(null);
 const draftId=useRef<string|null>(null),busy=useRef(false);
 const active=c?.snapshot?.sessions.find(s=>s.status==='active');
 const pending=c?.snapshot?.sessions.find(s=>s.status==='needs_confirmation');
 const ready=!!c&&c.user!==undefined&&(!c.user||!!c.snapshot);
 useEffect(()=>{
  if(!ready||active||pending)return;
  let alive=true;
  if(!navigator.geolocation){setLocationError('Posizione non disponibile. Puoi cercare lo spot per nome.');setLocating(false);setManual(true);return;}
  navigator.geolocation.getCurrentPosition(position=>{
   if(!alive)return;setOrigin({lat:position.coords.latitude,lon:position.coords.longitude});setLocating(false);
   if(position.coords.accuracy>500)setLocationError('Posizione poco precisa: controlla lo spot prima di iniziare.');
  },()=>{if(alive){setLocationError('Posizione non disponibile. Cerca lo spot per nome.');setLocating(false);setManual(true);}},{enableHighAccuracy:true,timeout:10000,maximumAge:0});
  return()=>{alive=false;};
 // Existing active sessions reopen their timer without another location request.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[ready,active?.id,pending?.id]);
 const nearby=useMemo(()=>origin?sessionNearby(spots,origin):[],[spots,origin]);
 const candidates=sessionStartCandidates(spots,nearby,manual?query:null);
 const pendingSpot=addedSpot||draftSpot;
 const isPreview=c?.endpoint==='/api/rider-sessions-preview';
 async function start(spot:SpotMapPin,pending=false){
  if(!c?.user){requestSignIn();return;}
  if(await c.run({action:'start',spotId:spot.id,visibility:pending?'private':visibility})){if(!pending)onStarted(spot);}
 }
 async function addDraft(event:React.FormEvent){
  event.preventDefault();if(!origin||!c?.user||busy.current)return;
  busy.current=true;setSaving(true);setError('');
  if(!draftId.current)draftId.current=crypto.randomUUID();
  try{
   const response=await fetch(c.endpoint,{method:'POST',headers:{Authorization:`Bearer ${c.user.accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({demoDraft:{id:draftId.current,name:name.trim(),...origin}}),signal:AbortSignal.timeout(12000)});
   const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'Spot non salvato. Riprova.');
   setDraftSpot(result.spot);setDraft(false);
  }catch(e){setError(e instanceof Error?e.message:'Errore di connessione.');}
  finally{busy.current=false;setSaving(false);}
 }
 return <section className={styles.panel} aria-label="Inizia una sessione">
  <header><h2>{active?'Sessione in corso':pending?'Fine da confermare':'Vai in sessione'}</h2><button type="button" onClick={onClose} aria-label="Torna alla mappa" title="Torna alla mappa"><MapIcon name="close"/></button></header>
  {!c?<p>Le sessioni non sono ancora disponibili.</p>:active?<><SessionCurrent/><Link href="/sessioni">Gestisci sessioni</Link></>:pending?<><p role="status">Il timer è fermo. La sessione non è ancora inclusa nei totali.</p><Link href="/sessioni">Conferma fine</Link></>:<>
   {c.user===null&&<button onClick={requestSignIn}>Accedi per iniziare</button>}
   {!pendingSpot&&<fieldset disabled={c.busy}><legend>Presenza allo spot</legend><label><input type="radio" name="nearby-visibility" checked={visibility==='private'} onChange={()=>setVisibility('private')}/> Solo io</label><label><input type="radio" name="nearby-visibility" checked={visibility==='community'} disabled={!c.snapshot?.canShare} onChange={()=>setVisibility('community')}/> Community</label></fieldset>}
   {locating&&!pendingSpot&&<p role="status">Cerco lo spot più vicino…</p>}
   {locationError&&!pendingSpot&&<p className={styles.muted}>{locationError}</p>}
   {pendingSpot?<>
    <h3>{pendingSpot.name}</h3><p className={styles.muted}>{isPreview?'Bozza locale di prova':'Spot in attesa di approvazione'}. La sessione resta privata.</p>
    <button className={styles.primary} disabled={c.busy||!c.snapshot} onClick={()=>void start(pendingSpot,true)}>Inizia sessione</button>
   </>:<>
    {!locating&&!manual&&!query&&<h3>{nearby.length?'Sei qui?':'Nessuno spot entro 500 m'}</h3>}
    {manual&&<label className={styles.search}>Cerca uno spot<input autoFocus type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome o città"/></label>}
    {!locating&&candidates.map(({spot,km},index)=><button className={styles.candidate} key={spot.id} disabled={c.busy||Boolean(c.user&&!c.snapshot)} onClick={()=>void start(spot)}><MapIcon name="play"/><span><strong>{spot.name}</strong><small>{km===null?(spot.city??''):`${Math.round(km*1000)} m in linea d’aria${index===0?' · Il più vicino':''}`}</small></span><span>Inizia</span></button>)}
    {!locating&&!candidates.length&&manual&&query.trim()&&<p>Nessuno spot trovato.</p>}
    {!locating&&!manual&&<button onClick={()=>setManual(true)}>{nearby.length?'Non è questo?':'Cerca uno spot'}</button>}
    <p className={styles.muted}>Scegli lo spot per avviare il timer. Nessuna presenza GPS verificata.</p>
    {draft?<form onSubmit={addDraft}>
     <label className={styles.search}>Nome dello spot<input autoFocus required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
     <p className={styles.muted}>Bozza locale nella posizione rilevata, non pubblicata nella community.</p>
     <button className={styles.primary} disabled={saving||!origin}>{saving?'Salvataggio…':'Aggiungi spot'}</button><button type="button" disabled={saving} onClick={()=>setDraft(false)}>Annulla</button>
    </form>:<button className={styles.primary} onClick={()=>{if(isPreview){if(!origin){setError('Per la bozza locale serve la posizione: abilitala nel browser e riapri Vai in sessione.');return;}setDraft(true);}else onAddSpot(origin??undefined);}}><MapIcon name="plus"/> Lo spot manca? Aggiungi spot</button>}
   </>}
  </>}
  {(error||c?.error)&&<p role="alert" className={styles.error}>{error||c?.error}</p>}
 </section>;
}
