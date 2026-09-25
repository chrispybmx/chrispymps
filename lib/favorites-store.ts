/** Account-scoped favorites state. No React or browser globals are required in tests. */
const PREFIX = 'cmaps_favs_v2:';
export const LEGACY_FAVORITES_KEY = 'cmaps_favs_v1';
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type FavoriteScope = 'loading' | 'guest' | `user:${string}`;
export type FavoritesError = 'load' | 'save' | 'auth' | null;
type Identity = { id: string; accessToken: string } | null | undefined;
type RecordValue = { saved: boolean; revision: string };
type Records = Map<string, RecordValue>;
export interface FavoritesSnapshot { favIds: Set<string>; loaded: boolean; error: FavoritesError; pendingIds: Set<string> }
interface Entry { scope: FavoriteScope; records: Records; token?: string; loading: Promise<void> | null; loaded: boolean; error: FavoritesError; pending: Map<string, Promise<void>>; snapshot: FavoritesSnapshot; listeners: Set<() => void>; }
interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
interface Dependencies { storage: () => StorageLike | null; fetch: typeof fetch; now?: () => number; source?: string }
export const EMPTY_FAVORITES: FavoritesSnapshot = { favIds: new Set(), loaded: false, error: null, pendingIds: new Set() };
export const favoritesScope = (identity: Identity): FavoriteScope => identity === undefined ? 'loading' : identity ? `user:${identity.id}` : 'guest';
export const favoritesStorageKey = (scope: FavoriteScope) => `${PREFIX}${scope}`;

function parse(raw: string | null): Records {
  const result: Records = new Map();
  try {
    const value = JSON.parse(raw ?? '{}');
    if (value?.version !== 2 || !value.items || typeof value.items !== 'object') return result;
    for (const [id, record] of Object.entries(value.items)) {
      const item = record as RecordValue;
      if (ID.test(id) && typeof item?.saved === 'boolean' && typeof item.revision === 'string' && item.revision.length < 100) result.set(id, item);
    }
  } catch { /* Invalid local data never becomes another account's favorites. */ }
  return result;
}

export function createFavoritesStore(deps: Dependencies) {
  const entries = new Map<FavoriteScope, Entry>();
  const source = deps.source ?? Math.random().toString(36).slice(2);
  let sequence = 0;
  let stamp = 0;
  const revision = () => {
    stamp = Math.max(stamp, (deps.now ?? Date.now)());
    return `${String(stamp).padStart(16, '0')}-${String(++sequence).padStart(8, '0')}-${source}`;
  };
  const read = (scope: FavoriteScope): Records => {
    try { return parse(deps.storage()?.getItem(favoritesStorageKey(scope)) ?? null); } catch { return new Map(); }
  };
  const merge = (target: Records, incoming: Records): boolean => {
    let changed = false;
    for (const [id, value] of incoming) {
      const old = target.get(id);
      const [time, count] = value.revision.split('-');
      if (Number.isSafeInteger(Number(time))) stamp = Math.max(stamp, Number(time));
      if (Number.isSafeInteger(Number(count))) sequence = Math.max(sequence, Number(count));
      if (!old || old.revision < value.revision) { target.set(id, value); changed = true; }
    }
    return changed;
  };
  const emit = (entry: Entry) => {
    entry.snapshot = { favIds: new Set([...entry.records].filter(([, value]) => value.saved).map(([id]) => id)), loaded: entry.loaded, error: entry.error, pendingIds: new Set(entry.pending.keys()) };
    for (const listener of entry.listeners) listener();
  };
  const persist = (entry: Entry) => {
    merge(entry.records, read(entry.scope));
    try { deps.storage()?.setItem(favoritesStorageKey(entry.scope), JSON.stringify({ version: 2, items: Object.fromEntries(entry.records) })); } catch { /* Storage is optional; online saves still work. */ }
  };
  const entryFor = (scope: FavoriteScope): Entry => {
    let entry = entries.get(scope);
    if (!entry) {
      entry = { scope, records: new Map(), loading: null, loaded: false, error: null, pending: new Map(), snapshot: EMPTY_FAVORITES, listeners: new Set() };
      entries.set(scope, entry);
    }
    return entry;
  };
  const change = (entry: Entry, id: string, saved: boolean) => {
    merge(entry.records, read(entry.scope));
    entry.records.set(id, { saved, revision: revision() });
    persist(entry);
    emit(entry);
  };
  const request = async (entry: Entry, init?: RequestInit) => {
    const token = entry.token;
    const run = (accessToken?: string) => deps.fetch(init?.method === 'POST' ? '/api/favorites' : '/api/favorites?ids_only=1', { ...init, cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken ?? ''}` } });
    let response = await run(token);
    if (response.status === 401 && entry.token && entry.token !== token) response = await run(entry.token);
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(response.status === 401 ? 'auth' : 'request');
    return payload;
  };

  const queueSave = (entry: Entry, id: string, previous: boolean, guestRevision?: string): Promise<void> => {
    const running = entry.pending.get(id);
    if (running) return running;
    let confirmed = previous;
    // Start on a microtask so all hook instances see the pending operation immediately.
    const task = Promise.resolve().then(async () => {
      for (;;) {
        const intended = entry.records.get(id)!;
        try {
          const payload = await request(entry, { method: 'POST', body: JSON.stringify({ spot_id: id, saved: intended.saved }) });
          if (payload.isFaved !== intended.saved) throw new Error('request');
          confirmed = intended.saved;
          const guest = entryFor('guest');
          if (confirmed && guestRevision && guest.records.get(id)?.revision === guestRevision) change(guest, id, false);
          if (entry.records.get(id)?.revision === intended.revision) { entry.error = null; break; }
        } catch (error) {
          if (entry.records.get(id)?.revision !== intended.revision) continue;
          entry.error = error instanceof Error && error.message === 'auth' ? 'auth' : 'save';
          change(entry, id, confirmed);
          break;
        }
      }
    }).finally(() => { entry.pending.delete(id); emit(entry); });
    entry.pending.set(id, task);
    emit(entry);
    return task;
  };

  const set = (scope: FavoriteScope, id: string, saved: boolean): boolean => {
    if (scope === 'loading' || !ID.test(id)) return false;
    const entry = entryFor(scope);
    const previous = entry.records.get(id)?.saved ?? false;
    if (previous === saved) return saved;
    entry.error = null;
    change(entry, id, saved);
    if (scope !== 'guest') void queueSave(entry, id, previous);
    return saved;
  };

  const load = (entry: Entry): Promise<void> => {
    if (entry.loading) return entry.loading;
    const baseline = new Map(entry.records);
    entry.loading = request(entry).then(payload => {
      if (!Array.isArray(payload.ids) || !payload.ids.every((id: unknown) => typeof id === 'string' && ID.test(id))) throw new Error('request');
      const remote = new Set<string>(payload.ids);
      for (const id of new Set([...entry.records.keys(), ...remote])) {
        if (entry.pending.has(id) || entry.records.get(id)?.revision !== baseline.get(id)?.revision) continue;
        if ((entry.records.get(id)?.saved ?? false) !== remote.has(id)) entry.records.set(id, { saved: remote.has(id), revision: revision() });
      }
      entry.error = null;
      persist(entry);
      // Preserve new guest choices without replacing any existing account favorites.
      const guest = entryFor('guest');
      merge(guest.records, read('guest'));
      for (const [id, value] of guest.records) {
        if (!value.saved) continue;
        if (remote.has(id)) change(guest, id, false);
        else if (!entry.pending.has(id)) {
          if (!entry.records.get(id)?.saved) change(entry, id, true);
          void queueSave(entry, id, false, value.revision);
        }
      }
    }).catch(error => { entry.error = error instanceof Error && error.message === 'auth' ? 'auth' : 'load'; })
      .finally(() => { entry.loading = null; entry.loaded = true; emit(entry); });
    return entry.loading;
  };

  return {
    configure(identity: Identity) {
      const scope = favoritesScope(identity);
      if (scope === 'loading') return;
      const entry = entryFor(scope);
      const first = !entry.loaded && !entry.loading;
      if (identity) entry.token = identity.accessToken;
      if (first) {
        merge(entry.records, read(scope));
        if (scope === 'guest') { entry.loaded = true; emit(entry); }
        else { emit(entry); void load(entry); }
      }
    },
    snapshot(scope: FavoriteScope) { return scope === 'loading' ? EMPTY_FAVORITES : entryFor(scope).snapshot; },
    subscribe(scope: FavoriteScope, callback: () => void) { const entry = entryFor(scope); entry.listeners.add(callback); return () => { entry.listeners.delete(callback); }; },
    set,
    toggle(scope: FavoriteScope, id: string) { return set(scope, id, !entryFor(scope).records.get(id)?.saved); },
    reload(scope: FavoriteScope) { const entry = entryFor(scope); if (scope.startsWith('user:')) return load(entry); return Promise.resolve(); },
    legacyIds(): string[] {
      try {
        const value: unknown = JSON.parse(deps.storage()?.getItem(LEGACY_FAVORITES_KEY) ?? '[]');
        return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && ID.test(id)))] : [];
      } catch { return []; }
    },
    importLegacy(scope: FavoriteScope, ids: string[]) { for (const id of ids) set(scope, id, true); },
    storageChanged(key: string | null, value: string | null) {
      if (!key?.startsWith(PREFIX)) return;
      const scope = key.slice(PREFIX.length) as FavoriteScope;
      const entry = entries.get(scope);
      if (!entry) return;
      const incoming = parse(value);
      const changed = merge(entry.records, incoming);
      // Converge concurrent tab edits per spot instead of replacing an entire stale list.
      if ([...entry.records].some(([id, record]) => !incoming.has(id) || incoming.get(id)!.revision < record.revision)) persist(entry);
      if (changed) emit(entry);
    },
  };
}
