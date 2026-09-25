import type { SessionInvite, SessionMessage } from '@/lib/session-invites';

/** Reject DST gaps instead of silently moving a rider's appointment by an hour. */
export function sessionDateISO(day: string, time: string, now = Date.now()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) throw new Error('Scegli giorno e ora.');
  const [year, month, date] = day.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const local = new Date(year, month - 1, date, hours, minutes);
  if (local.getFullYear() !== year || local.getMonth() !== month - 1 || local.getDate() !== date || local.getHours() !== hours || local.getMinutes() !== minutes) {
    throw new Error('Questo orario non esiste nel tuo fuso. Scegli un altro orario.');
  }
  if (local.getTime() <= now) throw new Error('Scegli un orario futuro.');
  if (local.getTime() > now + 90 * 24 * 60 * 60 * 1000) throw new Error('Puoi proporre una session entro i prossimi 90 giorni.');
  return local.toISOString();
}

export function displaySessionDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(iso));
}

export function sessionStatus(invite: SessionInvite): SessionInvite['status'] {
  return invite.status === 'pending' && Date.parse(invite.starts_at) <= Date.now() ? 'expired' : invite.status;
}

/** Scope every merge to the open invite, including late and overlapping polls. */
export function mergeSessionMessages(existing: SessionMessage[], incoming: SessionMessage[], inviteId: string): SessionMessage[] {
  const rows = new Map<number, SessionMessage>();
  for (const item of [...existing, ...incoming]) if (item.invite_id === inviteId) rows.set(item.id, item);
  return [...rows.values()].sort((a, b) => a.id - b.id);
}

export function mergeSessionInvites(existing: SessionInvite[], incoming: SessionInvite[]): SessionInvite[] {
  const rows = new Map(existing.map(item => [item.id, item]));
  for (const item of incoming) rows.set(item.id, item);
  return [...rows.values()].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
}

export class SessionApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function sessionError(error: unknown): string {
  if (error instanceof SessionApiError) {
    if (error.status === 401) return 'Accedi di nuovo per continuare. Il testo che hai scritto è ancora qui.';
    if (error.status === 404) return 'Questo invito, rider o spot non è più disponibile.';
    if (error.status === 429) return 'Hai inviato diverse richieste. Aspetta un momento e riprova.';
    if (error.status === 409) return 'La richiesta è cambiata o ne esiste già una in attesa. Aggiorna i messaggi prima di riprovare.';
    if (error.status === 403) return 'Questa azione non è disponibile. La conversazione potrebbe essere stata chiusa.';
    if (error.status >= 500) return 'Non riusciamo a caricare i messaggi. Riprova tra poco.';
    if (error.status === 400 || error.status === 422) return 'Controlla i dati: rider, spot, giorno e ora devono essere validi.';
  }
  return error instanceof TypeError ? 'Connessione interrotta. Il testo è conservato: puoi riprovare.' : error instanceof Error ? error.message : 'Qualcosa non ha funzionato. Riprova.';
}
