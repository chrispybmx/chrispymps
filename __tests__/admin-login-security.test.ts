import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const auth = vi.hoisted(() => ({ loginAdmin: vi.fn(), adminSessionCookieHeader: vi.fn(() => 'admin=token; HttpOnly; Secure; SameSite=Strict') }));
vi.mock('@/lib/auth', () => auth);
import { POST } from '@/app/api/admin/login/route';
let sequence = 0;
function request(body: string, headers: Record<string, string> = {}) {
  return new NextRequest('https://maps.example/api/admin/login', { method: 'POST', body,
    headers: { 'content-type': 'application/json', 'x-real-ip': `test-${++sequence}`, ...headers } });
}
beforeEach(() => { vi.clearAllMocks(); auth.loginAdmin.mockReturnValue({ success: true, token: 'token' }); });
it('rejects a sibling-domain origin before authenticating', async () => {
  expect((await POST(request('{"password":"valid"}', { origin: 'https://evil.maps.example' }))).status).toBe(403);
  expect(auth.loginAdmin).not.toHaveBeenCalled();
});
it('rejects cross-site fetch metadata even without Origin', async () => {
  expect((await POST(request('{"password":"valid"}', { 'sec-fetch-site': 'cross-site' }))).status).toBe(403);
  expect(auth.loginAdmin).not.toHaveBeenCalled();
});
it('bounds actual body bytes without Content-Length', async () => {
  expect((await POST(request('x'.repeat(4097)))).status).toBe(413);
  expect(auth.loginAdmin).not.toHaveBeenCalled();
});
it.each(['{', '{"password":{}}', JSON.stringify({ password: 'x'.repeat(1025) })])('rejects malformed credentials', async body => {
  expect((await POST(request(body))).status).toBe(400);
  expect(auth.loginAdmin).not.toHaveBeenCalled();
});
it('preserves valid same-origin login and secure cookie', async () => {
  const result = await POST(request('{"password":"valid"}', { origin: 'https://maps.example' }));
  expect(result.status).toBe(200);
  expect(auth.loginAdmin).toHaveBeenCalledWith('valid');
  expect(result.headers.get('set-cookie')).toContain('HttpOnly');
});
