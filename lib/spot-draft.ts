import type { Ostacolo, SpotType } from './types';
export interface SpotDraft {
  updatedAt: number; step: 'posizione' | 'foto' | 'dettagli';
  lat: number | null; lon: number | null; city: string; country: string; countryCode: string;
  name: string; type: SpotType | ''; ostacoli: Ostacolo[]; description: string; notes: string; difficulty: string; photos: File[];
}
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
let queue: Promise<unknown> = Promise.resolve();
function transaction<T>(owner: string, action: 'get' | 'put' | 'delete', draft?: SpotDraft): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('chrispy-local-drafts', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('spots');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('spots', action === 'get' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('spots');
      const op = action === 'get' ? store.get(owner) : action === 'put' ? store.put(draft, owner) : store.delete(owner);
      tx.oncomplete = () => { db.close(); resolve(op.result as T); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}
export async function readSpotDraft(owner: string): Promise<SpotDraft | null> {
  await queue;
  const draft = await transaction<SpotDraft | undefined>(owner, 'get');
  if (!draft) return null;
  if (Date.now() - draft.updatedAt > MAX_AGE) { await deleteSpotDraft(owner); return null; }
  return draft;
}
const pending = new Map<string, { draft: SpotDraft; done: Promise<void> }>();
export function saveSpotDraft(owner: string, draft: SpotDraft): Promise<void> {
  const existing = pending.get(owner);
  if (existing) { existing.draft = draft; return existing.done; }
  const next = queue.catch(() => {}).then(async () => {
    const latest = pending.get(owner); pending.delete(owner);
    if (latest) await transaction<void>(owner, 'put', latest.draft);
  });
  pending.set(owner, { draft, done: next }); queue = next; return next;
}
export function deleteSpotDraft(owner: string): Promise<void> {
  pending.delete(owner);
  const next = queue.catch(() => {}).then(() => transaction<void>(owner, 'delete'));
  queue = next; return next;
}
