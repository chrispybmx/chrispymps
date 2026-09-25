import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { deliverSessionInviteEmail, sessionEmailEnabled } from '@/lib/session-invite-email';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = { 'Cache-Control':'private, no-store', 'X-Robots-Tag':'noindex, nofollow' };
export async function POST(req: NextRequest) {
  const secret = process.env.SESSION_INVITES_CRON_SECRET;
  const authorization = req.headers.get('authorization') ?? '';
  const expected = secret ? 'Bearer ' + secret : '';
  const suppliedBytes = Buffer.from(authorization);
  const expectedBytes = Buffer.from(expected);
  if (!expected || suppliedBytes.length !== expectedBytes.length ||
      !timingSafeEqual(suppliedBytes, expectedBytes)) {
    return NextResponse.json({ok:false,error:'Non autorizzato'},{status:401,headers});
  }
  if (!sessionEmailEnabled()) return NextResponse.json({ok:true,disabled:true},{headers});
  const now = new Date().toISOString();
  const {data,error} = await supabaseAdmin().from('cm_session_email_outbox')
    .select('invite_id').is('sent_at',null).lt('attempts',8).lte('next_attempt_at',now)
    .or('locked_until.is.null,locked_until.lt.'+now).order('next_attempt_at').limit(10);
  if (error) return NextResponse.json({ok:false,error:'Coda non disponibile'},{status:503,headers});
  const results = await Promise.allSettled((data ?? []).map(job => deliverSessionInviteEmail({id:job.invite_id})));
  return NextResponse.json({ok:true,processed:results.length,sent:results.filter(r=>r.status==='fulfilled'&&r.value==='sent').length},{headers});
}
