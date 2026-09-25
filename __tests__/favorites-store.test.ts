import { describe, it, expect, vi } from 'vitest';
import { createFavoritesStore, favoritesStorageKey, LEGACY_FAVORITES_KEY } from '@/lib/favorites-store';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const user = { id: A, accessToken: 'old-token' };
const scope = `user:${A}` as const;
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (reason?: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function fixture(source = 'tab-a', data = new Map<string, string>()) {
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(respond({ ok: true, ids: [] }));
  const store = createFavoritesStore({ storage: () => storage, fetch: fetcher, now: () => 1000, source });
  return { store, fetcher, data, storage };
}
const loaded = async (store: ReturnType<typeof createFavoritesStore>) => { await vi.waitFor(() => expect(store.snapshot(scope).loaded).toBe(true)); };
const idle = async (store: ReturnType<typeof createFavoritesStore>) => { await vi.waitFor(() => expect(store.snapshot(scope).pendingIds.size).toBe(0)); };

describe('favorites account boundaries and guest recovery', () => {
  it('does not expose account A ids to account B, a guest, or unresolved auth', async () => {
    const { store, fetcher } = fixture();
    fetcher.mockResolvedValueOnce(respond({ ok: true, ids: [B] }));
    store.configure(user); await loaded(store);
    expect(store.snapshot(scope).favIds.has(B)).toBe(true);
    expect(store.snapshot(`user:${C}`).favIds.size).toBe(0);
    expect(store.snapshot('guest').favIds.size).toBe(0);
    expect(store.snapshot('loading').favIds.size).toBe(0);
    store.configure(null);
    expect(store.snapshot('guest').favIds.size).toBe(0);
  });

  it('keeps ambiguous legacy data untouched until explicit recovery into the selected scope', () => {
    const { store, data } = fixture();
    data.set(LEGACY_FAVORITES_KEY, JSON.stringify([A, B, 'bad-id']));
    store.configure(null);
    expect(store.snapshot('guest').favIds.size).toBe(0);
    expect(store.legacyIds()).toEqual([A, B]);
    store.importLegacy('guest', [B]);
    expect([...store.snapshot('guest').favIds]).toEqual([B]);
    expect(data.get(LEGACY_FAVORITES_KEY)).toBe(JSON.stringify([A, B, 'bad-id']));
  });

  it('merges guest choices without replacing existing remote favorites', async () => {
    const { store, fetcher } = fixture();
    store.configure(null); store.set('guest', B, true);
    fetcher.mockResolvedValueOnce(respond({ ok: true, ids: [C] })).mockResolvedValueOnce(respond({ ok: true, isFaved: true }));
    store.configure(user); await loaded(store); await idle(store);
    expect([...store.snapshot(scope).favIds].sort()).toEqual([B, C].sort());
    expect(store.snapshot('guest').favIds.has(B)).toBe(false);
    expect(JSON.parse((fetcher.mock.calls[1][1] as RequestInit).body as string)).toEqual({ spot_id: B, saved: true });
  });

  it('retains guest choices if their account merge fails', async () => {
    const { store, fetcher } = fixture();
    store.configure(null); store.set('guest', B, true);
    fetcher.mockResolvedValueOnce(respond({ ok: true, ids: [] })).mockResolvedValueOnce(respond({ ok: false }, 500));
    store.configure(user); await loaded(store); await idle(store);
    expect(store.snapshot('guest').favIds.has(B)).toBe(true);
    expect(store.snapshot(scope).favIds.has(B)).toBe(false);
    expect(store.snapshot(scope).error).toBe('save');
  });
});

describe('favorites optimistic writes and races', () => {
  it('notifies all mounted subscribers from one shared update', () => {
    const { store } = fixture(); store.configure(null);
    const first = vi.fn(); const second = vi.fn();
    store.subscribe('guest', first); store.subscribe('guest', second);
    store.toggle('guest', A);
    expect(first).toHaveBeenCalled(); expect(second).toHaveBeenCalled();
    expect(store.snapshot('guest').favIds.has(A)).toBe(true);
  });

  it('recognizes HTTP failures and rolls back only the failed current operation', async () => {
    const { store, fetcher } = fixture(); store.configure(user); await loaded(store);
    fetcher.mockResolvedValueOnce(respond({ ok: false }, 500));
    store.toggle(scope, B); expect(store.snapshot(scope).favIds.has(B)).toBe(true);
    await idle(store);
    expect(store.snapshot(scope).favIds.has(B)).toBe(false);
    expect(store.snapshot(scope).error).toBe('save');
  });

  it('sends the latest desired state after a failed earlier operation, without undoing a newer intent', async () => {
    const { store, fetcher } = fixture(); store.configure(user); await loaded(store);
    const first = deferred<Response>();
    fetcher.mockReturnValueOnce(first.promise).mockResolvedValueOnce(respond({ ok: true, isFaved: false }));
    store.toggle(scope, B);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    store.toggle(scope, B);
    first.resolve(respond({ ok: false }, 500));
    await idle(store);
    expect(store.snapshot(scope).favIds.has(B)).toBe(false);
    expect(store.snapshot(scope).error).toBeNull();
    expect(fetcher.mock.calls.slice(1).map(([, init]) => JSON.parse(init!.body as string).saved)).toEqual([true, false]);
  });

  it('serializes repeated changes for the same spot and does not lose the final save', async () => {
    const { store, fetcher } = fixture(); store.configure(user); await loaded(store);
    const first = deferred<Response>();
    fetcher.mockReturnValueOnce(first.promise).mockResolvedValueOnce(respond({ ok: true, isFaved: true }));
    store.toggle(scope, B);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    store.toggle(scope, B); store.toggle(scope, B);
    first.resolve(respond({ ok: true, isFaved: true }));
    await idle(store);
    expect(store.snapshot(scope).favIds.has(B)).toBe(true);
    expect(fetcher.mock.calls.slice(1).map(([, init]) => JSON.parse(init!.body as string).saved)).toEqual([true, true]);
  });

  it('does not replace a newly saved spot with a late initial GET', async () => {
    const { store, fetcher } = fixture(); const initial = deferred<Response>();
    fetcher.mockReturnValueOnce(initial.promise).mockResolvedValueOnce(respond({ ok: true, isFaved: true }));
    store.configure(user); store.set(scope, B, true); await idle(store);
    initial.resolve(respond({ ok: true, ids: [] })); await loaded(store);
    expect(store.snapshot(scope).favIds.has(B)).toBe(true);
  });

  it('uses the refreshed token for a queued write and retries an expired in-flight token', async () => {
    const { store, fetcher } = fixture(); store.configure(user); await loaded(store);
    const first = deferred<Response>();
    fetcher.mockReturnValueOnce(first.promise).mockResolvedValueOnce(respond({ ok: true, isFaved: true }));
    store.set(scope, B, true);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    store.configure({ ...user, accessToken: 'new-token' });
    first.resolve(respond({ ok: false }, 401)); await idle(store);
    expect((fetcher.mock.calls[2][1]?.headers as Record<string, string>).Authorization).toBe('Bearer new-token');
    expect(store.snapshot(scope).favIds.has(B)).toBe(true);
  });

  it('finishing account A’s pending save cannot populate a new account or guest view', async () => {
    const { store, fetcher } = fixture(); store.configure(user); await loaded(store);
    const first = deferred<Response>(); fetcher.mockReturnValueOnce(first.promise);
    store.set(scope, B, true); store.configure(null);
    first.resolve(respond({ ok: true, isFaved: true })); await idle(store);
    expect(store.snapshot('guest').favIds.size).toBe(0);
    expect(store.snapshot(`user:${C}`).favIds.size).toBe(0);
  });
});

describe('cross-tab favorites convergence', () => {
  it('merges edits to different spots and later removals instead of replacing a stale entire list', () => {
    const first = fixture('first'); const second = fixture('second');
    first.store.configure(null); second.store.configure(null);
    first.store.set('guest', A, true); second.store.set('guest', B, true);
    const key = favoritesStorageKey('guest');
    first.store.storageChanged(key, second.data.get(key)!);
    second.store.storageChanged(key, first.data.get(key)!);
    expect([...first.store.snapshot('guest').favIds].sort()).toEqual([A, B].sort());
    expect([...second.store.snapshot('guest').favIds].sort()).toEqual([A, B].sort());
    second.store.set('guest', A, false);
    first.store.storageChanged(key, second.data.get(key)!);
    expect([...first.store.snapshot('guest').favIds]).toEqual([B]);
  });

  it('does not apply another account’s storage event to the current view', () => {
    const { store } = fixture(); store.configure(null);
    store.storageChanged(favoritesStorageKey(scope), JSON.stringify({ version: 2, items: { [B]: { saved: true, revision: '0000000000001000-00000001-other' } } }));
    expect(store.snapshot('guest').favIds.size).toBe(0);
  });
});
