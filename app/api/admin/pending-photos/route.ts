import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminAuthenticated } from '@/lib/auth';
import { onPhotoApproved, onContentRejected } from '@/lib/xp';
import { UUID_RE } from '@/lib/validation';

/**
 * GET /api/admin/pending-photos
 * Returns all pending user-submitted photos with spot + user info.
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('spot_photos')
    .select(`
      id, spot_id, url, position, uploaded_by, moderation_status, created_at,
      spots!inner(name, slug, city)
    `)
    .eq('moderation_status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: 'Errore query' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: data ?? [] });
}

/**
 * POST /api/admin/pending-photos
 * Approve or reject a pending photo.
 * Body: { photo_id, action: 'approve' | 'reject' }
 */
export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  let body: { photo_id?: string; action?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Body non valido' }, { status: 400 }); }

  const { photo_id, action } = body;
  if (!photo_id || !UUID_RE.test(photo_id)) {
    return NextResponse.json({ ok: false, error: 'photo_id non valido' }, { status: 400 });
  }
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ ok: false, error: 'action deve essere approve o reject' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  if (action === 'approve') {
    /* Solo cio' che e' ancora in attesa, e si controlla che una riga sia
       davvero cambiata. Prima l'update non era vincolata: approvare due volte
       assegnava gli XP due volte, e approvare una foto gia' rifiutata la
       riportava online. Postgrest non segnala errore quando non tocca righe. */
    const { data: aggiornate, error } = await supabase
      .from('spot_photos')
      .update({ moderation_status: 'approved' })
      .eq('id', photo_id)
      .eq('moderation_status', 'pending')
      .select('id');

    if (error) return NextResponse.json({ ok: false, error: 'Errore aggiornamento' }, { status: 500 });

    if (!aggiornate || aggiornate.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Questa foto è già stata decisa. Ricarica la pagina.',
      }, { status: 409 });
    }

    // Update linked contribution + award XP
    const { data: photo } = await supabase
      .from('spot_photos')
      .select('contribution_id, uploaded_by, spot_id')
      .eq('id', photo_id)
      .single();

    if (photo?.contribution_id) {
      await supabase
        .from('spot_contributions')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', photo.contribution_id);
    }

    // Award XP (fire-and-forget)
    if (photo?.uploaded_by && photo?.spot_id) {
      onPhotoApproved(photo.uploaded_by, photo.spot_id, photo.contribution_id).catch(console.error);
    }

    return NextResponse.json({ ok: true, message: 'Foto approvata' });
  }

  if (action === 'reject') {
    // Delete photo from storage + DB
    const { data: photo } = await supabase
      .from('spot_photos')
      .select('url, contribution_id, uploaded_by')
      .eq('id', photo_id)
      .single();

    if (!photo) {
      /* Prima si rispondeva ok anche qui: una foto inesistente risultava
         «rifiutata e rimossa» senza che fosse successo niente. */
      return NextResponse.json({
        ok: false,
        error: 'Foto non trovata. Forse è già stata rimossa.',
      }, { status: 404 });
    }

    {
      /* PRIMA la riga, POI il file — e l'ordine non e' un dettaglio.
         Cancellando lo storage per primo, se nel frattempo la foto fosse stata
         approvata la DELETE non toccherebbe righe: resterebbe una riga viva che
         punta a un file inesistente, cioe' una foto rotta sul sito. Cosi'
         invece, se la riga non si puo' togliere, il file resta al suo posto e
         non si e' rotto niente.
         Vincolata a `pending` anche per non penalizzare due volte la fiducia
         del rider su un doppio rifiuto. */
      const { data: cancellate, error: errDelete } = await supabase
        .from('spot_photos').delete()
        .eq('id', photo_id)
        .eq('moderation_status', 'pending')
        .select('id');

      if (errDelete) {
        console.error('[pending-photos] delete:', errDelete.message);
        return NextResponse.json({ ok: false, error: 'Errore eliminazione' }, { status: 500 });
      }

      if (!cancellate || cancellate.length === 0) {
        return NextResponse.json({
          ok: false,
          error: 'Questa foto è già stata decisa. Ricarica la pagina.',
        }, { status: 409 });
      }

      /* Solo ora il file: la riga non c'e' piu', quindi nessuno lo cerca. */
      const urlParts = photo.url.split('/spot-photos/');
      if (urlParts[1]) {
        await supabase.storage.from('spot-photos').remove([urlParts[1]]);
      }

      // Update contribution
      if (photo.contribution_id) {
        await supabase
          .from('spot_contributions')
          .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
          .eq('id', photo.contribution_id);
      }
    }

    // Trust penalty for rejected photo
    if (photo?.uploaded_by) {
      onContentRejected(photo.uploaded_by, 'photo').catch(console.error);
    }

    return NextResponse.json({ ok: true, message: 'Foto rifiutata e rimossa' });
  }
}
