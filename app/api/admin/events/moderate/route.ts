import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyEventActionToken } from '@/lib/auth';

/**
 * GET /api/admin/events/moderate?action=approve|reject&token=...
 * Moderazione eventi via link email (token HMAC, scadenza 7gg).
 * Stesso pattern dei link approva/rifiuta degli spot: nessun login richiesto,
 * il token firmato È l'autorizzazione.
 */

function page(title: string, body: string, ok: boolean): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="background:#0a0a0a;color:#f3ead8;font-family:'Courier New',monospace;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;">
<div style="background:#1a1a1a;border:1px solid ${ok ? '#00c851' : '#ff4444'};border-radius:6px;padding:32px;max-width:480px;text-align:center;">
<h1 style="color:${ok ? '#00c851' : '#ff4444'};font-size:22px;margin:0 0 12px;">${title}</h1>
<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 20px;">${body}</p>
<a href="https://maps.chrispybmx.com/admin" style="color:#ff6a00;">→ Apri la dashboard admin</a>
</div></body></html>`,
    { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

/**
 * GET — NON modera piu'. Porta alla pagina di conferma.
 *
 * Stesso difetto trovato in app/api/admin/approve il 26/08: il link vive in
 * un'email, e le GET le seguono anche gli antivirus della posta e i
 * generatori di anteprima. Qui era pure peggio, perche' il token degli eventi
 * dura 7 giorni invece di 72 ore: finestra piu' larga.
 */
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');
  const token  = req.nextUrl.searchParams.get('token') ?? '';

  if (action !== 'approve' && action !== 'reject') {
    return page('Azione non valida', 'Il link è malformato.', false);
  }
  if (!verifyEventActionToken(token, action)) {
    return page('Link scaduto o non valido', 'Il link di moderazione è scaduto (7 giorni) o non è valido. Usa la dashboard admin.', false);
  }

  return NextResponse.redirect(new URL(
    `/admin/conferma?evento=${encodeURIComponent(token)}&azione=${action}`,
    req.url,
  ));
}

/** POST — modera davvero. Il token resta la credenziale, il metodo no. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { token, azione } = body as { token?: string; azione?: string };

  if (azione !== 'approve' && azione !== 'reject') {
    return NextResponse.json({ ok: false, error: 'Azione non valida' }, { status: 400 });
  }
  if (typeof token !== 'string' || !token) {
    return NextResponse.json({ ok: false, error: 'Token mancante' }, { status: 400 });
  }

  const eventId = verifyEventActionToken(token, azione);
  if (!eventId) {
    return NextResponse.json({ ok: false, error: 'Link scaduto o non valido. Usa la dashboard.' }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const { data: event } = await supabase
    .from('events')
    .select('id, title, moderation_status')
    .eq('id', eventId)
    .maybeSingle();

  if (!event) {
    return NextResponse.json({ ok: false, error: 'Evento non trovato. Forse è già stato eliminato.' }, { status: 404 });
  }

  /* Si modera SOLO cio' che e' in attesa. Qui il token dura SETTE GIORNI, non
     72 ore: senza questo controllo una decisione poteva essere ribaltata per
     una settimana usando l'altro link della stessa email. */
  if (event.moderation_status !== 'pending') {
    return NextResponse.json({
      ok: false,
      error: 'Questo evento è già stato deciso. Se vuoi cambiare, usa la dashboard.',
      stato: event.moderation_status,
    }, { status: 409 });
  }

  const fields = azione === 'approve'
    ? { status: 'published', moderation_status: 'published' }
    : { status: 'draft',     moderation_status: 'rejected' };

  const { data: aggiornati, error } = await supabase.from('events').update(fields)
    .eq('id', eventId)
    .eq('moderation_status', 'pending')
    .select('id');

  /* Se la UPDATE non ha toccato nessuna riga significa che, fra la lettura e
     la scrittura, qualcun altro ha gia' deciso. Postgrest NON segnala errore in
     quel caso: senza questo controllo il codice proseguiva come se avesse
     funzionato — mandando l'email, la notifica, gli XP e rispondendo ok.
     Nel caso peggiore approve e reject in parallelo: uno vince sul database e
     l'altro manda comunque l'email opposta. */
  if (!error && (!aggiornati || aggiornati.length === 0)) {
    return NextResponse.json({
      ok: false,
      error: 'Qualcun altro ha appena deciso su questo evento. Ricarica la dashboard.',
    }, { status: 409 });
  }
  if (error) {
    console.error('[events/moderate] update error:', error.message);
    return NextResponse.json({ ok: false, error: 'Aggiornamento fallito. Riprova dalla dashboard.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    messaggio: azione === 'approve'
      ? `«${event.title}» è ora nel calendario eventi.`
      : `«${event.title}» è stato rifiutato.`,
  });
}
