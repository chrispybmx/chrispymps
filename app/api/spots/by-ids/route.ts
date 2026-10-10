import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { UUID_RE } from '@/lib/validation';
import { PUBLIC_SPOT_COLUMNS, publicSpotPayload } from '@/lib/public-spot';

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
    .select(`${PUBLIC_SPOT_COLUMNS},spot_photos(id, url, position, credit_name, moderation_status)`)
    .in('id', validIds)
    .eq('status', 'approved');

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Allowlist pubblica: niente note di moderazione né colonne future; foto ordinate per position
  const spots = (data ?? []).map(s => publicSpotPayload(s));

  return NextResponse.json({ ok: true, data: spots });
}
