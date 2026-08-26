import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminAuthenticated } from '@/lib/auth';

/**
 * GET /api/admin/approvati — gli spot approvati, dal più recente.
 *
 * Serve alla sezione «Approvati» della dashboard: vedere cosa è entrato e
 * condividerlo subito. Per un canale che vive di pubblicazione, uno spot
 * appena approvato è materiale da mandare in giro finché è fresco.
 *
 * Ordinati per `approved_at`, non per `created_at`: conta quando è entrato
 * sulla mappa, non quando è stato inviato.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin()
    .from('spots')
    .select('id, name, slug, type, city, approved_at, created_at, submitted_by_username, spot_photos(url, position)')
    .eq('status', 'approved')
    .order('approved_at', { ascending: false, nullsFirst: false })
    .limit(200);

  if (error) {
    console.error('[admin/approvati]', error.message);
    return NextResponse.json({ ok: false, error: 'Errore query' }, { status: 500 });
  }

  const spot = (data ?? []).map((s) => {
    const foto = ((s.spot_photos ?? []) as { url: string; position: number }[])
      .slice()
      .sort((a, b) => a.position - b.position);
    return {
      id:       s.id,
      name:     s.name,
      slug:     s.slug,
      type:     s.type,
      city:     s.city,
      approved_at: s.approved_at,
      created_at:  s.created_at,
      autore:   s.submitted_by_username,
      cover:    foto[0]?.url ?? null,
      nFoto:    foto.length,
    };
  });

  return NextResponse.json({ ok: true, data: spot });
}
