import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), limit: vi.fn(), admin: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: () => ({ rpc: mocks.rpc }) }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.limit }));
vi.mock('@/lib/auth', () => ({ isAdminAuthenticated: mocks.admin }));
import { POST } from '@/app/api/product-metrics/route';
import { POST as retired } from '@/app/api/funnel/route';
import { GET as report } from '@/app/api/admin/product-metrics/route';
import { GET as purge } from '@/app/api/internal/product-metrics-retention/route';
import { trackMetric, validMetric } from '@/lib/product-metrics';
import { TracciaFunnel } from '@/lib/funnel';
const payload = { event: 'search_used', source: 'map' };
function request(body: unknown = payload, headers: Record<string, string> = {}) {
  return new NextRequest('https://maps.chrispybmx.com/api/product-metrics', {
    method: 'POST', headers: { origin: 'https://maps.chrispybmx.com', 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('PRODUCT_METRICS_ENABLED', 'true');
  mocks.limit.mockResolvedValue({ allowed: true }); mocks.admin.mockReturnValue(false);
  mocks.rpc.mockReturnValue({ abortSignal: vi.fn().mockResolvedValue({ error: null }) });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('aggregate ingestion boundaries', () => {
  it('does not read/write anything when disabled', async () => {
    vi.stubEnv('PRODUCT_METRICS_ENABLED', 'false');
    expect((await POST(request())).status).toBe(204); expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.limit).not.toHaveBeenCalled();
  });
  it('passes only the fixed event and source to storage', async () => {
    expect((await POST(request())).status).toBe(204);
    expect(mocks.rpc).toHaveBeenCalledWith('cm_increment_product_metric', { p_event: 'search_used', p_source: 'map' });
    expect(mocks.limit).toHaveBeenCalledWith('product-metrics:global', 300, 60000);
  });
  it.each([null, [], {}, { ...payload, email: 'person@example.com' }, { ...payload, query: 'roma' }, { ...payload, lat: 45 }, { event: 'toString', source: 'map' }, { event: 'spot_view', source: 'add' }])('rejects unapproved data %j', async body => {
    expect((await POST(request(body))).status).toBe(400); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each<Record<string,string>>([{ origin: '' }, { origin: 'https://other.example' }, { 'sec-fetch-site': 'cross-site' }])('rejects foreign or missing origins', async headers => {
    expect((await POST(request(payload, headers))).status).toBe(403); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each<Record<string,string>>([{ dnt: '1' }, { 'sec-gpc': '1' }])('respects privacy signals', async headers => {
    expect((await POST(request(payload, headers))).status).toBe(204); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('bounds request bodies without trusting content-length', async () => {
    expect((await POST(request({ ...payload, extra: 'x'.repeat(200) }))).status).toBe(413); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('rejects unapproved content types', async () => {
    expect((await POST(request(payload, { 'content-type': 'text/plain' }))).status).toBe(415);
  });
  it('applies an abuse budget before touching the database', async () => {
    mocks.limit.mockResolvedValue({ allowed: false }); expect((await POST(request())).status).toBe(429); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('does not pretend a failed database write succeeded', async () => {
    mocks.rpc.mockReturnValue({ abortSignal: vi.fn().mockResolvedValue({ error: { message: 'internal details' } }) });
    const result = await POST(request()); expect(result.status).toBe(503); expect(await result.text()).toBe('');
  });
  it('reports thrown backend errors without disclosing data', async () => {
    mocks.rpc.mockImplementation(() => { throw new Error('secret'); }); expect((await POST(request())).status).toBe(503);
  });
});
describe('restricted reports and cleanup', () => {
  it('denies public report access', async () => { expect((await report()).status).toBe(401); });
  it('reports disabled state without querying storage', async () => {
    mocks.admin.mockReturnValue(true); vi.stubEnv('PRODUCT_METRICS_ENABLED', 'false');
    expect(await (await report()).json()).toEqual({ ok: true, enabled: false, rows: [] });
  });
  it('does not clean up without a configured secret', async () => {
    vi.stubEnv('CRON_SECRET', ''); expect((await purge(new NextRequest('https://example.com'))).status).toBe(401);
  });
  it('rejects invalid cleanup credentials', async () => {
    vi.stubEnv('CRON_SECRET', 'testing'); expect((await purge(new NextRequest('https://example.com', { headers: { authorization: 'Bearer wrong' } }))).status).toBe(401);
  });
  it('runs cleanup only with valid credentials', async () => {
    vi.stubEnv('CRON_SECRET', 'testing'); mocks.rpc.mockResolvedValue({ error: null });
    expect((await purge(new NextRequest('https://example.com', { headers: { authorization: 'Bearer testing' } }))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('cm_purge_product_metrics');
  });
});
describe('client minimization', () => {
  it('sends no identifiers, referrer or cookies', async () => {
    vi.stubEnv('NEXT_PUBLIC_PRODUCT_METRICS_ENABLED', 'true'); vi.stubGlobal('window', {}); vi.stubGlobal('navigator', {});
    const fetch = vi.fn().mockResolvedValue({}); vi.stubGlobal('fetch', fetch);
    trackMetric('search_used', 'map');
    expect(fetch).toHaveBeenCalledWith('/api/product-metrics', expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer', body: JSON.stringify(payload) }));
  });
  it('does not send anything when disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_PRODUCT_METRICS_ENABLED', 'false'); vi.stubGlobal('window', {});
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch); trackMetric('spot_view', 'detail'); expect(fetch).not.toHaveBeenCalled();
  });
  it.each([{ doNotTrack: '1' }, { globalPrivacyControl: true }])('honors browser privacy choices', navigator => {
    vi.stubEnv('NEXT_PUBLIC_PRODUCT_METRICS_ENABLED', 'true'); vi.stubGlobal('window', {}); vi.stubGlobal('navigator', navigator);
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch); trackMetric('spot_view', 'detail'); expect(fetch).not.toHaveBeenCalled();
  });
  it('never interferes with an action if fetch throws', () => {
    vi.stubEnv('NEXT_PUBLIC_PRODUCT_METRICS_ENABLED', 'true'); vi.stubGlobal('window', {}); vi.stubGlobal('navigator', {});
    vi.stubGlobal('fetch', () => { throw new Error('offline'); }); expect(() => trackMetric('spot_view', 'detail')).not.toThrow();
  });
  it('retires signup tracking even for legacy callers and browsers', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const old = new TracciaFunnel(); old.aperto(); old.campo('email'); old.errore('sensitive'); old.riuscito(); old.abbandonato();
    expect(fetch).not.toHaveBeenCalled(); expect((await retired()).status).toBe(410);
  });
  it('accepts the exact approved combinations', () => {
    expect(validMetric({ event: 'contribution_sent', source: 'add' })).toBe(true);
    expect(validMetric({ event: 'directions_open', source: 'detail' })).toBe(true);
  });
});
