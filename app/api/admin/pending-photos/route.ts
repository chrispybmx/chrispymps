import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { spotPhotoStoragePath } from '@/lib/storage-path';
import { isAdminAuthenticated } from '@/lib/auth';
import { onPhotoApproved, onContentRejected } from '@/lib/xp';
import { UUID_RE } from '@/lib/validation';

/**
 * GET /api/admin/pending-photos
 * Returns all pending user-submitted photos with spot + user info.
 */
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
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
  if (!(await isAdminAuthenticated())) {
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

    /* La foto e' gia' approvata. Contributo e XP vanno attesi: su serverless
       una promessa non attesa viene troncata quando parte la risposta.
       Se falliscono la foto resta approvata, ma l'admin lo deve sapere. */
    const avvisi: string[] = [];
    const { data: photo, error: photoErr } = await supabase
      .from('spot_photos')
      .select('contribution_id, uploaded_by, spot_id')
      .eq('id', photo_id)
      .single();
    if (photoErr) avvisi.push('dati foto non letti: contributo e XP non aggiornati');

    if (photo?.contribution_id) {
      const { error: contribErr } = await supabase
        .from('spot_contributions')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', photo.contribution_id);
      if (contribErr) avvisi.push('contributo non aggiornato');
    }

    if (photo?.uploaded_by && photo?.spot_id) {
      try { await onPhotoApproved(photo.uploaded_by, photo.spot_id, photo.contribution_id); }
      catch (err) { console.error('[pending-photos] xp:', err); avvisi.push('XP non assegnati'); }
    }

    return NextResponse.json({
      ok: true,
      message: avvisi.length ? `Foto approvata, ma: ${avvisi.join(', ')}.` : 'Foto approvata',
      ...(avvisi.length ? { warnings: avvisi } : {}),
    });
  }

  if (action === 'reject') {
    const avvisiRifiuto: string[] = [];
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
      const storagePath = spotPhotoStoragePath(photo.url);
      if (storagePath) {
        const { error: storageErr } = await supabase.storage.from('spot-photos').remove([storagePath]);
        if (storageErr) { console.error('[pending-photos] storage:', storageErr.message); avvisiRifiuto.push('file non eliminato dallo storage'); }
      }

      // Update contribution
      if (photo.contribution_id) {
        const { error: contribErr } = await supabase
          .from('spot_contributions')
          .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
          .eq('id', photo.contribution_id);
        if (contribErr) avvisiRifiuto.push('contributo non aggiornato');
      }
    }

    // Trust penalty for rejected photo (attesa: su serverless non si perde)
    if (photo?.uploaded_by) {
      try { await onContentRejected(photo.uploaded_by, 'photo'); }
      catch (err) { console.error('[pending-photos] trust:', err); avvisiRifiuto.push('fiducia non aggiornata'); }
    }

    return NextResponse.json({
      ok: true,
      message: avvisiRifiuto.length ? `Foto rifiutata, ma: ${avvisiRifiuto.join(', ')}.` : 'Foto rifiutata e rimossa',
      ...(avvisiRifiuto.length ? { warnings: avvisiRifiuto } : {}),
    });
  }
}
