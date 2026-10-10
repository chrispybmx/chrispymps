import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/rider-stats-preview/route';
afterEach(() => vi.unstubAllEnvs());
it('never enables stats fixtures in production even with loopback Host and preview flag', async () => {
 vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('RIDER_SESSIONS_PREVIEW', 'true');
 const request = new NextRequest('http://localhost/api/rider-stats-preview', { headers: { host: 'localhost:3200' } });
 expect((await GET(request)).status).toBe(404);
 expect((await POST(request)).status).toBe(404);
});
it('rejects non-loopback hosts and disabled previews', async () => {
 vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('RIDER_SESSIONS_PREVIEW', 'true');
 expect((await GET(new NextRequest('https://maps.chrispybmx.com/api/rider-stats-preview', { headers: { host: 'maps.chrispybmx.com' } }))).status).toBe(404);
 vi.stubEnv('RIDER_SESSIONS_PREVIEW', 'false');
 expect((await GET(new NextRequest('http://localhost/api/rider-stats-preview', { headers: { host: 'localhost:3200' } }))).status).toBe(404);
});
it('requires the synthetic token for local preference reads and writes', async () => {
 vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('RIDER_SESSIONS_PREVIEW', 'true');
 const request = new NextRequest('http://localhost/api/rider-stats-preview', { headers: { host: 'localhost:3200' } });
 expect((await GET(request)).status).toBe(401);
 expect((await POST(request)).status).toBe(401);
});
