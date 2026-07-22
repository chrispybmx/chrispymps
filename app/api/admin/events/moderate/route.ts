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

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');
  const token  = req.nextUrl.searchParams.get('token') ?? '';

  if (action !== 'approve' && action !== 'reject') {
    return page('Azione non valida', 'Il link è malformato.', false);
  }

  const eventId = verifyEventActionToken(token, action);
  if (!eventId) {
    return page('Link scaduto o non valido', 'Il link di moderazione è scaduto (7 giorni) o non è valido. Usa la dashboard admin.', false);
  }

  const supabase = supabaseAdmin();
  const { data: event } = await supabase
    .from('events')
    .select('id, title, event_date, city, moderation_status')
    .eq('id', eventId)
    .maybeSingle();

  if (!event) return page('Evento non trovato', 'Forse è già stato eliminato.', false);

  const fields = action === 'approve'
    ? { status: 'published', moderation_status: 'published' }
    : { status: 'draft',     moderation_status: 'rejected' };

  const { error } = await supabase.from('events').update(fields).eq('id', eventId);
  if (error) {
    console.error('[events/moderate] update error:', error.message);
    return page('Errore', 'Aggiornamento fallito. Riprova dalla dashboard.', false);
  }

  const when = event.event_date ? new Date(event.event_date).toLocaleDateString('it-IT') : '';
  return action === 'approve'
    ? page('✅ Evento pubblicato', `«${event.title}»${when ? ` (${when})` : ''} è ora visibile nel calendario eventi.`, true)
    : page('❌ Evento rifiutato', `«${event.title}» è stato rifiutato e non sarà pubblicato.`, true);
}
