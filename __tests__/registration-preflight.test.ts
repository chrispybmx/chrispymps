import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/registration-check/route';
const fetcher=vi.fn();
const valid={birthDate:'2000-01-01',countryCode:'IT',disciplines:['mtb']};
const req=(body:unknown=valid)=>new NextRequest('https://maps.chrispybmx.com/api/auth/registration-check',{method:'POST',body:JSON.stringify(body)});
beforeEach(()=>{vi.stubGlobal('fetch',fetcher);fetcher.mockReset();fetcher.mockResolvedValue(Response.json({mailer_autoconfirm:false,external:{email:true}}));});
afterEach(()=>vi.unstubAllGlobals());
describe('signup preflight',()=>{
 it('allows only an email provider configured for confirmation',async()=>{const r=await POST(req());expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toBe('no-store');});
 it.each([{mailer_autoconfirm:true,external:{email:true}},{mailer_autoconfirm:false,external:{email:false}},{}])('fails closed for settings %j',async settings=>{fetcher.mockResolvedValue(Response.json(settings));expect((await POST(req())).status).toBe(503);});
 it('rejects invalid age before calling any provider',async()=>{expect((await POST(req({...valid,birthDate:'2020-01-01'}))).status).toBe(422);expect(fetcher).not.toHaveBeenCalled();});
 it('handles unavailable settings without leaking provider errors',async()=>{fetcher.mockRejectedValue(new Error('secret'));const r=await POST(req());expect(r.status).toBe(503);expect(await r.text()).not.toContain('secret');});
 it('rejects malformed and oversized requests',async()=>{expect((await POST(new NextRequest('https://example.com',{method:'POST',body:'{'}))).status).toBe(400);expect((await POST(req({value:'x'.repeat(17000)}))).status).toBe(413);expect(fetcher).not.toHaveBeenCalled();});
});
