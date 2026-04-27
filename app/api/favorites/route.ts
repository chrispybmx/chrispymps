import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function supabaseUser(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

/* GET /api/favorites
   - with Authorization header → returns user's favorites from Supabase
   - with ?ids=... → returns spot info for those IDs (legacy anonymous use) */
export async function GET(req: NextRequest) {
  const auth  = req.headers.get('Authorization');
  const token = auth?.replace('Bearer ', '').trim() ?? '';

  /* ── Authenticated: leggi da Supabase ── */
  if (token) {
    const sb = supabaseUser(token);
    const { data: favRows, error } = await sb
      .from('spot_favorites')
      .select('spot_id')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ ok: false, error: 'Errore interno' }, { status: 500 });
    if (!favRows || favRows.length === 0) return NextResponse.json({ ok: true, data: [], ids: [] });

    const ids = favRows.map((r: { spot_id: string }) => r.spot_id);
    const sbAdmin = supabaseAdmin();
    const { data: spots } = await sbAdmin
      .from('spots')
      .select('id, slug, name, type, city, condition, spot_photos(url, position)')
      .in('id', ids)
      .eq('status', 'approved');

    return NextResponse.json({ ok: true, data: spots ?? [], ids });
  }

  /* ── Anonymous fallback: ritorna spot info per IDs dati ── */
  const raw = req.nextUrl.searchParams.get('ids') ?? '';
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

/* POST /api/favorites  { spot_id }
   Toggle: add if missing, remove if present. Returns { ok, isFaved } */
export async function POST(req: NextRequest) {
  const auth  = req.headers.get('Authorization');
  const token = auth?.replace('Bearer ', '').trim() ?? '';
  if (!token) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 });

  let body: { spot_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Body non valido' }, { status: 400 }); }
  const { spot_id } = body;
  if (!spot_id || !UUID_RE.test(spot_id)) return NextResponse.json({ ok: false, error: 'spot_id non valido' }, { status: 400 });

  const sb = supabaseUser(token);

  /* Controlla se già presente */
  const { data: existing } = await sb
    .from('spot_favorites')
    .select('id')
    .eq('spot_id', spot_id)
    .maybeSingle();

  if (existing) {
    /* Rimuovi */
    await sb.from('spot_favorites').delete().eq('spot_id', spot_id);
    return NextResponse.json({ ok: true, isFaved: false });
  } else {
    /* Aggiungi */
    const { error } = await sb.from('spot_favorites').insert({ spot_id });
    if (error) return NextResponse.json({ ok: false, error: 'Errore inserimento' }, { status: 500 });
    return NextResponse.json({ ok: true, isFaved: true });
  }
}
