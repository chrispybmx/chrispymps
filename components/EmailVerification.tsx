'use client';
import {useCallback,useEffect,useRef,useState} from 'react';

export default function EmailVerification({token}:{token:string}) {
 const [state,setState]=useState<{verified:boolean;enabled:boolean}|null>(null);
 const [busy,setBusy]=useState(false),[cooldown,setCooldown]=useState(false);
 const [error,setError]=useState(''),[sent,setSent]=useState(false);
 const inFlight=useRef(false);
 const read=useCallback(async(signal?:AbortSignal)=>{
  try{
   const r=await fetch('/api/auth/email-verification',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal});
   const result=await r.json();if(!r.ok||!result.ok)throw new Error();
   if(!signal?.aborted){setState(result);setError('');}
  }catch{if(!signal?.aborted)setError('Stato email non disponibile. Riprova.');}
 },[token]);
 useEffect(()=>{
  const controller=new AbortController();setState(null);void read(controller.signal);
  const focus=()=>void read(controller.signal);window.addEventListener('focus',focus);
  return()=>{controller.abort();window.removeEventListener('focus',focus);};
 },[read]);
 useEffect(()=>{if(!cooldown)return;const timer=setTimeout(()=>setCooldown(false),60000);return()=>clearTimeout(timer);},[cooldown]);
 async function send(){
  if(inFlight.current||cooldown)return;inFlight.current=true;setBusy(true);setError('');
  try{
   const r=await fetch('/api/auth/email-verification',{method:'POST',headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(12000)});
   const result=await r.json();if(!r.ok||!result.ok)throw new Error(result.error||'Invio non riuscito.');
   if(result.verified)setState({verified:true,enabled:true});else {setSent(true);setCooldown(true);}
  }catch(e){setError(e instanceof Error?e.message:'Invio non riuscito.');}
  finally{inFlight.current=false;setBusy(false);}
 }
 return <section aria-label="Verifica email" style={{padding:'24px 0',borderTop:'1px solid var(--gray-700)'}}>
  <h2 style={{fontSize:18,margin:'0 0 12px'}}>Email</h2>
  <p role="status">{state?.verified?'Email verificata':state?state.enabled?'Email da verificare':'Verifica email in preparazione.':'Verifica in corso...'}</p>
  {state&&!state.verified&&state.enabled&&<button type="button" className="btn-primary" disabled={busy||cooldown} onClick={()=>void send()}>{busy?'Invio...':cooldown?'Attendi un minuto':sent?'Invia un altro link':'Verifica email'}</button>}
  {sent&&!state?.verified&&<p>Controlla la tua casella e conferma il link. Guarda anche nello spam.</p>}
  {error&&<><p role="alert">{error}</p><button type="button" onClick={()=>void read()}>Riprova</button></>}
 </section>;
}
