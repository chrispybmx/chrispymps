import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { onStatusConfirmed, getXPSummary } from '@/lib/xp';
import { UUID_RE } from '@/lib/validation';
import { CONDIZIONI_TUTTE } from '@/lib/constants';
import { CONSENSUS_WINDOW_MS, countStatusAgreement, type StatusVote } from '@/lib/spot-status-consensus';
import { conditionText } from '@/lib/spot-trust';
import { getSiteLanguage } from '@/lib/language-server';

const MAX_CONFIRMATIONS_PER_WEEK = 5;
const Schema = z.object({
  spot_id: z.string().regex(UUID_RE), condition: z.enum(CONDIZIONI_TUTTE),
  note: z.string().trim().max(300).optional(), access_token: z.string().min(1).max(4096),
});

export async function POST(req: NextRequest) {
  const language = getSiteLanguage();
  const text = (it: string, en: string) => language === 'en' ? en : it;
  const failure = () => NextResponse.json({ ok: false, error: text('Non siamo riusciti a salvare la segnalazione. Riprova.', 'We could not save your report. Please try again.') }, { status: 503 });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: text('Dati non validi.', 'Invalid details.') }, { status: 400 });
  const body = parsed.data;
  const supabase = supabaseAdmin();
  let contributionId: string | null = null;
  let updateId: string | null = null;

  // Compensate only rows created by this request. No XP has been awarded yet.
  // A database transaction remains a separate migration; the current endpoint
  // works with the existing schema and never reports success on a failed write.
  const rollback = async () => {
    if (updateId) {
      const { error } = await supabase.from('spot_status_updates').delete().eq('id', updateId);
      if (error) { console.error('[status-confirm] rollback update failed'); return; }
    }
    if (contributionId) {
      const { error } = await supabase.from('spot_contributions').delete().eq('id', contributionId);
      if (error) console.error('[status-confirm] rollback contribution failed');
    }
  };

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(body.access_token);
    if (authError || !user) return NextResponse.json({ ok: false, error: text('Non autenticato.', 'Sign in to continue.') }, { status: 401 });
    const { data: spot, error: spotError } = await supabase.from('spots')
      .select('id, name, slug, condition').eq('id', body.spot_id).eq('status', 'approved').maybeSingle();
    if (spotError) return failure();
    if (!spot) return NextResponse.json({ ok: false, error: text('Spot non trovato.', 'Spot not found.') }, { status: 404 });

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const dayAgo = new Date(now.getTime() - 86400000).toISOString();
    const [weekly, recent] = await Promise.all([
      supabase.from('spot_status_updates').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', weekAgo),
      supabase.from('spot_status_updates').select('id', { count: 'exact', head: true }).eq('spot_id', body.spot_id).eq('user_id', user.id).gte('created_at', dayAgo),
    ]);
    if (weekly.error || recent.error || weekly.count === null || recent.count === null) return failure();
    if (weekly.count >= MAX_CONFIRMATIONS_PER_WEEK) return NextResponse.json({ ok: false, error: text('Hai raggiunto il limite di 5 segnalazioni a settimana.', 'You have reached the limit of 5 reports per week.') }, { status: 429 });
    if (recent.count > 0) return NextResponse.json({ ok: false, error: text('Hai già segnalato questo spot nelle ultime 24 ore.', 'You already reported this spot in the last 24 hours.') }, { status: 429 });

    const { data: contribution, error: contributionError } = await supabase.from('spot_contributions').insert({
      user_id: user.id, spot_id: body.spot_id, contribution_type: 'status_confirmation', status: 'approved',
      metadata: { condition: body.condition, previous_condition: spot.condition, note: body.note || null },
    }).select('id').single();
    if (contributionError || !contribution) return failure();
    contributionId = contribution.id;

    const { data: update, error: updateError } = await supabase.from('spot_status_updates').insert({
      spot_id: body.spot_id, condition: body.condition, note: body.note || null, user_id: user.id, contribution_id: contributionId,
    }).select('id').single();
    if (updateError || !update) { await rollback(); return failure(); }
    updateId = update.id;

    let agreement = 0;
    const sameCondition = body.condition === spot.condition;
    if (!sameCondition) {
      const cutoff = new Date(now.getTime() - CONSENSUS_WINDOW_MS).toISOString();
      const votes: StatusVote[] = [];
      // Read all recent opinions, not only opinions matching this request.
      // Otherwise an old vote still counts after its rider changes their mind.
      for (let from = 0; ; from += 200) {
        const { data: page, error } = await supabase.from('spot_status_updates')
          .select('id, user_id, condition, created_at').eq('spot_id', body.spot_id)
          .not('user_id', 'is', null).gte('created_at', cutoff)
          .order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, from + 199);
        if (error || !page) { await rollback(); return failure(); }
        votes.push(...page as StatusVote[]);
        if (page.length < 200) break;
      }
      agreement = countStatusAgreement(votes, body.condition, new Date());
    }
    const changesState = sameCondition || agreement >= 2;
    if (changesState) {
      const { data: updated, error } = await supabase.from('spots')
        .update({ condition: body.condition, condition_updated_at: new Date().toISOString() })
        .eq('id', body.spot_id).eq('status', 'approved').eq('condition', spot.condition).select('id').maybeSingle();
      if (error) { await rollback(); return failure(); }
      if (!updated) {
        await rollback();
        return NextResponse.json({ ok: false, error: text('Lo stato dello spot è cambiato. Ricarica la scheda e riprova.', 'The spot status has changed. Reload the page and try again.') }, { status: 409 });
      }
    }

    // The observation is saved. Refresh the public page before optional XP work.
    try {
      revalidatePath(`/map/spot/${spot.slug}`);
      revalidatePath('/'); revalidatePath('/map');
    } catch { console.error('[status-confirm] page refresh failed'); }
    const condition = conditionText(body.condition, language);
    const message = sameCondition
      ? text('Stato confermato. Grazie per l’aggiornamento.', 'Status confirmed. Thanks for the update.')
      : changesState
        ? text(`Stato aggiornato: ${condition}. Confermato da ${agreement} rider diversi.`, `Status updated: ${condition}. Reported by ${agreement} different riders.`)
        : text(`Segnalazione registrata: ${condition}. Per cambiare lo stato serve un altro rider.`, `Report saved: ${condition}. Another rider needs to confirm before the status changes.`);
    let xp;
    try {
      const before = await getXPSummary(user.id);
      await onStatusConfirmed(user.id, body.spot_id, contribution.id);
      const after = await getXPSummary(user.id);
      const awarded = Math.min(5, Math.max(0, after.lifetime_xp - before.lifetime_xp));
      if (awarded > 0) xp = { awarded, total: after.lifetime_xp, level: after.current_level, leveledUp: after.current_level !== before.current_level };
    } catch { console.error('[status-confirm] XP update unavailable'); }
    return NextResponse.json({ ok: true, message, ...(xp ? { xp } : {}) });
  } catch {
    await rollback().catch(() => console.error('[status-confirm] rollback unavailable'));
    return failure();
  }
}
