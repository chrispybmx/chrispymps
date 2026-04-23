import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/* GET /api/favorites?ids=id1,id2,...
   Returns basic spot info for the given IDs (used by favorites section on profile) */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('ids') ?? '';
  const ids = raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 50);
  if (ids.length === 0) return NextResponse.json({ ok: true, data: [] });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('spots')
    .select('id, slug, name, type, city, condition, spot_photos(url, position)')
    .in('id', ids)
    .eq('status', 'approved');

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data: data ?? [] });
}
