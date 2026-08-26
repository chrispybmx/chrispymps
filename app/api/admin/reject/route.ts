import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyRejectToken, isAdminAuthenticated } from '@/lib/auth';
import { sendRejectionEmail } from '@/lib/email';

/**
 * GET — NON rifiuta piu'. Porta alla pagina di conferma.
 * Stesso motivo di app/api/admin/approve: un link in un'email viene aperto
 * anche dalle macchine, e una GET non deve cambiare lo stato di niente.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.redirect(new URL('/admin?error=token_missing', req.url));

  // Token dedicato con separatore '|', non quello di approvazione.
  if (!verifyRejectToken(token)) {
    return NextResponse.redirect(new URL('/admin?error=token_invalid', req.url));
  }

  return NextResponse.redirect(new URL(`/admin/conferma?rifiuta=${encodeURIComponent(token)}`, req.url));
}

/** POST — rifiuta davvero. Sessione admin oppure token dell'email. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { spot_id, reason, token } = body as { spot_id?: string; reason?: string; token?: string };

  let spotId: string | null = null;

  if (typeof token === 'string' && token) {
    spotId = verifyRejectToken(token);
    if (!spotId) {
      return NextResponse.json({ ok: false, error: 'Link scaduto o non valido. Rifiuta dalla dashboard.' }, { status: 401 });
    }
  } else if (isAdminAuthenticated()) {
    if (!spot_id) return NextResponse.json({ ok: false, error: 'spot_id mancante' }, { status: 400 });
    spotId = spot_id;
  } else {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  return rejectSpot(spotId, req, reason);
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

  // Effetti collaterali AWAITED (vedi approve/route.ts): su serverless una
  // promise non attesa dopo il return non completa -> email e notifica perse.
  if (spot.contributors) {
    try { await sendRejectionEmail(spot.contributors, spot, reason); }
    catch (e) { console.error('[reject] email:', e); }
  }

  if (spot.submitted_by_user_id) {
    const reasonNote = reason ? ` Motivo: ${reason.slice(0, 100)}` : '';
    const { error: notifErr } = await supabase.from('notifications').insert({
      user_id:   spot.submitted_by_user_id,
      type:      'spot_rejected',
      title:     `"${spot.name}" non è stato approvato`,
      body:      `Il tuo spot non soddisfa i requisiti della mappa.${reasonNote}`,
      spot_slug: spot.slug,
    });
    if (notifErr) console.error('[reject] notifica:', notifErr.message);
  }

  if (req.method === 'GET') {
    return NextResponse.redirect(new URL('/admin?msg=rejected', req.url));
  }
  return NextResponse.json({ ok: true });
}
