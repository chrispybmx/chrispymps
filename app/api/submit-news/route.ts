import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';

const Schema = z.object({
  title:        z.string().min(3).max(200),
  body:         z.string().min(10).max(50000), // long text supported
  excerpt:      z.string().max(500).optional(),
  cover_url:    z.string().url().max(500).optional(),
  tags:         z.string().max(200).optional(),
  link_url:     z.string().url().max(500).optional(), // external link (video, etc)
  post_type:    z.enum(['post', 'request']).optional(),
  request_city: z.string().max(100).optional(),
  access_token: z.string().min(1),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u').replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export async function POST(req: NextRequest) {
  let body: z.infer<typeof Schema>;
  try { body = Schema.parse(await req.json()); }
  catch { return NextResponse.json({ ok: false, error: 'Dati non validi. Titolo (min 3 car.) e testo (min 10 car.) richiesti.' }, { status: 400 }); }

  const sb = supabaseAdmin();

  const { data: { user }, error: authErr } = await sb.auth.getUser(body.access_token);
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: 'Non autenticato.' }, { status: 401 });
  }

  const { data: profile } = await sb.from('profiles').select('username').eq('id', user.id).maybeSingle();
  const username = profile?.username ?? 'anonimo';

  // Generate unique slug
  let slug = slugify(body.title);
  const { data: existing } = await sb.from('news').select('slug').eq('slug', slug).maybeSingle();
  if (existing) slug = `${slug}-${Date.now().toString(36)}`;

  const { error } = await sb.from('news').insert({
    slug,
    title: body.title.trim(),
    body: body.body.trim(),
    excerpt: body.excerpt?.trim() || body.body.trim().slice(0, 200),
    cover_url: body.cover_url || null,
    tags: body.tags?.trim() || null,
    status: 'draft', // not visible until approved
    moderation_status: 'pending',
    submitted_by_user_id: user.id,
    submitted_by_username: username,
    post_type: body.post_type ?? 'post',
    request_city: body.request_city?.trim() || null,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: 'Errore salvataggio.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: 'Post inviato! Sarà visibile dopo l\'approvazione.',
  });
}
