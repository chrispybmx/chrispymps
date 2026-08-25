import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { onStatusConfirmed, getXPSummary } from '@/lib/xp';
import { UUID_RE } from '@/lib/validation';
import { CONDIZIONI_TUTTE } from '@/lib/constants';

const MAX_CONFIRMATIONS_PER_WEEK = 5;

const Schema = z.object({
  spot_id: z.string().regex(UUID_RE),
  condition: z.enum(CONDIZIONI_TUTTE),
  note: z.string().max(300).optional(),
  access_token: z.string().min(1),
});

/**
 * POST /api/status-confirm
 * Authenticated user confirms/updates spot status.
 * Creates spot_status_update + spot_contribution record.
 */
export async function POST(req: NextRequest) {
  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'Dati non validi.' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // 1. Verify auth
  const { data: { user }, error: authErr } = await supabase.auth.getUser(body.access_token);
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: 'Non autenticato.' }, { status: 401 });
  }

  // 2. Verify spot exists and is approved
  const { data: spot } = await supabase
    .from('spots')
    .select('id, name, condition')
    .eq('id', body.spot_id)
    .eq('status', 'approved')
    .single();

  if (!spot) {
    return NextResponse.json({ ok: false, error: 'Spot non trovato.' }, { status: 404 });
  }

  // 3. Anti-spam: max confirmations per week
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('spot_status_updates')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', weekAgo);

  if ((count ?? 0) >= MAX_CONFIRMATIONS_PER_WEEK) {
    return NextResponse.json({
      ok: false,
      error: `Limite settimanale di ${MAX_CONFIRMATIONS_PER_WEEK} conferme raggiunto.`,
    }, { status: 429 });
  }

  // 4. Prevent duplicate confirmation on same spot within 24h
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentOnSpot } = await supabase
    .from('spot_status_updates')
    .select('id', { count: 'exact', head: true })
    .eq('spot_id', body.spot_id)
    .eq('user_id', user.id)
    .gte('created_at', dayAgo);

  if ((recentOnSpot ?? 0) > 0) {
    return NextResponse.json({
      ok: false,
      error: 'Hai già confermato questo spot nelle ultime 24 ore.',
    }, { status: 429 });
  }

  // 5. Create contribution record
  const { data: contribution } = await supabase
    .from('spot_contributions')
    .insert({
      user_id: user.id,
      spot_id: body.spot_id,
      contribution_type: 'status_confirmation',
      status: 'approved', // status confirmations auto-approved
      metadata: {
        condition: body.condition,
        previous_condition: spot.condition,
        note: body.note || null,
      },
    })
    .select('id')
    .single();

  // 6. Create status update
  await supabase.from('spot_status_updates').insert({
    spot_id: body.spot_id,
    condition: body.condition,
    note: body.note || null,
    user_id: user.id,
    contribution_id: contribution?.id,
  });

  // 7. Update spot condition
  if (body.condition === spot.condition) {
    // Same condition = confirmed, just update timestamp
    await supabase
      .from('spots')
      .update({ condition_updated_at: new Date().toISOString() })
      .eq('id', body.spot_id);

    // Award XP (await so we can read summary after)
    const xpBefore = await getXPSummary(user.id);
    await onStatusConfirmed(user.id, body.spot_id, contribution?.id);
    const xpAfter = await getXPSummary(user.id);

    return NextResponse.json({
      ok: true,
      message: 'Stato confermato! Grazie per tenere la mappa aggiornata. +5 XP',
      xp: { awarded: 5, total: xpAfter.lifetime_xp, level: xpAfter.current_level, leveledUp: xpAfter.current_level !== xpBefore.current_level },
    });
  }

  // Different condition → check if multiple users agree before changing
  // Count recent confirmations (last 30 days) with same new condition
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count: agreeCount } = await supabase
    .from('spot_status_updates')
    .select('id', { count: 'exact', head: true })
    .eq('spot_id', body.spot_id)
    .eq('condition', body.condition)
    .gte('created_at', thirtyDaysAgo);

  const totalAgree = (agreeCount ?? 0); // includes the one we just inserted

  if (totalAgree >= 2) {
    // 2+ users agree → change the condition
    await supabase
      .from('spots')
      .update({
        condition: body.condition,
        condition_updated_at: new Date().toISOString(),
      })
      .eq('id', body.spot_id);

    const xpBefore2 = await getXPSummary(user.id);
    await onStatusConfirmed(user.id, body.spot_id, contribution?.id);
    const xpAfter2 = await getXPSummary(user.id);

    return NextResponse.json({
      ok: true,
      message: `Stato aggiornato a "${body.condition}"! Confermato da ${totalAgree} utenti. +5 XP`,
      xp: { awarded: 5, total: xpAfter2.lifetime_xp, level: xpAfter2.current_level, leveledUp: xpAfter2.current_level !== xpBefore2.current_level },
    });
  }

  // First report of different condition → don't change yet, award XP anyway
  const xpBefore3 = await getXPSummary(user.id);
  await onStatusConfirmed(user.id, body.spot_id, contribution?.id);
  const xpAfter3 = await getXPSummary(user.id);

  return NextResponse.json({
    ok: true,
    message: `Segnalazione "${body.condition}" registrata. Serve un'altra conferma per aggiornare lo stato. +5 XP`,
    xp: { awarded: 5, total: xpAfter3.lifetime_xp, level: xpAfter3.current_level, leveledUp: xpAfter3.current_level !== xpBefore3.current_level },
  });
}
