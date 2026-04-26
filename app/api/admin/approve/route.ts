import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyApproveToken, isAdminAuthenticated } from '@/lib/auth';
import { sendApprovalEmail } from '@/lib/email';

export async function GET(req: NextRequest) {
  // Approvazione via link email (token HMAC nel query string)
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/admin?error=token_missing', req.url));
  }

  const spotId = verifyApproveToken(token);
  if (!spotId) {
    return NextResponse.redirect(new URL('/admin?error=token_invalid', req.url));
  }

  return approveSpot(spotId, req);
}

export async function POST(req: NextRequest) {
  // Approvazione dalla dashboard admin (richiede sessione autenticata)
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { spot_id } = body;
  if (!spot_id) {
    return NextResponse.json({ ok: false, error: 'spot_id mancante' }, { status: 400 });
  }

  return approveSpot(spot_id, req);
}

async function approveSpot(spotId: string, req: NextRequest): Promise<NextResponse> {
  const supabase = supabaseAdmin();

  const { data: spot, error: fetchErr } = await supabase
    .from('spots')
    .select('*, contributors(*)')
    .eq('id', spotId)
    .single();

  if (fetchErr || !spot) {
    return NextResponse.json({ ok: false, error: 'Spot non trovato' }, { status: 404 });
  }

  if (spot.status === 'approved') {
    // Già approvato — redirect dashboard
    if (req.method === 'GET') return NextResponse.redirect(new URL('/admin?msg=already_approved', req.url));
    return NextResponse.json({ ok: true, msg: 'già approvato' });
  }

  const { error: updateErr } = await supabase
    .from('spots')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', spotId);

  if (updateErr) {
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
  }

  // Email al contributor (fire-and-forget)
  if (spot.contributors) {
    sendApprovalEmail(spot.contributors, spot).catch(console.error);
  }

  // Notifica in-app all'utente autenticato che ha inviato lo spot (fire-and-forget)
  if (spot.submitted_by_user_id) {
    supabase.from('notifications').insert({
      user_id:   spot.submitted_by_user_id,
      type:      'spot_approved',
      title:     `"${spot.name}" è stato approvato! 🎉`,
      body:      'Il tuo spot è ora visibile sulla mappa. Grazie per il contributo!',
      spot_slug: spot.slug,
    }).then().catch(console.error);
  }

  if (req.method === 'GET') {
    // SEC-FIX: encodeURIComponent per evitare che caratteri speciali rompano la URL
    return NextResponse.redirect(new URL(`/admin?msg=approved&spot=${encodeURIComponent(spot.name)}`, req.url));
  }
  return NextResponse.json({ ok: true, data: { id: spotId, slug: spot.slug } });
}
