import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface Props { params: { slug: string } }

/* ── GET: leggi commenti per uno spot ── */
export async function GET(_req: NextRequest, { params }: Props) {
  const admin = supabaseAdmin();

  // Trova l'id dello spot dal slug
  const { data: spot } = await admin
    .from('spots')
    .select('id')
    .eq('slug', params.slug)
    .eq('status', 'approved')
    .maybeSingle();

  if (!spot) return NextResponse.json({ ok: false, error: 'Spot non trovato' }, { status: 404 });

  const { data: comments, error } = await admin
    .from('comments')
    .select('id, username, text, created_at')
    .eq('spot_id', spot.id)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, data: comments ?? [] });
}

/* ── POST: aggiungi commento (richiede auth) ── */
export async function POST(req: NextRequest, { params }: Props) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }
  const token = auth.slice(7);
  const admin = supabaseAdmin();

  // Verifica token
  const { data: { user }, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: 'Token non valido' }, { status: 401 });
  }

  // Leggi body
  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length < 2 || text.length > 500) {
    return NextResponse.json({ ok: false, error: 'Commento tra 2 e 500 caratteri.' }, { status: 400 });
  }

  // Trova spot — include submitted_by_user_id e name per la notifica
  const { data: spot } = await admin
    .from('spots')
    .select('id, name, slug, submitted_by_user_id')
    .eq('slug', params.slug)
    .eq('status', 'approved')
    .maybeSingle();

  if (!spot) return NextResponse.json({ ok: false, error: 'Spot non trovato' }, { status: 404 });

  // Ottieni username dal profilo
  const { data: profile } = await admin
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  let username = profile?.username ?? (user.user_metadata?.username as string) ?? user.email?.split('@')[0] ?? 'anonimo';
  if (typeof username !== 'string' || username.length === 0) username = 'anonimo';
  username = username.slice(0, 50);

  // Inserisci commento
  const { data: comment, error: insertErr } = await admin
    .from('comments')
    .insert({ spot_id: spot.id, user_id: user.id, username, text })
    .select('id, username, text, created_at')
    .single();

  if (insertErr) return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });

  // Notifica in-app al proprietario dello spot (se diverso dal commentatore) — fire-and-forget
  if (spot.submitted_by_user_id && spot.submitted_by_user_id !== user.id) {
    const preview = text.length > 80 ? text.slice(0, 80) + '…' : text;
    admin.from('notifications').insert({
      user_id:   spot.submitted_by_user_id,
      type:      'comment_on_spot',
      title:     `Nuovo commento su "${spot.name}"`,
      body:      `@${username}: ${preview}`,
      spot_slug: spot.slug,
    }).then().catch(console.error);
  }

  return NextResponse.json({ ok: true, data: comment }, { status: 201 });
}
