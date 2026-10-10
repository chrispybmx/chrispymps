import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { expect, it, vi } from 'vitest';
const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

function worker(fetch: ReturnType<typeof vi.fn>, writeFails = false) {
 const handlers: Record<string, Function> = {};
 const old = () => new Response('old page with old menu');
 const put = writeFails ? vi.fn().mockRejectedValue(new Error('Quota exceeded')) : vi.fn().mockResolvedValue(undefined);
 const caches = { open: vi.fn().mockResolvedValue({ match: vi.fn().mockImplementation(old), put }), match: vi.fn().mockImplementation(old) };
 vm.runInNewContext(source, { self: { location: { origin: 'https://example.test' }, addEventListener: (type: string, callback: Function) => { handlers[type] = callback; } }, fetch, caches, URL, Response, Request, console, setTimeout });
 return { put, caches, async get(path = '/map') {
  let result: Promise<Response> | undefined;
  handlers.fetch({ request: new Request('https://example.test' + path), respondWith: (response: Promise<Response>) => { result = response; } });
  return result!;
 } };
}

it('serves the current map immediately even when an old page is saved', async () => {
 const probe = worker(vi.fn().mockResolvedValue(new Response('current menu')));
 expect(await (await probe.get()).text()).toBe('current menu');
 expect(probe.put).toHaveBeenCalled();
});
it('keeps the saved map available without network', async () => {
 const probe = worker(vi.fn().mockRejectedValue(new Error('offline')));
 expect(await (await probe.get()).text()).toBe('old page with old menu');
});
it('never replaces a real 404 with a cached successful page', async () => {
 const probe = worker(vi.fn().mockResolvedValue(new Response('not found', { status: 404 })));
 expect((await probe.get('/map/spot/deleted')).status).toBe(404);
 expect(probe.put).not.toHaveBeenCalled();
});
it('opens the current map even when cache storage is full', async () => {
 const probe = worker(vi.fn().mockResolvedValue(new Response('current menu')), true);
 expect(await (await probe.get()).text()).toBe('current menu');
});
