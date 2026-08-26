import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyApproveToken, isAdminAuthenticated } from '@/lib/auth';
import { sendApprovalEmail } from '@/lib/email';
import { onSpotApproved } from '@/lib/xp';
import { submitToIndexNow } from '@/lib/indexnow';
import { APP_CONFIG } from '@/lib/constants';

/**
 * GET — NON approva piu'. Porta alla pagina di conferma.
 *
 * Prima questa rotta approvava lo spot al solo essere aperta. Ma il link vive
 * dentro un'email, e le GET non le apre solo chi clicca: le seguono gli
 * antivirus della posta, i filtri aziendali, i generatori di anteprima, il
 * prefetch del browser.
 *
 * E' successo davvero. Lo spot «Thermal forum» di Natanael risulta approvato
 * 24 secondi dopo l'invio; tutti gli altri spot del database vanno da 3 minuti
 * a 25 ore. Ventiquattro secondi e' il tempo di consegna di un'email piu' una
 * scansione automatica, non quello di una persona che legge e decide.
 *
 * Il token non c'entra: e' HMAC-SHA256 con segreto e scadenza, non e'
 * falsificabile. Il difetto era la forma della richiesta. Ora la GET mostra
 * soltanto, e a cambiare lo stato e' una POST — che nessuna macchina fa per
 * sbaglio seguendo un link.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/admin?error=token_missing', req.url));
  }
  if (!verifyApproveToken(token)) {
    return NextResponse.redirect(new URL('/admin?error=token_invalid', req.url));
  }
  return NextResponse.redirect(new URL(`/admin/conferma?token=${encodeURIComponent(token)}`, req.url));
}

/**
 * POST — approva davvero.
 *
 * Due credenziali possibili: la sessione admin (dalla dashboard) oppure il
 * token dell'email (dalla pagina di conferma). Il token serve perche' il
 * senso del link e' proprio poter approvare dal telefono senza fare il login.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { spot_id, token } = body as { spot_id?: string; token?: string };

  let spotId: string | null = null;

  if (typeof token === 'string' && token) {
    spotId = verifyApproveToken(token);
    if (!spotId) {
      return NextResponse.json({ ok: false, error: 'Link scaduto o non valido. Approva dalla dashboard.' }, { status: 401 });
    }
  } else if (isAdminAuthenticated()) {
    if (!spot_id) {
      return NextResponse.json({ ok: false, error: 'spot_id mancante' }, { status: 400 });
    }
    spotId = spot_id;
  } else {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  return approveSpot(spotId, req);
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

  /* ── Avvisa chi gira in quella regione ──
     Chi ha indicato la propria regione in fase di registrazione riceve una
     notifica quando lì compare uno spot nuovo. È il motivo più concreto per
     riaprire l'app: non "è successo qualcosa", ma "è successo qualcosa dove
     giri tu".
     Isolato come il resto: se fallisce, l'approvazione resta valida. */
  if (spot.region) {
    try {
      const { data: vicini } = await supabase
        .from('rider_details')
        .select('user_id')
        .eq('region', spot.region);

      const destinatari = (vicini ?? [])
        .map(v => v.user_id as string)
        .filter(id => id !== spot.submitted_by_user_id);

      if (destinatari.length) {
        const { error } = await supabase.from('notifications').insert(
          destinatari.map(user_id => ({
            user_id,
            type:      'spot_nearby',
            title:     `Nuovo spot in ${spot.region}`,
            body:      `"${spot.name}"${spot.city ? ` a ${spot.city}` : ''} — vai a vedere com'è messo.`,
            spot_slug: spot.slug,
          })),
        );
        if (error) console.error('[approve] notifiche regione:', error.message);
      }
    } catch (e) {
      console.error('[approve] notifiche regione:', e);
    }
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
