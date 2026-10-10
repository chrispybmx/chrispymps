import { z } from 'zod';
export interface RiderSession {
 id:string; spotId:string|null; spotName:string; spotSlug:string|null; spotStatus?:string;
 startedAt:string; deadlineAt:string; endedAt:string|null;
 status:'active'|'needs_confirmation'|'confirmed'; visibility:'private'|'community';
 source:'manual'; version:number; sharing:boolean; mood:'sad'|'neutral'|'happy'|null;
}
export interface RiderSnapshot {
 serverNow:string; canShare:boolean; confirmedCount:number; confirmedSeconds:number; sessions:RiderSession[];
}
const id=z.string().uuid();
export const riderCommand=z.union([
 z.object({action:z.literal('mood'),id,mood:z.enum(['sad','neutral','happy']).nullable()}).strict(),
 z.object({action:z.literal('start'),spotId:id,visibility:z.enum(['private','community']).default('private')}).strict(),
 z.object({action:z.enum(['stop','renew','hide','delete']),id}).strict(),
 z.object({action:z.enum(['confirm','edit']),id,version:z.number().int().positive(),endedAt:z.string().datetime({offset:true})}).strict(),
]);
export const riderRequest=z.object({requestId:id,command:riderCommand}).strict();
export type RiderCommand=z.infer<typeof riderCommand>;
// Session duration, never an estimate of movement or riding time.
export function sessionSeconds(session:RiderSession,now:number):number {
 const end=session.endedAt?Date.parse(session.endedAt):Math.min(now,Date.parse(session.deadlineAt));
 return Math.max(0,Math.floor((end-Date.parse(session.startedAt))/1000));
}
export function sessionDuration(seconds:number):string {
 return `${Math.floor(seconds/3600)} h ${Math.floor(seconds%3600/60)} min`;
}
export function sessionClock(seconds:number):string {
 return [Math.floor(seconds/3600),Math.floor(seconds%3600/60),Math.floor(seconds%60)].map(n=>String(n).padStart(2,'0')).join(':');
}
