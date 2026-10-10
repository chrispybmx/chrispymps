import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { privateJson, sessionBody } from '@/lib/session-invites-server';

export const dynamic = 'force-dynamic';
const preference = z.object({ shared: z.boolean() }).strict();

async function handle(req: NextRequest, write: boolean) {
 if (process.env.RIDER_SESSIONS_ENABLED !== 'true') return privateJson({ ok: false, error: 'Sessioni non disponibili.' }, 503);
 try {
  const admin = supabaseAdmin();
  const authorization = req.headers.get('authorization');
  let actor: string | null = null;
  if (authorization) {
   const token = authorization.match(/^Bearer\s+(\S+)$/i)?.[1];
   if (!token) throw new Error('UNAUTHORIZED');
   const auth = await admin.auth.getUser(token);
   if (auth.error || !auth.data.user) throw new Error('UNAUTHORIZED');
   actor = auth.data.user.id;
  }
  const target = req.nextUrl.searchParams.get('target');
  let name: string, args: Record<string, unknown>;
  if (!write && target !== null) {
   name = 'cm_rider_public_stats';
   args = { target: z.string().uuid().parse(target), viewer: actor };
  } else {
   if (!actor) throw new Error('UNAUTHORIZED');
   name = 'cm_rider_stats_preference';
   args = { actor };
   if (write) args.shared_value = preference.parse(await sessionBody(req)).shared;
  }
  const { data, error } = await admin.rpc(name, args);
  if (error) {
   if (['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error.code)) return privateJson({ ok: false, error: 'Condivisione statistiche non ancora disponibile.' }, 503);
   throw new Error('INTERNAL');
  }
  return privateJson({ ok: true, data });
 } catch (error) {
  const code = error instanceof Error ? error.message : '';
  const status = error instanceof z.ZodError ? 422 : code === 'UNAUTHORIZED' ? 401 : code === 'TOO_LARGE' ? 413 : 500;
  return privateJson({ ok: false, error: status === 401 ? 'Accedi per gestire le tue statistiche.' : 'Impossibile aggiornare le statistiche. Riprova.' }, status);
 }
}
export const GET = (req: NextRequest) => handle(req, false);
export const POST = (req: NextRequest) => handle(req, true);
