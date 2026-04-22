import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminAuthenticated } from '@/lib/auth';

/* ── GET: lista tutti i commenti con info spot ── */
export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '100');
  const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0');

  const { data: comments, error } = await admin
    .from('comments')
    .select('id, username, text, created_at, spot_id, spots(name, slug, city)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, data: comments ?? [] });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ── DELETE: elimina un commento per id ── */
export async function DELETE(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const { comment_id } = await req.json().catch(() => ({}));
  if (!comment_id || !UUID_RE.test(String(comment_id))) {
    return NextResponse.json({ ok: false, error: 'comment_id non valido' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin.from('comments').delete().eq('id', comment_id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
