import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('Authorization');
  return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
}

/** GET /api/notifications — ultime 30 notifiche + contatore non lette */
export async function GET(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: { user }, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: 'Token non valido' }, { status: 401 });
  }

  const { data, error } = await admin
    .from('notifications')
    .select('id, type, title, body, spot_slug, read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const unreadCount = (data ?? []).filter(n => !n.read).length;
  return NextResponse.json({ ok: true, data: data ?? [], unreadCount });
}

/** PUT /api/notifications — segna tutte le notifiche dell'utente come lette */
export async function PUT(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: { user }, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: 'Token non valido' }, { status: 401 });
  }

  const { error } = await admin
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
