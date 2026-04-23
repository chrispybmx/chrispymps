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

  // Validazione formato: 3-30 caratteri, solo lettere/numeri/underscore/trattino
  // Blocca path traversal, HTML injection, spazi e caratteri speciali
  const USERNAME_RE = /^[a-zA-Z0-9_\-]{3,30}$/;
  if (!username || typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return NextResponse.json({
      error: 'Username non valido. Usa 3-30 caratteri: lettere, numeri, _ o -',
    }, { status: 400 });
  }

  // Controlla unicità nella tabella profiles
  const { data: existing } = await adminClient
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .maybeSingle();

  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: 'Username già in uso' }, { status: 409 });
  }

  // Aggiorna user_metadata
  const { error: updateErr } = await adminClient.auth.admin.updateUserById(user.id, {
    user_metadata: { ...(user.user_metadata ?? {}), username },
  });

  if (updateErr) {
    console.error('[set-username] updateUserById error:', updateErr);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
