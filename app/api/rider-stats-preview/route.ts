import { NextRequest } from 'next/server';
import { z } from 'zod';
import { privateJson, sessionBody } from '@/lib/session-invites-server';
import { localSessionPreview, previewDatabase } from '@/lib/rider-preview-server';
import { PREVIEW_ACTOR, PREVIEW_TOKEN } from '@/lib/rider-preview';
export const dynamic = 'force-dynamic';
async function handle(req: NextRequest, write: boolean) {
 if (!localSessionPreview(req.headers.get('host'))) return privateJson({ ok: false }, 404);
 const target = req.nextUrl.searchParams.get('target');
 if ((write || target === null) && req.headers.get('authorization') !== `Bearer ${PREVIEW_TOKEN}`) return privateJson({ ok: false }, 401);
 try {
  const db = await previewDatabase();
  const result = !write && target !== null
   ? await db.query('select cm_rider_public_stats($1,null) as data', [z.string().uuid().parse(target)])
   : await db.query('select cm_rider_stats_preference($1,$2) as data', [PREVIEW_ACTOR, write ? z.object({ shared: z.boolean() }).strict().parse(await sessionBody(req)).shared : null]);
  return privateJson({ ok: true, data: (result.rows[0] as { data: unknown }).data });
 } catch { return privateJson({ ok: false, error: 'Anteprima statistiche non disponibile.' }, 422); }
}
export const GET = (req: NextRequest) => handle(req, false);
export const POST = (req: NextRequest) => handle(req, true);
