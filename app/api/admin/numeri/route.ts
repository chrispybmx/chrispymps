import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminAuthenticated } from '@/lib/auth';
import { getFreshness } from '@/lib/freshness';

/**
 * GET /api/admin/numeri — i numeri che servono a decidere.
 *
 * Costruita sui dati che il progetto già possiede, non su un servizio esterno:
 * gli swipe, i preferiti, gli spot, la freschezza. L'unica parte nuova è
 * l'imbuto di registrazione, che è a volume bassissimo.
 *
 * Non risponde a "quante visite ho": per quello serve un'analitica esterna,
 * perché chi non ha un account qui non lascia traccia — di proposito.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const daGiorni = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

  const [spots, swipes, funnel, riders] = await Promise.all([
    sb.from('spots').select('id, name, slug, condition, condition_updated_at').eq('status', 'approved'),
    sb.from('spot_swipes').select('spot_id, direction, created_at'),
    sb.from('funnel_events').select('attempt_id, step, field, ms_from_start, detail, created_at')
      .gte('created_at', daGiorni(30)),
    sb.from('rider_details').select('region, disciplines, birth_date'),
  ]);

  /* ── Freschezza: il debito che cresce da solo ── */
  const perTono: Record<string, number> = {};
  const piuVecchi: { name: string; slug: string; giorni: number }[] = [];
  for (const s of (spots.data ?? []) as { id: string; name: string; slug: string; condition: string; condition_updated_at: string }[]) {
    const f = getFreshness(s.condition as never, s.condition_updated_at);
    perTono[f.tone] = (perTono[f.tone] ?? 0) + 1;
    if (f.days !== null) piuVecchi.push({ name: s.name, slug: s.slug, giorni: f.days });
  }
  piuVecchi.sort((a, b) => b.giorni - a.giorni);

  /* ── Swipe: cosa piace e cosa viene scartato ── */
  const perSpot = new Map<string, { like: number; pass: number }>();
  let like = 0, pass = 0, ultimaSettimana = 0;
  const settimanaFa = daGiorni(7);
  for (const s of (swipes.data ?? []) as { spot_id: string; direction: string; created_at: string }[]) {
    const v = perSpot.get(s.spot_id) ?? { like: 0, pass: 0 };
    if (s.direction === 'like') { v.like++; like++; } else { v.pass++; pass++; }
    perSpot.set(s.spot_id, v);
    if (s.created_at >= settimanaFa) ultimaSettimana++;
  }

  const nomePerId = new Map((spots.data ?? []).map(s => [s.id as string, { name: s.name as string, slug: s.slug as string }]));
  /* Gli spot più scartati: è la lista delle foto che non funzionano. */
  const piuScartati = [...perSpot.entries()]
    .filter(([, v]) => v.pass + v.like >= 2)
    .map(([id, v]) => ({
      ...(nomePerId.get(id) ?? { name: '?', slug: '' }),
      pass: v.pass, like: v.like,
      percentualeScarto: Math.round((v.pass / (v.pass + v.like)) * 100),
    }))
    .sort((a, b) => b.percentualeScarto - a.percentualeScarto)
    .slice(0, 8);

  /* ── Imbuto registrazione ── */
  const tentativi = new Map<string, { passi: Set<string>; ultimoCampo: string | null; ms: number | null; motivo: string | null }>();
  for (const e of (funnel.data ?? []) as { attempt_id: string; step: string; field: string | null; ms_from_start: number | null; detail: string | null }[]) {
    const t = tentativi.get(e.attempt_id) ?? { passi: new Set<string>(), ultimoCampo: null, ms: null, motivo: null };
    t.passi.add(e.step);
    if (e.field) t.ultimoCampo = e.field;
    if (e.step === 'riuscito' && e.ms_from_start !== null) t.ms = e.ms_from_start;
    if (e.step === 'errore' && e.detail) t.motivo = e.detail;
    tentativi.set(e.attempt_id, t);
  }
  const tutti     = [...tentativi.values()];
  const riusciti  = tutti.filter(t => t.passi.has('riuscito'));
  const tempi     = riusciti.map(t => t.ms).filter((n): n is number => n !== null).sort((a, b) => a - b);
  const abbandoni = new Map<string, number>();
  for (const t of tutti) {
    if (t.passi.has('riuscito')) continue;
    const dove = t.ultimoCampo ?? 'prima di toccare qualcosa';
    abbandoni.set(dove, (abbandoni.get(dove) ?? 0) + 1);
  }
  const motivi = new Map<string, number>();
  for (const t of tutti) if (t.motivo) motivi.set(t.motivo, (motivi.get(t.motivo) ?? 0) + 1);

  return NextResponse.json({
    ok: true,
    data: {
      spot: {
        totale: (spots.data ?? []).length,
        freschezza: perTono,
        piuVecchi: piuVecchi.slice(0, 5),
      },
      swipe: { like, pass, ultimaSettimana, piuScartati },
      registrazione: {
        tentativi:  tutti.length,
        riusciti:   riusciti.length,
        tempoMedianoSecondi: tempi.length ? Math.round(tempi[Math.floor(tempi.length / 2)] / 1000) : null,
        abbandoniPerCampo: [...abbandoni.entries()].sort((a, b) => b[1] - a[1]),
        erroriPiuFrequenti: [...motivi.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      },
      rider: {
        conDettagli: (riders.data ?? []).length,
        perRegione: Object.entries(
          (riders.data ?? []).reduce<Record<string, number>>((acc, r) => {
            const k = (r.region as string) ?? 'non dichiarata';
            acc[k] = (acc[k] ?? 0) + 1;
            return acc;
          }, {}),
        ).sort((a, b) => b[1] - a[1]),
      },
    },
  });
}
