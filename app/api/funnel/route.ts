import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/funnel — telemetria di percorso, anonima.
 *
 * Cosa NON registra, di proposito: nessun user_id, nessun indirizzo IP,
 * nessun contenuto digitato. Solo "a che punto è arrivato" e "quanto ci ha
 * messo". `attempt_id` lo genera il browser e serve a legare fra loro gli
 * eventi dello stesso tentativo: non identifica una persona e cambia a ogni
 * apertura del modulo.
 *
 * Perché passa da qui e non scrive il browser: senza questa rotta servirebbe
 * una policy che permette a chiunque di scrivere sulla tabella, e diventerebbe
 * una porta aperta. Qui c'è il service role e un limite di frequenza.
 *
 * Volume: qualche evento per tentativo di registrazione. È il motivo per cui
 * questa telemetria può stare nel database, mentre tracciare ogni click no.
 */

export const dynamic = 'force-dynamic';

const PASSI = new Set([
  'aperto', 'campo', 'inviato', 'riuscito', 'errore', 'abbandonato',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function testo(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const attemptId = typeof body.attemptId === 'string' && UUID_RE.test(body.attemptId)
    ? body.attemptId : null;
  const step = typeof body.step === 'string' && PASSI.has(body.step) ? body.step : null;

  if (!attemptId || !step) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const ms = Number(body.msFromStart);

  const { error } = await supabaseAdmin().from('funnel_events').insert({
    attempt_id:    attemptId,
    flow:          testo(body.flow, 30) ?? 'signup',
    step,
    field:         testo(body.field, 40),
    ms_from_start: Number.isFinite(ms) && ms >= 0 && ms < 3_600_000 ? Math.round(ms) : null,
    detail:        testo(body.detail, 200),
  });

  if (error) {
    /* La telemetria non deve mai diventare il motivo per cui qualcosa si
       rompe: si logga e si risponde ok comunque. */
    console.error('[api/funnel]', error.message);
  }

  return NextResponse.json({ ok: true });
}
