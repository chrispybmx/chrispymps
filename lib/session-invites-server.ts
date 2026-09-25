import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  Vary: 'Authorization',
  'X-Robots-Tag': 'noindex, nofollow',
};
const ERRORS: Record<string, { status: number; message: string }> = {
  FEATURE_UNAVAILABLE: { status: 503, message: 'Le session private non sono ancora disponibili. Riprova più tardi.' },
  UNAUTHORIZED: { status: 401, message: 'Accedi di nuovo per continuare.' },
  INVALID_INPUT: { status: 422, message: 'Controlla i dati della richiesta e riprova.' },
  TOO_LARGE: { status: 413, message: 'Il messaggio è troppo lungo.' },
  NOT_FOUND: { status: 404, message: 'Conversazione non disponibile.' },
  FORBIDDEN: { status: 403, message: 'Non puoi eseguire questa azione.' },
  PROFILE_REQUIRED: { status: 409, message: 'Completa il tuo profilo con un nome rider prima di proporre una session.' },
  RECIPIENT_UNAVAILABLE: { status: 404, message: 'Questo rider non è disponibile.' },
  SELF_INVITE: { status: 422, message: 'Scegli un altro rider per la session.' },
  SPOT_UNAVAILABLE: { status: 409, message: 'Questo spot non è più disponibile. Scegli un altro spot.' },
  BLOCKED: { status: 409, message: 'Non è possibile inviare messaggi o inviti a questo rider.' },
  INVITE_EXISTS: { status: 409, message: 'C’è già un invito in attesa tra voi per questo spot. Lo trovi nei Messaggi.' },
  RATE_LIMIT: { status: 429, message: 'Hai inviato molte richieste. Aspetta un po’ prima di riprovare.' },
  IDEMPOTENCY_CONFLICT: { status: 409, message: 'Questa richiesta è già stata inviata con dati diversi. Aggiorna la conversazione.' },
  NOT_ACCEPTED: { status: 409, message: 'La chat si apre quando il rider accetta l’invito.' },
  INVALID_STATE: { status: 409, message: 'Lo stato dell’invito è cambiato. Aggiorna la conversazione.' },
  EXPIRED: { status: 409, message: 'L’orario di questo invito è passato. Puoi proporre una nuova session.' },
  INTERNAL: { status: 500, message: 'Non siamo riusciti a completare la richiesta. Riprova.' },
};

export class SessionApiError extends Error {
  constructor(public code: string) { super(code); }
}

export function privateJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

export function sessionError(error: unknown): NextResponse {
  const code = error instanceof SessionApiError ? error.code : error instanceof z.ZodError ? 'INVALID_INPUT' : 'INTERNAL';
  const definition = ERRORS[code] ?? ERRORS.INTERNAL;
  return privateJson({ ok: false, error: definition.message, code }, definition.status);
}

export type SessionAdmin = ReturnType<typeof supabaseAdmin>;
export interface SessionActor { admin: SessionAdmin; actor: string }

/** The actor comes only from Supabase's verified token; body and URL ids never authenticate. */
export async function sessionEndpoint(req: NextRequest, work: (identity: SessionActor) => Promise<NextResponse>): Promise<NextResponse> {
  try {
    if (process.env.SESSION_INVITES_ENABLED !== 'true') throw new SessionApiError('FEATURE_UNAVAILABLE');
    const authorization = req.headers.get('authorization');
    const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) throw new SessionApiError('UNAUTHORIZED');
    const admin = supabaseAdmin();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) throw new SessionApiError('UNAUTHORIZED');
    return await work({ admin, actor: data.user.id });
  } catch (error) {
    return sessionError(error);
  }
}

/** Limit bytes while reading, including chunked requests without Content-Length. */
export async function sessionBody(req: NextRequest): Promise<unknown> {
  const limit = 16_384;
  if (Number(req.headers.get('content-length')) > limit) throw new SessionApiError('TOO_LARGE');
  const reader = req.body?.getReader();
  if (!reader) throw new SessionApiError('INVALID_INPUT');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new SessionApiError('TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new SessionApiError('INVALID_INPUT'); }
}

/** RPCs enforce membership, locks, state, idempotency and persistent limits in one transaction. */
export async function sessionRpc<T>(admin: SessionAdmin, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(name, args);
  if (error) {
    if (ERRORS[error.message]) throw new SessionApiError(error.message);
    if (['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error.code)) throw new SessionApiError('FEATURE_UNAVAILABLE');
    // Never log private messages, auth tokens or full SQL errors.
    console.error('[session-invites] database request failed', { code: error.code });
    throw new SessionApiError('INTERNAL');
  }
  return data as T;
}

export const sessionIdSchema = z.string().uuid();
const dateSchema = z.string().datetime({ offset: true });
export const inviteSchema = z.object({
  recipient: z.string().trim().regex(/^[a-zA-Z0-9_-]{3,30}$/),
  spotId: sessionIdSchema,
  startsAt: dateSchema.refine(value => {
    const ahead = Date.parse(value) - Date.now();
    return ahead > 0 && ahead <= 90 * 24 * 60 * 60 * 1000;
  }),
  timeZone: z.string().min(1).max(100).refine(value => {
    try { new Intl.DateTimeFormat('it', { timeZone: value }); return true; } catch { return false; }
  }),
  note: z.string().trim().max(500).default(''),
  clientId: sessionIdSchema,
}).strict();
export const messageSchema = z.object({ body: z.string().trim().min(1).max(2000), clientId: sessionIdSchema }).strict();
export const actionSchema = z.object({
  action: z.enum(['accept', 'decline', 'cancel', 'read', 'block', 'unblock', 'report']),
  reason: z.string().trim().max(1000).optional(),
  readThrough: dateSchema.optional(),
}).strict()
  .refine(value => value.action !== 'report' || Boolean(value.reason), { message: 'Indica il motivo della segnalazione.' })
  .refine(value => value.action !== 'read' || Boolean(value.readThrough), { message: 'Aggiorna la conversazione.' });
export const preferenceSchema = z.union([
  z.object({ emailEnabled: z.boolean() }).strict(),
  z.object({ unblockUserId: sessionIdSchema }).strict(),
]);

export function inboxCursor(value: string | null): { before_time: string | null; before_id: string | null } {
  if (!value) return { before_time: null, before_id: null };
  const [time, id, extra] = value.split('|');
  if (extra !== undefined) throw new SessionApiError('INVALID_INPUT');
  return { before_time: dateSchema.parse(time), before_id: id === undefined ? null : sessionIdSchema.parse(id) };
}

export function messageCursor(params: URLSearchParams): { after_message: number | null; before_message: number | null } {
  const after = params.get('after');
  const before = params.get('before');
  if (after !== null && before !== null) throw new SessionApiError('INVALID_INPUT');
  const parse = (value: string | null, minimum: number): number | null => {
    if (value === null) return null;
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < minimum) throw new SessionApiError('INVALID_INPUT');
    return Number(value);
  };
  return { after_message: parse(after, 0), before_message: parse(before, 1) };
}
