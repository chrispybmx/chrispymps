import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyApproveToken, isAdminAuthenticated } from '@/lib/auth';
import { sendRejectionEmail } from '@/lib/email';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.redirect(new URL('/admin?error=token_missing', req.url));

  // Il token di reject è firmato con prefix "reject:"
  const payload = verifyApproveToken(token);
  if (!payload || !payload.startsWith('reject:')) {
    return NextResponse.redirect(new URL('/admin?error=token_invalid', req.url));
  }
  const spotId = payload.replace('reject:', '');

  return rejectSpot(spotId, req, undefined);
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { spot_id, reason } = body;
  if (!spot_id) return NextResponse.json({ ok: false, error: 'spot_id mancante' }, { status: 400 });

  return rejectSpot(spot_id, req, reason);
}

async function rejectSpot(spotId: string, req: NextRequest, reason?: string): Promise<NextResponse> {
  const supabase = supabaseAdmin();

  const { data: spot, error: fetchErr } = await supabase
    .from('spots')
    .select('*, contributors(*)')
    .eq('id', spotId)
    .single();

  if (fetchErr || !spot) {
    return NextResponse.json({ ok: false, error: 'Spot non trovato' }, { status: 404 });
  }

  const { error: updateErr } = await supabase
    .from('spots')
    .update({ status: 'rejected', reviewer_notes: reason ?? null })
    .eq('id', spotId);

  if (updateErr) {
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
  }

  if (spot.contributors) {
    sendRejectionEmail(spot.contributors, spot, reason).catch(console.error);
  }

  if (req.method === 'GET') {
    return NextResponse.redirect(new URL('/admin?msg=rejected', req.url));
  }
  return NextResponse.json({ ok: true });
}
