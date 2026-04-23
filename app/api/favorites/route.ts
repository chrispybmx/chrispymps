import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* GET /api/favorites?ids=id1,id2,...
   Returns basic spot info for the given IDs (used by favorites section on profile) */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('ids') ?? '';
  // Validate each ID as UUID before passing to DB — prevents 500 leaking DB errors
  const ids = raw.split(',')
    .map(s => s.trim())
    .filter(s => UUID_RE.test(s))
    .slice(0, 50);
  if (ids.length === 0) return NextResponse.json({ ok: true, data: [] });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('spots')
    .select('id, slug, name, type, city, condition, spot_photos(url, position)')
    .in('id', ids)
    .eq('status', 'approved');

  if (error) return NextResponse.json({ ok: false, error: 'Errore interno' }, { status: 500 });
  return NextResponse.json({ ok: true, data: data ?? [] });
}
