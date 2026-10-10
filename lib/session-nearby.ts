import { distanceKm } from './nearby-radar';
import type { SpotMapPin } from './types';
export const SESSION_NEARBY_KM=0.5;
export function sessionNearby(spots:SpotMapPin[],origin:{lat:number;lon:number}){
 return spots.map(spot=>({spot,km:distanceKm(origin,spot)})).filter(s=>s.km<=SESSION_NEARBY_KM).sort((a,b)=>a.km-b.km||a.spot.id.localeCompare(b.spot.id));
}

export function sessionStartCandidates(spots:SpotMapPin[],nearby:ReturnType<typeof sessionNearby>,query:string|null):{spot:SpotMapPin;km:number|null}[]{
 if(query===null)return nearby.slice(0,1);
 const search=query.trim().toLocaleLowerCase();
 if(!search)return [];
 return spots.filter(s=>`${s.name} ${s.city??''}`.toLocaleLowerCase().includes(search)).slice(0,20).map(spot=>({spot,km:null}));
}
