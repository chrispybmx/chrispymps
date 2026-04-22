import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    .select('*, spot_photos(id, url, position, credit_name)')
    .in('id', validIds)
    .eq('status', 'approved');

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Sort foto per position
  const spots = (data ?? []).map(s => ({
    ...s,
    spot_photos: (s.spot_photos ?? []).sort((a: { position: number }, b: { position: number }) => a.position - b.position),
  }));

  return NextResponse.json({ ok: true, data: spots });
}
