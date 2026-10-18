import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const databaseError = () => NextResponse.json({ ok: false, error: 'Errore database' }, { status: 500 });

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

  // Leggi il commento (per sapere chi è l'autore e il testo)
  const { data: comment, error: commentError } = await admin
    .from('comments')
    .select('id, user_id, username, text, likes_count')
    .eq('id', comment_id)
    .maybeSingle();

  if (commentError) return databaseError();
  if (!comment) return NextResponse.json({ ok: false, error: 'Commento non trovato' }, { status: 404 });

  // Profilo di chi fa il like
  const { data: likerProfile, error: profileError } = await admin
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) return databaseError();
  const likerUsername = likerProfile?.username
    ?? (user.user_metadata?.username as string)
    ?? user.email?.split('@')[0]
    ?? 'qualcuno';

  // Controlla se il like esiste già
  const { data: existing, error: existingError } = await admin
    .from('comment_likes')
    .select('id')
    .eq('comment_id', comment_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingError) return databaseError();
  if (existing) {
    // Rimuovi like
    const { error } = await admin.from('comment_likes').delete().eq('id', existing.id);
    if (error) return databaseError();
    const { data: c, error: countError } = await admin.from('comments').select('likes_count').eq('id', comment_id).maybeSingle();
    if (countError) return databaseError();
    return NextResponse.json({ ok: true, liked: false, likes_count: c?.likes_count ?? 0 });
  } else {
    // Aggiungi like
    const { error } = await admin.from('comment_likes').insert({ comment_id, user_id: user.id });
    if (error) return databaseError();
    const { data: c, error: countError } = await admin.from('comments').select('likes_count').eq('id', comment_id).maybeSingle();
    if (countError) return databaseError();
    const newCount = c?.likes_count ?? 0;

    // Notifica all'autore del commento (solo se diverso da chi mette like)
    if (comment.user_id && comment.user_id !== user.id) {
      const preview = comment.text.length > 60 ? comment.text.slice(0, 60) + '…' : comment.text;
      void admin.from('notifications').insert({
        user_id: comment.user_id,
        type:    'comment_like',
        title:   `@${likerUsername} ha messo like al tuo commento`,
        body:    `"${preview}"`,
      }).then(({ error }) => { if (error) console.error(error); });
    }

    return NextResponse.json({ ok: true, liked: true, likes_count: newCount });
  }
}
