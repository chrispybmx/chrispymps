import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function slugify(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 80);
}

export async function GET() {
  if (!isAdminAuthenticated()) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  const { data, error } = await supabaseAdmin().from('news').select('*, news_photos(id, url, position, caption)').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data: data ?? [] });
}

export async function POST(req: Request) {
  if (!isAdminAuthenticated()) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  // Validazione e sanitizzazione input
  const title   = typeof body.title   === 'string' ? body.title.trim()   : '';
  const excerpt = typeof body.excerpt === 'string' ? body.excerpt.trim() : '';
  const content = typeof body.body    === 'string' ? body.body.trim()    : '';
  const status  = body.status === 'published' ? 'published' : 'draft';
  const cover_url = typeof body.cover_url === 'string' && body.cover_url.startsWith('http') ? body.cover_url : null;
  const tags    = typeof body.tags === 'string' ? body.tags.slice(0, 200) : null;

  if (!title || title.length < 3 || title.length > 200) {
    return NextResponse.json({ ok: false, error: 'Titolo tra 3 e 200 caratteri.' }, { status: 400 });
  }
  if (content.length > 50000) {
    return NextResponse.json({ ok: false, error: 'Contenuto troppo lungo (max 50.000 caratteri).' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // Parse extra photos from body
  const extraPhotos: { url: string; caption: string | null }[] = [];
  if (typeof body.extra_photos_text === 'string') {
    body.extra_photos_text.split('\n').forEach((line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const [rawUrl, ...captionParts] = trimmed.split('|');
      const url = rawUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) return;
      const caption = captionParts.join('|').trim().slice(0, 200) || null;
      extraPhotos.push({ url, caption });
    });
  } else if (Array.isArray(body.extra_photos)) {
    for (const p of body.extra_photos.slice(0, 20)) {
      if (typeof p.url === 'string' && (p.url.startsWith('http://') || p.url.startsWith('https://'))) {
        extraPhotos.push({ url: p.url, caption: typeof p.caption === 'string' ? p.caption.slice(0, 200) : null });
      }
    }
  }
  if (extraPhotos.length > 20) extraPhotos.length = 20;

  let newsId: string | undefined;

  if (body.id) {
    // UPDATE
    if (!UUID_RE.test(String(body.id))) return NextResponse.json({ ok: false, error: 'ID non valido' }, { status: 400 });
    newsId = body.id;
    const updateFields: Record<string, unknown> = {
      title, excerpt, body: content, cover_url, tags, status,
      published_at: status === 'published' ? (body.published_at || new Date().toISOString()) : null,
      moderation_status: status === 'published' ? 'published' : 'pending',
    };
    if (body.moderation_status) updateFields.moderation_status = body.moderation_status;
    const { error } = await supabase.from('news').update(updateFields).eq('id', body.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else {
    // CREATE
    let slug = slugify(title);
    const { data: ex } = await supabase.from('news').select('id').eq('slug', slug).maybeSingle();
    if (ex) slug = `${slug}-${Date.now()}`;
    const { data: created, error } = await supabase.from('news').insert({
      slug, title, excerpt, body: content, cover_url, tags, status,
      published_at: status === 'published' ? new Date().toISOString() : null,
      moderation_status: status === 'published' ? 'published' : 'pending',
    }).select('id').single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    newsId = created.id;
  }

  // Save extra photos
  if (newsId) {
    await supabase.from('news_photos').delete().eq('news_id', newsId);
    if (extraPhotos.length > 0) {
      const rows = extraPhotos.map((p, i) => ({ news_id: newsId, url: p.url, caption: p.caption, position: i }));
      const { error: photoErr } = await supabase.from('news_photos').insert(rows);
      if (photoErr) console.error('[admin/news] news_photos insert error:', photoErr.message);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!isAdminAuthenticated()) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (!id || !UUID_RE.test(String(id))) return NextResponse.json({ ok: false, error: 'ID non valido' }, { status: 400 });
  const { error } = await supabaseAdmin().from('news').delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
