import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { JAM_ROMA } from '@/lib/jamroma';

const SLUG = JAM_ROMA.slug;

/** GET — lista partecipanti + conteggio */
export async function GET() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('event_rsvps')
    .select('id, display_name, status, created_at')
    .eq('event_slug', SLUG)
    .eq('status', 'going')
    .order('created_at', { ascending: true });

  // Resiliente a tabella non ancora creata (migration non applicata)
  if (error) return NextResponse.json({ ok: true, count: 0, rsvps: [] });

  return NextResponse.json({
    ok: true,
    count: data?.length ?? 0,
    rsvps: data ?? [],
  });
}

/** POST — "Io vengo" */
export async function POST(req: NextRequest) {
  const sb = supabaseAdmin();

  let userId: string | null = null;
  let displayName = '';

  // Auth opzionale
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const { data: { user } } = await sb.auth.getUser(auth.slice(7));
    if (user) {
      userId = user.id;
      const { data: profile } = await sb
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      displayName = profile?.username ?? user.email?.split('@')[0] ?? 'Rider';
    }
  }

  // Se non loggato, prendi display_name dal body
  if (!userId) {
    try {
      const body = await req.json();
      displayName = String(body.display_name ?? '').replace(/<[^>]*>/g, '').trim().slice(0, 40);
    } catch {
      return NextResponse.json({ ok: false, error: 'Body non valido' }, { status: 400 });
    }
    if (!displayName || displayName.length < 2) {
      return NextResponse.json({ ok: false, error: 'Inserisci il tuo nome (min 2 caratteri)' }, { status: 400 });
    }
  }

  if (userId) {
    // Utente loggato: upsert per deduplicare
    const { error } = await sb
      .from('event_rsvps')
      .upsert(
        { event_slug: SLUG, user_id: userId, display_name: displayName, status: 'going' },
        { onConflict: 'event_slug,user_id' },
      );
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else {
    // Anonimo: dedup per display_name (evita spam)
    const { data: existing } = await sb
      .from('event_rsvps')
      .select('id')
      .eq('event_slug', SLUG)
      .is('user_id', null)
      .eq('display_name', displayName)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ ok: true }); // gia registrato, non duplicare
    }
    const { error } = await sb
      .from('event_rsvps')
      .insert({ event_slug: SLUG, user_id: null, display_name: displayName, status: 'going' });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
