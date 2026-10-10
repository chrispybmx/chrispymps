'use client';
import {useEffect,useRef,useState} from 'react';
import {COUNTRY_CODES,disciplineChoices} from '@/lib/registration';
import {DISCIPLINE} from '@/lib/rider-profile';

export default function RiderPreferences({token}:{token:string}) {
 const [country,setCountry]=useState(''),[sports,setSports]=useState<string[]>([]);
 const [loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [retry,setRetry]=useState(0);const saving=useRef(false);
 const names=new Intl.DisplayNames(['it'],{type:'region'});
 const countries=COUNTRY_CODES.map(code=>({code,label:names.of(code)||code})).sort((a,b)=>a.label.localeCompare(b.label,'it'));
 useEffect(()=>{
  const controller=new AbortController();setLoaded(false);setMessage('');
  void fetch('/api/rider/details',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal}).then(async r=>{
   const result=await r.json();if(!r.ok||!result.ok)throw new Error();
   if(controller.signal.aborted)return;
   setCountry(result.data?.country_code||'');setSports((result.data?.disciplines||[]).filter((s:string)=>disciplineChoices.includes(s as typeof disciplineChoices[number])));setLoaded(true);
  }).catch(()=>{if(!controller.signal.aborted)setMessage('Preferenze non disponibili. Riprova.');});
  return()=>controller.abort();
 },[token,retry]);
 async function save(){
  if(saving.current)return;saving.current=true;setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/rider/details',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({countryCode:country||null,disciplines:sports}),signal:AbortSignal.timeout(12000)});
   const result=await response.json();if(!response.ok||!result.ok)throw new Error();setMessage('Preferenze salvate.');
  }catch{setMessage('Salvataggio non riuscito. Riprova.');}
  finally{saving.current=false;setBusy(false);}
 }
 return <section aria-label="Sport e Paese" style={{padding:'24px 0',borderTop:'1px solid var(--gray-700)'}}>
  <h2 style={{fontSize:18,margin:'0 0 16px'}}>Sport e Paese</h2>
  {loaded?<fieldset disabled={busy} style={{border:0,padding:0,margin:0}}>
   <label htmlFor="rider-country">Paese di residenza (privato)</label>
   <select id="rider-country" value={country} onChange={e=>setCountry(e.target.value)} style={{display:'block',width:'100%',height:44,padding:'0 8px',margin:'8px 0 16px',background:'var(--gray-800)',color:'var(--bone)',fontSize:16,border:'1px solid var(--gray-600)',borderRadius:4}}>
    <option value="">Non indicato</option>{countries.map(c=><option key={c.code} value={c.code}>{c.label}</option>)}
   </select>
   <fieldset style={{border:0,padding:0,margin:'0 0 16px'}}><legend>Sport praticati</legend>
    <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8}}>{DISCIPLINE.map(d=><label key={d.key} style={{display:'flex',alignItems:'center',gap:8,minHeight:44}}><input type="checkbox" style={{accentColor:'var(--orange)',width:18,height:18}} checked={sports.includes(d.key)} onChange={e=>setSports(s=>e.target.checked?[...s,d.key]:s.filter(k=>k!==d.key))}/>{d.label}</label>)}</div>
   </fieldset>
   <button type="button" className="btn-primary" onClick={()=>void save()}>{busy?'Salvataggio...':'Salva preferenze'}</button>
  </fieldset>:!message?<p>Caricamento...</p>:<button type="button" onClick={()=>setRetry(n=>n+1)}>Riprova</button>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
