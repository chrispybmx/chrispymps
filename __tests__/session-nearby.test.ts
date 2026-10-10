import { expect,it } from 'vitest';
import { sessionNearby,sessionStartCandidates } from '@/lib/session-nearby';
import type { SpotMapPin } from '@/lib/types';

it('returns only spots within 500 metres, nearest first',()=>{
 const spots=[0.004,0.02,0.001].map((lat,i)=>({id:String(i),slug:String(i),name:'Spot',lat,lon:0,type:'street',condition:'alive'} as SpotMapPin));
 expect(sessionNearby(spots,{lat:0,lon:0}).map(s=>s.spot.id)).toEqual(['2','0']);
});

it('offers only the nearest spot and shows alternatives only after a manual search',()=>{
 const spots=[0.004,0.001].map((lat,i)=>({id:String(i),slug:String(i),name:`Spot ${i}`,city:'Verona',lat,lon:0,type:'street',condition:'alive'} as SpotMapPin));
 const nearby=sessionNearby(spots,{lat:0,lon:0});
 expect(sessionStartCandidates(spots,nearby,null).map(s=>s.spot.id)).toEqual(['1']);
 expect(sessionStartCandidates(spots,[],null)).toEqual([]);
 expect(sessionStartCandidates(spots,nearby,'  ')).toEqual([]);
 expect(sessionStartCandidates(spots,nearby,'spot 0').map(s=>s.spot.id)).toEqual(['0']);
 expect(sessionStartCandidates(spots,nearby,' VERONA ')).toHaveLength(2);
});

it('handles no nearby spots and stable distance ties',()=>{
 expect(sessionNearby([],{lat:0,lon:0})).toEqual([]);
 const spot={slug:'spot',name:'Spot',lat:0,lon:0,type:'street',condition:'alive'} as SpotMapPin;
 expect(sessionNearby([{...spot,id:'b'},{...spot,id:'a'}],{lat:0,lon:0}).map(s=>s.spot.id)).toEqual(['a','b']);
 expect(sessionNearby([{...spot,id:'far',lat:1}],{lat:0,lon:0})).toEqual([]);
});
