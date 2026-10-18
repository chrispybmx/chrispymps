import { NextRequest, NextResponse } from 'next/server';
import { publicSpotPhotos } from '@/lib/public-spot-photos';
import { supabaseAdmin } from '@/lib/supabase';
import { UUID_RE } from '@/lib/validation';
import { toPublicSpot } from '@/lib/public-spot';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ids: unknown = body.ids;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ ok: true, data: [] });
  }

  // Valida e filtra solo UUID validi (max 100)
  const validIds = (ids as unknown[])
    .filter((id): id is string => typeof id === 'string' && UUID_RE.test(id))
    .slice(0, 100);

  if (validIds.length === 0) {
    return NextResponse.json({ ok: true, data: [] });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('spots')
    .select('*, spot_photos(id, url, position, credit_name, moderation_status)')
    .in('id', validIds)
    .eq('status', 'approved')
    // Solo foto moderate: questa route usa la service key e bypassa le policy.
    .or('moderation_status.eq.approved,moderation_status.is.null', { referencedTable: 'spot_photos' });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Sort foto per position
  const spots = (data ?? []).map(s => ({
    ...toPublicSpot(s),
    // Doppio filtro: la query sopra e il codice qui, se il filtro del DB cambiasse.
    spot_photos: publicSpotPhotos(s.spot_photos),
  }));

  return NextResponse.json({ ok: true, data: spots });
}
