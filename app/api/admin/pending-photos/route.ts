import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminAuthenticated } from '@/lib/auth';
import { onPhotoApproved, onContentRejected } from '@/lib/xp';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const { error } = await supabase
      .from('spot_photos')
      .update({ moderation_status: 'approved' })
      .eq('id', photo_id);

    if (error) return NextResponse.json({ ok: false, error: 'Errore aggiornamento' }, { status: 500 });

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

    if (photo) {
      // Extract storage path from URL
      const urlParts = photo.url.split('/spot-photos/');
      if (urlParts[1]) {
        await supabase.storage.from('spot-photos').remove([urlParts[1]]);
      }

      // Delete from DB
      await supabase.from('spot_photos').delete().eq('id', photo_id);

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
