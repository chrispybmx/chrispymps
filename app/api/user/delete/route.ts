import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase';

/**
 * DELETE /api/user/delete
 *
 * Cancella l'account utente mantenendo gli spot approvati come contributi anonimi.
 *
 * Strategia:
 * 1. Anonimizza spot approvati (restano sulla mappa come "Chrispy Maps")
 * 2. Cancella spot pending/rejected
 * 3. Anonimizza/elimina tutti i dati personali
 * 4. Rimuovi da MailerLite (best-effort)
 * 5. Solo se tutti gli step precedenti OK → elimina Auth user
 *
 * Ogni step critico controlla { error }. Se uno fallisce, l'utente Auth
 * NON viene eliminato per evitare cancellazioni parziali pericolose.
 */
export async function DELETE(req: NextRequest) {
  try {
    /* ── Auth ─────────────────────────────────────────────── */
    const authHeader = req.headers.get('authorization');
    if (!authHeader)
      return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseServer().auth.getUser(token);
    if (!user)
      return NextResponse.json({ ok: false, error: 'Sessione scaduta' }, { status: 401 });

    const sb = supabaseAdmin();
    const uid = user.id;
    const email = user.email;

    /**
     * Helper: esegue una query Supabase e lancia se errore.
     * Il label e solo per log server — la risposta al client resta generica.
     */
    async function step<T>(
      label: string,
      query: PromiseLike<{ error: { message: string } | null; data: T }>,
    ): Promise<T> {
      const { data, error } = await query;
      if (error) {
        console.error(`[user/delete] step "${label}" failed:`, error.message);
        throw new StepError(label, error.message);
      }
      return data;
    }

    /* ═══════════════════════════════════════════════════════
       FASE 1 — Anonimizza contenuti pubblici
       (spot approvati, foto, commenti, status, events, news)
       ═══════════════════════════════════════════════════════ */

    // Spot approvati: restano sulla mappa come "Chrispy Maps"
    await step('anonymize-approved-spots',
      sb.from('spots')
        .update({ submitted_by_user_id: null, submitted_by_username: 'Chrispy Maps' })
        .eq('submitted_by_user_id', uid)
        .eq('status', 'approved')
    );

    // Spot pending/rejected: cancella (non ancora pubblici)
    await step('delete-pending-spots',
      sb.from('spots')
        .delete()
        .eq('submitted_by_user_id', uid)
        .neq('status', 'approved')
    );

    // Foto: anonimizza credit (le foto restano sugli spot)
    await step('anonymize-photos',
      sb.from('spot_photos')
        .update({ uploaded_by: null, credit_name: 'Chrispy Maps' })
        .eq('uploaded_by', uid)
    );

    // Status updates: scollega utente
    await step('anonymize-status-updates',
      sb.from('spot_status_updates')
        .update({ user_id: null })
        .eq('user_id', uid)
    );

    // Commenti: anonimizza (non cancellare — romperebbe thread)
    await step('anonymize-comments',
      sb.from('comments')
        .update({ user_id: null, username: '[eliminato]' })
        .eq('user_id', uid)
    );

    // Events: anonimizza
    await step('anonymize-events',
      sb.from('events')
        .update({ submitted_by_user_id: null, submitted_by_username: 'Chrispy Maps' })
        .eq('submitted_by_user_id', uid)
    );

    // News: anonimizza
    await step('anonymize-news',
      sb.from('news')
        .update({ submitted_by_user_id: null, submitted_by_username: 'Chrispy Maps' })
        .eq('submitted_by_user_id', uid)
    );

    /* ═══════════════════════════════════════════════════════
       FASE 2 — Elimina dati personali
       (like, rating, preferiti, contributi, XP, profilo)
       ═══════════════════════════════════════════════════════ */

    await step('delete-comment-likes',
      sb.from('comment_likes').delete().eq('user_id', uid)
    );

    await step('delete-spot-likes',
      sb.from('spot_likes').delete().eq('user_id', uid)
    );

    await step('delete-spot-ratings',
      sb.from('spot_ratings').delete().eq('user_id', uid)
    );

    await step('delete-favorites',
      sb.from('spot_favorites').delete().eq('user_id', uid)
    );

    await step('delete-point-events',
      sb.from('point_events').delete().eq('user_id', uid)
    );

    await step('delete-user-stats',
      sb.from('user_stats').delete().eq('user_id', uid)
    );

    await step('delete-contributions',
      sb.from('spot_contributions').delete().eq('user_id', uid)
    );

    await step('delete-notifications',
      sb.from('notifications').delete().eq('user_id', uid)
    );

    await step('delete-user-badges',
      sb.from('user_badges').delete().eq('user_id', uid)
    );

    await step('delete-profile',
      sb.from('profiles').delete().eq('id', uid)
    );

    /* ═══════════════════════════════════════════════════════
       FASE 3 — MailerLite (best-effort, non blocca)
       ═══════════════════════════════════════════════════════ */

    if (email) {
      try {
        const mlKey = process.env.MAILERLITE_API_KEY;
        if (mlKey) {
          await fetch(
            `https://connect.mailerlite.com/api/subscribers/${encodeURIComponent(email)}`,
            {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${mlKey}`,
              },
            },
          );
        }
      } catch (mlErr) {
        console.warn('[user/delete] MailerLite removal failed (non-blocking):', mlErr);
      }
    }

    /* ═══════════════════════════════════════════════════════
       FASE 4 — Elimina Auth user (solo se tutto OK sopra)
       ═══════════════════════════════════════════════════════ */

    const { error: authError } = await sb.auth.admin.deleteUser(uid);
    if (authError) {
      console.error('[user/delete] deleteUser failed:', authError.message);
      return NextResponse.json(
        { ok: false, error: 'Errore durante l\'eliminazione. Riprova o contattaci.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof StepError) {
      // Step critico fallito → Auth user NON eliminato → dati integri
      return NextResponse.json(
        { ok: false, error: 'Errore durante l\'eliminazione. Riprova o contattaci.' },
        { status: 500 },
      );
    }
    const message = err instanceof Error ? err.message : 'Errore interno';
    console.error('[user/delete] unexpected error:', message);
    return NextResponse.json(
      { ok: false, error: 'Errore durante l\'eliminazione. Riprova o contattaci.' },
      { status: 500 },
    );
  }
}

/** Errore interno per step falliti — contiene label per log server */
class StepError extends Error {
  constructor(public readonly label: string, dbMessage: string) {
    super(`Step "${label}" failed: ${dbMessage}`);
    this.name = 'StepError';
  }
}
