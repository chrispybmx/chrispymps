import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { deliverSessionInviteEmail, sessionEmailEnabled } from '@/lib/session-invite-email';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = { 'Cache-Control':'private, no-store', 'X-Robots-Tag':'noindex, nofollow' };
// Vercel Cron uses GET and CRON_SECRET; external schedulers may use POST.
export async function GET(req: NextRequest) {
  return runWorker(req, process.env.CRON_SECRET);
}
export async function POST(req: NextRequest) {
  return runWorker(req, process.env.SESSION_INVITES_CRON_SECRET || process.env.CRON_SECRET);
}
async function runWorker(req: NextRequest, secret: string | undefined) {
  const authorization = req.headers.get('authorization') ?? '';
  const expected = secret ? 'Bearer ' + secret : '';
  const suppliedBytes = Buffer.from(authorization);
  const expectedBytes = Buffer.from(expected);
  if (!expected || suppliedBytes.length !== expectedBytes.length ||
      !timingSafeEqual(suppliedBytes, expectedBytes)) {
    return NextResponse.json({ok:false,error:'Non autorizzato'},{status:401,headers});
  }
  if (!sessionEmailEnabled()) return NextResponse.json({ok:true,disabled:true},{headers});
  try {
    const sb = supabaseAdmin();
    const now = new Date().toISOString();
    const {data,error} = await sb.from('cm_session_email_outbox')
      .select('invite_id').is('sent_at',null).lt('attempts',8).lte('next_attempt_at',now)
      .or('locked_until.is.null,locked_until.lt.'+now).order('next_attempt_at').limit(10);
    if (error) throw error;
    const results = await Promise.allSettled((data ?? []).map(job => deliverSessionInviteEmail({id:job.invite_id})));
    const pending = results.filter(r => r.status === 'rejected' || r.value === 'retry' || r.value === 'disabled').length;
    const exhausted = await sb.from('cm_session_email_outbox')
      .select('invite_id', { count: 'exact', head: true }).is('sent_at', null).gte('attempts', 8);
    if (exhausted.error) throw exhausted.error;
    const requiresReview = exhausted.count ?? 0;
    const ok = pending === 0 && requiresReview === 0;
    return NextResponse.json({
      ok, processed:results.length,
      sent:results.filter(r=>r.status==='fulfilled'&&r.value==='sent').length,
      pending, requiresReview,
    }, {status:ok ? 200 : 503, headers});
  } catch {
    // Only aggregate outcomes leave this endpoint, never recipient or provider data.
    return NextResponse.json({ok:false,error:'Coda non disponibile'},{status:503,headers});
  }
}
