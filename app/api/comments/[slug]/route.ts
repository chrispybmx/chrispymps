import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface Props { params: { slug: string } }

/* ── GET: leggi commenti per uno spot ── */
export async function GET(req: NextRequest, { params }: Props) {
  const admin = supabaseAdmin();

  const { data: spot } = await admin
    .from('spots')
    .select('id')
    .eq('slug', params.slug)
    .eq('status', 'approved')
    .maybeSingle();

  if (!spot) return NextResponse.json({ ok: false, error: 'Spot non trovato' }, { status: 404 });

  const { data: comments, error } = await admin
    .from('comments')
    .select('id, username, text, created_at, parent_id, likes_count')
    .eq('spot_id', spot.id)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Se loggato, restituiamo anche i like dell'utente corrente
  let myLikes: string[] = [];
  const auth = req.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7);
    const { data: { user } } = await admin.auth.getUser(token);
    if (user) {
      const ids = (comments ?? []).map(c => c.id);
      if (ids.length > 0) {
        const { data: likes } = await admin
          .from('comment_likes')
          .select('comment_id')
          .eq('user_id', user.id)
          .in('comment_id', ids);
        myLikes = (likes ?? []).map((l: { comment_id: string }) => l.comment_id);
      }
    }
  }

  return NextResponse.json({ ok: true, data: comments ?? [], myLikes });
}

/* ── POST: aggiungi commento / risposta (richiede auth) ── */
export async function POST(req: NextRequest, { params }: Props) {
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
  const text      = typeof body.text      === 'string' ? body.text.trim()      : '';
  const parent_id = typeof body.parent_id === 'string' ? body.parent_id.trim() : null;

  if (text.length < 2 || text.length > 500) {
    return NextResponse.json({ ok: false, error: 'Commento tra 2 e 500 caratteri.' }, { status: 400 });
  }

  const { data: spot } = await admin
    .from('spots')
    .select('id, name, slug, submitted_by_user_id')
    .eq('slug', params.slug)
    .eq('status', 'approved')
    .maybeSingle();

  if (!spot) return NextResponse.json({ ok: false, error: 'Spot non trovato' }, { status: 404 });

  // Username di chi commenta
  const { data: profile } = await admin
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  let username = profile?.username ?? (user.user_metadata?.username as string) ?? user.email?.split('@')[0] ?? 'anonimo';
  if (typeof username !== 'string' || username.length === 0) username = 'anonimo';
  username = username.slice(0, 50);

  // Verifica che il parent esista e appartenga allo stesso spot
  let parentComment: { id: string; user_id: string; username: string } | null = null;
  if (parent_id) {
    const { data: parent } = await admin
      .from('comments')
      .select('id, spot_id, user_id, username')
      .eq('id', parent_id)
      .maybeSingle();
    if (!parent || parent.spot_id !== spot.id) {
      return NextResponse.json({ ok: false, error: 'Commento padre non trovato.' }, { status: 400 });
    }
    parentComment = parent;
  }

  // Inserisci commento / risposta
  const { data: comment, error: insertErr } = await admin
    .from('comments')
    .insert({ spot_id: spot.id, user_id: user.id, username, text, parent_id: parent_id || null })
    .select('id, username, text, created_at, parent_id, likes_count')
    .single();

  if (insertErr) return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });

  const preview = text.length > 80 ? text.slice(0, 80) + '…' : text;

  if (parent_id && parentComment) {
    // Notifica all'autore del commento padre (risposta)
    if (parentComment.user_id && parentComment.user_id !== user.id) {
      admin.from('notifications').insert({
        user_id: parentComment.user_id,
        type:    'comment_reply',
        title:   `@${username} ha risposto al tuo commento`,
        body:    `"${preview}"`,
        spot_slug: spot.slug,
      }).then().catch(console.error);
    }
  } else {
    // Notifica al proprietario dello spot (commento principale)
    if (spot.submitted_by_user_id && spot.submitted_by_user_id !== user.id) {
      admin.from('notifications').insert({
        user_id:   spot.submitted_by_user_id,
        type:      'comment_on_spot',
        title:     `Nuovo commento su "${spot.name}"`,
        body:      `@${username}: ${preview}`,
        spot_slug: spot.slug,
      }).then().catch(console.error);
    }
  }

  return NextResponse.json({ ok: true, data: comment }, { status: 201 });
}
