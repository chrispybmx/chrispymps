import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { subscribeToNewsletter, GROUP_BY_SOURCE } from '@/lib/mailerlite';
import {
  puoRicevereMarketing,
  normalizzaDiscipline,
  normalizzaAnnoInizio,
  ETA_MINIMA_MARKETING,
} from '@/lib/rider-profile';

/**
 * POST /api/rider/details
 * Salva i dati del rider e decide se può ricevere la newsletter.
 *
 * Perché passa dal server e non scrive il client: la regola sull'età deve
 * valere davvero. Dal browser chiunque può omettere la data di nascita o
 * dichiararne una falsa; qui la data viene letta dal corpo della richiesta ma
 * l'iscrizione a MailerLite parte solo se il calcolo lo consente, e il calcolo
 * lo fa il server. La scrittura usa il service role, così funziona anche prima
 * che la sessione sia del tutto propagata.
 *
 * Richiede Bearer token: si scrive solo sul proprio profilo.
 */

export const dynamic = 'force-dynamic';

interface Corpo {
  birthDate?:   string | null;
  region?:      string | null;
  disciplines?: unknown;
  ridingSinceYear?: unknown;
  setupBrand?:  string | null;
  newsletter?:  boolean;
  /** Serve solo per l'iscrizione a MailerLite. */
  username?:    string;
}

/** 'YYYY-MM-DD' plausibile, altrimenti null. */
function dataValida(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const anno = d.getFullYear();
  if (anno < 1920 || d.getTime() > Date.now()) return null;
  return v;
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: { user }, error: userErr } = await sb.auth.getUser(auth.slice(7));
  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: 'Sessione scaduta' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Corpo;

  const birthDate   = dataValida(body.birthDate);
  const region      = typeof body.region === 'string' && body.region.trim() ? body.region.trim().slice(0, 60) : null;
  const disciplines = normalizzaDiscipline(body.disciplines);
  const ridingSinceYear = normalizzaAnnoInizio(body.ridingSinceYear);
  const setupBrand  = typeof body.setupBrand === 'string' && body.setupBrand.trim() ? body.setupBrand.trim().slice(0, 80) : null;
  const vuoleNewsletter = body.newsletter === true;

  /* La regola sui minorenni si applica qui, dove il client non arriva. */
  const puoEssereIscritto = vuoleNewsletter && puoRicevereMarketing(birthDate);

  const { error: upsertErr } = await sb
    .from('rider_details')
    .upsert({
      user_id:              user.id,
      birth_date:           birthDate,
      region,
      disciplines,
      riding_since_year:    ridingSinceYear,
      setup_brand:          setupBrand,
      newsletter_opt_in:    puoEssereIscritto,
      newsletter_opt_in_at: puoEssereIscritto ? new Date().toISOString() : null,
      updated_at:           new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (upsertErr) {
    console.error('[api/rider/details] upsert error:', upsertErr.message, upsertErr);
    return NextResponse.json({ ok: false, error: 'Salvataggio non riuscito' }, { status: 500 });
  }

  /* MailerLite riceve solo indirizzo e gruppo: l'anagrafica resta da noi. */
  if (puoEssereIscritto && user.email) {
    const nome = body.username || user.user_metadata?.username || '';
    await subscribeToNewsletter(user.email, nome, {
      source:  'newsletter',
      groupId: GROUP_BY_SOURCE.newsletter,
    }).catch((e) => console.error('[api/rider/details] MailerLite:', e));
  }

  return NextResponse.json({
    ok: true,
    /* Utile al client per non promettere una newsletter che non partirà. */
    newsletterAttiva: puoEssereIscritto,
    motivo: vuoleNewsletter && !puoEssereIscritto
      ? `Sotto i ${ETA_MINIMA_MARKETING} anni non inviamo comunicazioni`
      : undefined,
  });
}
