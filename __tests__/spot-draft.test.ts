import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { readSpotDraft, saveSpotDraft, deleteSpotDraft, type SpotDraft } from '@/lib/spot-draft';
const draft = (): SpotDraft => ({ updatedAt: Date.now(), step:'dettagli', lat:45,lon:11,city:'Verona',country:'Italia',countryCode:'IT',name:'Rail',type:'rail',ostacoli:['rail'],description:'Tre gradini',notes:'',difficulty:'',photos:[] });
beforeEach(() => { Object.defineProperty(globalThis,'indexedDB',{value:new IDBFactory(),configurable:true}); });
describe('local contribution recovery', () => {
 it('keeps form data across storage reads', async()=>{await saveSpotDraft('rider-a',draft());expect((await readSpotDraft('rider-a'))?.name).toBe('Rail');});
 it('does not restore another account’s draft',async()=>{await saveSpotDraft('rider-a',draft());expect(await readSpotDraft('rider-b')).toBeNull();});
 it('serializes writes so a late older save cannot replace a newer draft',async()=>{const first=saveSpotDraft('rider-a',{...draft(),name:'Prima'});const second=saveSpotDraft('rider-a',{...draft(),name:'Seconda'});await Promise.all([first,second]);expect((await readSpotDraft('rider-a'))?.name).toBe('Seconda');});
 it('deletion follows pending writes and cannot resurrect the draft',async()=>{const pending=saveSpotDraft('rider-a',draft());const deleted=deleteSpotDraft('rider-a');await Promise.all([pending,deleted]);expect(await readSpotDraft('rider-a')).toBeNull();});
 it('does not recover an expired draft',async()=>{await saveSpotDraft('rider-a',{...draft(),updatedAt:Date.now()-8*86400000});expect(await readSpotDraft('rider-a')).toBeNull();});
 it('preserves photo binary content in structured storage',async()=>{const photo=new Blob(['photo-data'],{type:'image/jpeg'}) as File;await saveSpotDraft('rider-a',{...draft(),photos:[photo]});const restored=await readSpotDraft('rider-a');expect(await restored?.photos[0].text()).toBe('photo-data');});
});
