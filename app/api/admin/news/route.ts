import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

function slugify(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 80);
}

export async function GET() {
  if (!isAdminAuthenticated()) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  try {
    const { data } = await supabaseAdmin().from('news').select('*').order('created_at', { ascending: false });
    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch { return NextResponse.json({ ok: true, data: [] }); }
}

export async function POST(req: Request) {
  if (!isAdminAuthenticated()) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  const body = await req.json();
  const supabase = supabaseAdmin();

  if (body.id) {
    // UPDATE
    const { error } = await supabase.from('news').update({
      title: body.title, excerpt: body.excerpt, body: body.body,
      cover_url: body.cover_url || null, tags: body.tags || null,
      status: body.status,
      published_at: body.status === 'published' ? (body.published_at || new Date().toISOString()) : null,
    }).eq('id', body.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else {
    // CREATE
    let slug = slugify(body.title);
    const { data: ex } = await supabase.from('news').select('id').eq('slug', slug).maybeSingle();
    if (ex) slug = `${slug}-${Date.now()}`;
    const { error } = await supabase.from('news').insert({
      slug, title: body.title, excerpt: body.excerpt, body: body.body,
      cover_url: body.cover_url || null, tags: body.tags || null,
      status: body.status ?? 'draft',
      published_at: body.status === 'published' ? new Date().toISOString() : null,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!isAdminAuthenticated()) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  const { id } = await req.json();
  const { error } = await supabaseAdmin().from('news').delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
