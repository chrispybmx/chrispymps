'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { RiderSessionsProvider,RiderHistory,SpotSession } from '@/components/RiderSessions';
import { PREVIEW_ACTOR,PREVIEW_SPOT,PREVIEW_TOKEN } from '@/lib/rider-preview';
import type { SpotMapPin } from '@/lib/types';
import styles from './preview.module.css';
const SpotMap=dynamic(()=>import('@/components/SpotMap'),{ssr:false});
const user={id:PREVIEW_ACTOR,username:'rider_demo',email:'demo@localhost',accessToken:PREVIEW_TOKEN};
const pins:SpotMapPin[]=[{id:PREVIEW_SPOT,name:'Spot demo Barcellona',slug:'demo-barcellona',type:'plaza',lat:41.383,lon:2.167,condition:'alive'}];
export default function SessionPreview(){
 const [view,setView]=useState<'spot'|'profile'>('spot');const [generation,setGeneration]=useState(0);const [error,setError]=useState('');
 async function expire(){try{const r=await fetch('/api/rider-sessions-preview',{method:'POST',headers:{Authorization:`Bearer ${PREVIEW_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({demoExpire:true})});if(!r.ok)throw new Error();setGeneration(x=>x+1);setView('profile');}catch{setError('Simulazione non riuscita.');}}
 return <RiderSessionsProvider key={generation} user={user} endpoint="/api/rider-sessions-preview">
  <main className={styles.page}>
   <header className={styles.header}><strong>Maps / Sessioni</strong><span>Anteprima locale · account e spot di prova</span></header>
   <div className={styles.layout}>
    <div className={styles.map}><SpotMap spots={pins} filterType={null} searchQuery="" initialView={{lat:41.383,lon:2.167,zoom:15}} selectedPin={pins[0]} onSpotClick={()=>setView('spot')} onAddSpotAt={()=>{}} /></div>
    <section className={styles.panel}>
     <nav aria-label="Anteprima"><button aria-pressed={view==='spot'} onClick={()=>setView('spot')}>Spot</button><button aria-pressed={view==='profile'} onClick={()=>setView('profile')}>Profilo rider</button></nav>
     {view==='spot'?<><h1>Spot demo Barcellona</h1><p>Plaza · BMX</p><SpotSession spotId={PREVIEW_SPOT}/></>:<><h1>@rider_demo</h1><RiderHistory ownerId={PREVIEW_ACTOR}/></>}
     <details className={styles.test}><summary>Controlli di collaudo locale</summary><p>Database temporaneo isolato. Nessun utente reale, email o dato di produzione.</p><button onClick={()=>void expire()}>Simula scadenza con app chiusa</button>{error&&<p role="alert">{error}</p>}</details>
    </section>
   </div>
  </main>
 </RiderSessionsProvider>;
}
