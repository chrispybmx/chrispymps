import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/* ── POST /api/comment-likes  →  toggle like su un commento ── */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }
  const token = auth.slice(7);
  const admin = supabaseAdmin();

  const { data: { user }, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: 'Token non valido' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const comment_id = typeof body.comment_id === 'string' ? body.comment_id.trim() : '';
  if (!comment_id) {
    return NextResponse.json({ ok: false, error: 'comment_id mancante' }, { status: 400 });
  }

  // Controlla se il like esiste già
  const { data: existing } = await admin
    .from('comment_likes')
    .select('id')
    .eq('comment_id', comment_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    // Rimuovi like
    await admin.from('comment_likes').delete().eq('id', existing.id);
    // Leggi nuovo conteggio
    const { data: c } = await admin.from('comments').select('likes_count').eq('id', comment_id).maybeSingle();
    return NextResponse.json({ ok: true, liked: false, likes_count: c?.likes_count ?? 0 });
  } else {
    // Aggiungi like
    await admin.from('comment_likes').insert({ comment_id, user_id: user.id });
    const { data: c } = await admin.from('comments').select('likes_count').eq('id', comment_id).maybeSingle();
    return NextResponse.json({ ok: true, liked: true, likes_count: c?.likes_count ?? 0 });
  }
}
