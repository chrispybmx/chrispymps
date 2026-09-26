'use client';
import { useEffect,useState } from 'react';
import { NEWSLETTER_CONSENT_TEXT,NEWSLETTER_CONSENT_VERSION } from '@/lib/newsletter-consent';
type Status={enabled:boolean;requested:boolean;pending:boolean;suppressed:boolean};
export default function NewsletterPreferences({token}:{token:string}){
 const [status,setStatus]=useState<Status|null>(null);const [checked,setChecked]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController();setMessage('');fetch('/api/newsletter/preferences',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok || !data.ok)throw new Error(data.error||'Preferenze non disponibili.');setStatus(data);setChecked(data.pending?data.requested:data.enabled);}).catch(error=>{if(!controller.signal.aborted)setMessage(error.message);});return()=>controller.abort();},[token,retry]);
 async function save(){setBusy(true);setMessage('');try{const response=await fetch('/api/newsletter/preferences',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({enabled:checked,...(checked?{over16:true,consentVersion:NEWSLETTER_CONSENT_VERSION}:{})})});const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||'Scelta non salvata.');setMessage(data.message);setStatus(previous=>({...previous!,requested:checked,pending:data.pending,enabled:data.pending?previous!.enabled:checked}));}catch(error){setMessage(error instanceof Error?error.message:'Scelta non salvata.');}finally{setBusy(false);}}
 return <section style={{marginTop:32,paddingTop:24,borderTop:'1px solid var(--gray-600)'}} aria-labelledby="newsletter-preferences-title">
 <h2 id="newsletter-preferences-title" style={{fontSize:22}}>Newsletter BMX</h2><p style={{lineHeight:1.5}}>La newsletter è facoltativa. Puoi usare la mappa anche senza riceverla.</p>
 {status?<><p>Stato MailerLite: {status.enabled?'iscritto':'non iscritto'}{status.pending?' · modifica in attesa':''}.</p>
 <label style={{display:'flex',gap:12,lineHeight:1.6,margin:'16px 0'}}><input type="checkbox" checked={checked} disabled={busy} onChange={event=>setChecked(event.target.checked)}/><span>{NEWSLETTER_CONSENT_TEXT} <a href="/privacy#newsletter">Leggi l’informativa</a>.</span></label>
 {status.suppressed&&<p>Questo indirizzo risulta disiscritto o bloccato su MailerLite. Non lo riattiviamo automaticamente. Per una nuova iscrizione scrivi a <a href="mailto:christian.ceresato@gmail.com">Christian</a>.</p>}
 <button type="button" className="btn-primary" disabled={busy||(checked&&status.suppressed)} onClick={save}>{busy?'Salvataggio…':checked?'Salva consenso':'Disattiva newsletter'}</button></>:!message?<p role="status">Verifico lo stato…</p>:null}
 {message&&<p role="status">{message}</p>}<p><button type="button" className="btn-ghost" disabled={busy} onClick={()=>setRetry(n=>n+1)}>Aggiorna stato</button></p>
 </section>;
}
