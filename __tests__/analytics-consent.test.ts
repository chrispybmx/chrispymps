import { afterEach, expect, it, vi } from 'vitest';
import { ANALYTICS_CONSENT_KEY, ANALYTICS_CONSENT_EVENT, analyticsAllowed, analyticsChoice, hasAnalyticsChoice, saveAnalyticsChoice } from '@/lib/analytics-consent';
import { trackMetric } from '@/lib/product-metrics';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('remembers refusal without treating it as consent and ignores the old notice',()=>{
 vi.stubGlobal('window',{localStorage:{getItem:()=>null}});
 expect(hasAnalyticsChoice()).toBe(false);
 vi.stubGlobal('window',{localStorage:{getItem:()=>JSON.stringify({accepted:false,at:Date.now()})}});
 expect(hasAnalyticsChoice()).toBe(true);expect(analyticsAllowed()).toBe(false);
 vi.stubGlobal('window',{localStorage:{getItem:()=> '1'}});
 expect(hasAnalyticsChoice()).toBe(false);
});
it('notifies the current page only after a choice is saved',()=>{
 const setItem=vi.fn(),dispatchEvent=vi.fn();
 vi.stubGlobal('window',{localStorage:{setItem},dispatchEvent});
 expect(saveAnalyticsChoice(false)).toBe(true);
 expect(JSON.parse(setItem.mock.calls[0][1]).accepted).toBe(false);
 expect(dispatchEvent.mock.calls[0][0].type).toBe(ANALYTICS_CONSENT_EVENT);
 setItem.mockImplementation(()=>{throw new Error('blocked');});dispatchEvent.mockClear();
 expect(saveAnalyticsChoice(true)).toBe(false);expect(dispatchEvent).not.toHaveBeenCalled();
});
it('reads only well-formed choices; a refusal never expires',()=>{
 const now=Date.now();
 for(const value of [null,'1','invalid',JSON.stringify({accepted:true,at:now+1}),JSON.stringify({accepted:true,at:now-181*86400000})])expect(analyticsChoice(value,now)).toBeNull();
 expect(analyticsChoice(JSON.stringify({accepted:true,at:now}),now)).toBe(true);
 expect(analyticsChoice(JSON.stringify({accepted:false,at:now-400*86400000}),now)).toBe(false);
});
it('counts anonymous visits by default until this device refuses',()=>{
 vi.stubGlobal('navigator',{});
 vi.stubGlobal('window',{localStorage:{getItem:()=>null}});
 expect(analyticsAllowed()).toBe(true);
 vi.stubGlobal('window',{localStorage:{getItem:()=>JSON.stringify({accepted:false,at:Date.now()-400*86400000})}});
 expect(analyticsAllowed()).toBe(false);
});
it('fails closed without storage and respects privacy signals',()=>{
 vi.stubGlobal('navigator',{});vi.stubGlobal('window',{localStorage:{getItem:()=>{throw new Error('blocked');}}});
 expect(analyticsAllowed()).toBe(false);
 vi.stubGlobal('window',{localStorage:{getItem:()=>JSON.stringify({accepted:true,at:Date.now()})}});
 vi.stubGlobal('navigator',{globalPrivacyControl:true});expect(analyticsAllowed()).toBe(false);
 vi.stubGlobal('navigator',{doNotTrack:'1'});expect(analyticsAllowed()).toBe(false);
});
it('sends metrics by default and stops immediately on refusal',()=>{
 let accepted:boolean|null=false;
 vi.stubGlobal('navigator',{});
 const getItem=vi.fn(()=>accepted===null?null:JSON.stringify({accepted,at:Date.now()}));
 vi.stubGlobal('window',{localStorage:{getItem}});
 vi.stubEnv('NEXT_PUBLIC_PRODUCT_METRICS_ENABLED','true');
 const fetch=vi.fn().mockResolvedValue({ok:true});vi.stubGlobal('fetch',fetch);
 trackMetric('spot_view','detail');expect(fetch).not.toHaveBeenCalled();
 accepted=null;trackMetric('spot_view','detail');expect(fetch).toHaveBeenCalledTimes(1);
 expect(getItem).toHaveBeenCalledWith(ANALYTICS_CONSENT_KEY);
 accepted=false;trackMetric('spot_view','detail');expect(fetch).toHaveBeenCalledTimes(1);
});
