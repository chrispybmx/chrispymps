'use client';

import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useRiderSessions } from '@/components/RiderSessions';

const feedSchema = z.object({
 available:z.boolean(), serverNow:z.string().datetime({offset:true}),
 spots:z.array(z.object({spotId:z.string().uuid(),count:z.number().int().positive(),
  freshAt:z.string().datetime({offset:true}),validUntil:z.string().datetime({offset:true})})),
});
type Feed=z.infer<typeof feedSchema>;
type State={scope:string;data:Feed|null;error:boolean;received:number;elapsed:number};
export function useLiveSpots(enabled:boolean) {
 const context=useRiderSessions();
 const user=context?.user, endpoint=context?.endpoint??'/api/rider-sessions';
 const scope=`${endpoint}:${user?.id??''}:${user?.accessToken??''}`;
 const [state,setState]=useState<State|null>(null);
 const [,setTick]=useState(0),[retry,setRetry]=useState(0);
 // Refresh immediately after this rider starts, hides, renews or ends a session.
 const snapshot=context?.snapshot;
 useEffect(()=>{
  setState(null);
  if(!enabled||!user)return;
  let disposed=false,request:AbortController|null=null;
  const update=async()=>{
   if(document.hidden||!navigator.onLine){request?.abort();setState(null);return;}
   request?.abort();const controller=new AbortController();request=controller;
   const started=performance.now();
   const timeout=setTimeout(()=>controller.abort(),10000);
   try {
    const response=await fetch(`${endpoint}?live=1`,{headers:{Authorization:`Bearer ${user.accessToken}`},cache:'no-store',signal:controller.signal});
    const result=await response.json();
    if(!response.ok||!result.ok)throw new Error('Live unavailable');
    const data=feedSchema.parse(result.data);
    if(!disposed&&request===controller&&!controller.signal.aborted)setState({scope,data,error:false,received:performance.now(),elapsed:performance.now()-started});
   }catch{
    if(!disposed&&request===controller)setState({scope,data:null,error:true,received:0,elapsed:0});
   }finally{clearTimeout(timeout);}
  };
  const refresh=()=>void update();
  refresh();const poll=setInterval(refresh,20000),clock=setInterval(()=>setTick(n=>n+1),1000);
  window.addEventListener('focus',refresh);window.addEventListener('online',refresh);window.addEventListener('offline',refresh);
  document.addEventListener('visibilitychange',refresh);
  return()=>{disposed=true;request?.abort();clearInterval(poll);clearInterval(clock);
   window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);window.removeEventListener('offline',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[enabled,user?.id,user?.accessToken,endpoint,scope,retry,snapshot]);
 const current=enabled&&state?.scope===scope?state:null;
 // A short cache lifetime prevents stale presence remaining visible after connection loss.
 const elapsed=current?performance.now()-current.received+current.elapsed:Infinity;
 const data=current?.data;
 const now=data?Date.parse(data.serverNow)+elapsed:Infinity;
 const entries=enabled&&data?.available&&elapsed<30000?data.spots.filter(s=>Date.parse(s.validUntil)>now):[];
 // Keep marker identities stable between expiry ticks.
 const key=JSON.stringify(entries);
 const spots=useMemo(()=>JSON.parse(key) as Feed['spots'],[key]);
 const counts=useMemo(()=>Object.fromEntries(spots.map(s=>[s.spotId,s.count])),[spots]);
 const status=!enabled?'off':!context?'error':user===undefined?'loading':!user?'signin':current?.error?'error':!data?'loading':!data.available?'restricted':elapsed>=30000?'error':'ready';
 return {spots,counts,status,retry:()=>setRetry(n=>n+1)};
}
