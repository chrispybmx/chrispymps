import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyApproveToken, isAdminAuthenticated } from '@/lib/auth';
import { sendApprovalEmail } from '@/lib/email';
import { onSpotApproved } from '@/lib/xp';
import { submitToIndexNow } from '@/lib/indexnow';
import { APP_CONFIG } from '@/lib/constants';

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

  // Effetti collaterali AWAITED. Non possono essere fire-and-forget: su
  // serverless il container si congela dopo il return e le promise non attese
  // non completano (email mai inviata, notifica mai inserita, XP mai assegnati).
  // Ognuno e isolato: un fallimento non deve annullare l'approvazione.
  if (spot.contributors) {
    try { await sendApprovalEmail(spot.contributors, spot); }
    catch (e) { console.error('[approve] email:', e); }
  }

  if (spot.submitted_by_user_id) {
    const { error: notifErr } = await supabase.from('notifications').insert({
      user_id:   spot.submitted_by_user_id,
      type:      'spot_approved',
      title:     `"${spot.name}" è stato approvato! 🎉`,
      body:      'Il tuo spot è ora visibile sulla mappa! +10 XP \ud83c\udf89',
      spot_slug: spot.slug,
    });
    if (notifErr) console.error('[approve] notifica:', notifErr.message);

    try { await onSpotApproved(spot.submitted_by_user_id, spotId, undefined, spot.city); }
    catch (e) { console.error('[approve] XP:', e); }
  }

  // Invalida le pagine cachate: senza questo un nuovo spot approvato non appare
  // su mappa/home per un massimo di 5 minuti (ISR revalidate=300) e sembra che
  // l'approvazione non abbia funzionato.
  const cityPath = spot.city ? `/map/${spot.city.toLowerCase().replace(/\s+/g, '-')}` : null;
  try {
    revalidatePath(`/map/spot/${spot.slug}`);
    revalidatePath('/');
    revalidatePath('/scopri');
    if (cityPath) revalidatePath(cityPath);
  } catch (e) {
    console.error('[approve] revalidate:', e);
  }

  // Segnala la pagina appena pubblicata ai motori (Bing/Copilot): il sottodominio
  // ha pochi backlink, quindi senza ping i crawler ci mettono settimane.
  await submitToIndexNow([
    `${APP_CONFIG.url}/map/spot/${spot.slug}`,
    ...(cityPath ? [`${APP_CONFIG.url}${cityPath}`] : []),
  ]);

  if (req.method === 'GET') {
    // SEC-FIX: encodeURIComponent per evitare che caratteri speciali rompano la URL
    return NextResponse.redirect(new URL(`/admin?msg=approved&spot=${encodeURIComponent(spot.name)}`, req.url));
  }
  return NextResponse.json({ ok: true, data: { id: spotId, slug: spot.slug } });
}
