/* Condivisione posizione Jam Roma lato browser.
   Separata dal componente per poterla testare: lo Stop deve togliere il rider
   dalla mappa anche quando una posizione GPS o un POST arrivano dopo lo Stop,
   e deve dire se la cancellazione e' fallita invece di ignorarla. */

const ENDPOINT = '/api/events/jamroma/presence';

export interface PresencePosition { lat: number; lon: number }

export interface PresenceSessionDeps {
  fetch: typeof fetch;
  /** Letto a ogni richiesta: il login puo' arrivare dopo l'apertura della pagina. */
  getToken: () => string | null | undefined;
  getDisplayName: () => string;
}

export function createPresenceSession(deps: PresenceSessionDeps) {
  let active = false;
  let generation = 0;
  /* Id delle righe anonime create da questo browser. Il GET pubblico non li
     espone: sono l'unica prova che la riga e' nostra. */
  let anonIds: string[] = [];
  let sentAsUser = false;

  async function deleteOwn(token: string | null | undefined, ids: string[]): Promise<string[]> {
    const failed: string[] = [];
    if (token) {
      const res = await deps.fetch(ENDPOINT, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, keepalive: true }).catch(() => null);
      if (!res?.ok) failed.push('');
    }
    for (const id of ids) {
      const res = await deps.fetch(`${ENDPOINT}?id=${encodeURIComponent(id)}`, { method: 'DELETE', keepalive: true }).catch(() => null);
      if (!res?.ok) failed.push(id);
    }
    return failed;
  }

  return {
    get active() { return active; },

    start() { active = true; generation += 1; },

    /** Ignorata se lo Stop e' gia' stato premuto (callback GPS in ritardo). */
    async send(pos: PresencePosition): Promise<void> {
      if (!active) return;
      const myGeneration = generation;
      const token = deps.getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await deps.fetch(ENDPOINT, {
        method: 'POST', headers,
        body: JSON.stringify({ lat: pos.lat, lon: pos.lon, sharing_enabled: true, ...(token ? {} : { display_name: deps.getDisplayName() || 'Rider' }) }),
      }).catch(() => null);
      const data = await res?.json().catch(() => null) as { presenceId?: unknown } | null;
      const id = typeof data?.presenceId === 'string' ? data.presenceId : null;
      if (token && res?.ok) sentAsUser = true;
      // POST partito prima dello Stop e arrivato dopo: la riga va tolta subito.
      if (myGeneration !== generation || !active) {
        await deleteOwn(token, id ? [id] : []);
        return;
      }
      if (id) anonIds.push(id);
    },

    /** true se tutte le righe sono state tolte; false se resta qualcosa sulla mappa. */
    async stop(): Promise<boolean> {
      active = false;
      generation += 1;
      const ids = anonIds;
      anonIds = [];
      const token = deps.getToken();
      const failed = await deleteOwn(sentAsUser || token ? token : null, ids);
      // Le righe anonime non cancellate restano in lista per un nuovo tentativo.
      anonIds = failed.filter(Boolean);
      if (!failed.includes('')) sentAsUser = false;
      return failed.length === 0;
    },
  };
}

export type PresenceSession = ReturnType<typeof createPresenceSession>;
