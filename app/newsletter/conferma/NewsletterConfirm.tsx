'use client';
import { useEffect,useState } from 'react';
import { NEWSLETTER_CONSENT_TEXT } from '@/lib/newsletter-consent';
export default function NewsletterConfirm(){
 const [token,setToken]=useState('');const [loaded,setLoaded]=useState(false);const [busy,setBusy]=useState(false);const [done,setDone]=useState(false);const [message,setMessage]=useState('');
 useEffect(()=>{setToken(window.location.hash.slice(1));setLoaded(true);},[]);
 async function confirm(){
  setBusy(true);setMessage('');
  try{const response=await fetch('/api/newsletter/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),referrerPolicy:'no-referrer'});const data=await response.json();if(!response.ok || !data.ok)throw new Error(data.error||'Riprova più tardi.');setDone(true);setMessage(data.message);window.history.replaceState(null,'',window.location.pathname);}
  catch(error){setMessage(error instanceof Error?error.message:'Conferma non riuscita.');}finally{setBusy(false);}
 }
 return <><p style={{fontSize:16,lineHeight:1.6}}>{NEWSLETTER_CONSENT_TEXT} <a href="/privacy#newsletter">Informativa privacy</a>.</p>
 {!loaded?<p>Caricamento…</p>:!token?<p>Apri il link ricevuto via email. Nessuna iscrizione è stata confermata.</p>:!done?<button className="btn-primary" disabled={busy} onClick={confirm}>{busy?'Conferma in corso…':'Conferma iscrizione'}</button>:null}
 {message&&<p role="status" style={{lineHeight:1.6}}>{message}</p>}<p><a href="/">Torna alla mappa</a></p></>;
}
