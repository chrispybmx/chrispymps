import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/auth/set-username
 * Aggiorna user_metadata.username per l'utente autenticato.
 * Richiede Bearer token nell'header Authorization.
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }
  const token = auth.slice(7);

  // Verifica il token e ottieni l'utente
  const adminClient = supabaseAdmin();
  const { data: { user }, error: userErr } = await adminClient.auth.getUser(token);
  if (userErr || !user) {
    return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { username } = body;
  if (!username || typeof username !== 'string' || username.length < 3) {
    return NextResponse.json({ error: 'Username non valido' }, { status: 400 });
  }

  // Aggiorna user_metadata
  const { error: updateErr } = await adminClient.auth.admin.updateUserById(user.id, {
    user_metadata: { ...(user.user_metadata ?? {}), username },
  });

  if (updateErr) {
    console.error('[set-username] updateUserById error:', updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
