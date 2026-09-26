import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
describe('private pages bypass the service worker cache', () => {
  it.each(['/auth/callback?code=test-code', '/auth/reset-password', '/auth/setup-username', '/u/test/modifica', '/messaggi', '/api/session-invites'])('never caches %s', async path => {
    const handlers: Record<string, Function> = {};
    const fetch = vi.fn().mockResolvedValue(new Response('private response'));
    const caches = { open: vi.fn(), match: vi.fn() };
    vm.runInNewContext(source, { self: { location: { origin: 'https://example.test' }, addEventListener: (event: string, handler: Function) => { handlers[event] = handler; } }, fetch, caches, URL, Response, Request, console, setTimeout });
    const request = new Request('https://example.test' + path);
    let response: Promise<Response> | undefined;
    handlers.fetch({ request, respondWith: (value: Promise<Response>) => { response = value; } });
    expect(await (await response!).text()).toBe('private response');
    expect(fetch).toHaveBeenCalledWith(request, { cache: 'no-store' });
    expect(caches.open).not.toHaveBeenCalled(); expect(caches.match).not.toHaveBeenCalled();
  });
});
