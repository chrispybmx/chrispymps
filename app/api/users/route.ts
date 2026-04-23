import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/* GET /api/users?q=samyo
   Cerca profili per username (case-insensitive, partial match).
   Restituisce max 6 risultati con conteggio spot approvati. */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().replace(/^@/, '');
  if (q.length < 2) return NextResponse.json({ ok: true, data: [] });

  const sb = supabaseAdmin();

  /* Cerca profili il cui username contiene la query */
  const { data: profiles, error } = await sb
    .from('profiles')
    .select('id, username, bio, instagram_handle')
    .ilike('username', `%${q}%`)
    .limit(6);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!profiles || profiles.length === 0) return NextResponse.json({ ok: true, data: [] });

  /* Per ogni profilo recupera il conteggio degli spot approvati */
  const withCounts = await Promise.all(
    profiles.map(async (p) => {
      const { count } = await sb
        .from('spots')
        .select('*', { count: 'exact', head: true })
        .eq('submitted_by_username', p.username)
        .eq('status', 'approved');
      // Non esponiamo l'id (UUID) in risposta pubblica — solo username e dati pubblici
      return {
        username:          p.username,
        bio:               p.bio,
        instagram_handle:  p.instagram_handle,
        spotCount:         count ?? 0,
      };
    })
  );

  return NextResponse.json({ ok: true, data: withCounts });
}
