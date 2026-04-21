import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  if (!isAdminAuthenticated()) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  try {
    // Try with spot join (requires spot_id FK)
    let result = await supabaseAdmin()
      .from('events')
      .select('*, spot:spots(name, slug)')
      .order('event_date', { ascending: true });

    if (result.error) {
      // Fallback without join
      result = await supabaseAdmin()
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });
    }

    return NextResponse.json({ ok: true, data: result.data ?? [] });
  } catch { return NextResponse.json({ ok: true, data: [] }); }
}

export async function POST(req: Request) {
  if (!isAdminAuthenticated()) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  const body = await req.json();
  const supabase = supabaseAdmin();

  const fields = {
    title:       body.title,
    description: body.description,
    location:    body.location,
    city:        body.city,
    event_date:  body.event_date,
    cover_url:   body.cover_url  || null,
    link_url:    body.link_url   || null,
    status:      body.status     ?? 'published',
    spot_id:     body.spot_id    || null,
  };

  if (body.id) {
    // UPDATE
    const { error } = await supabase.from('events').update(fields).eq('id', body.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else {
    // CREATE
    const { error } = await supabase.from('events').insert(fields);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!isAdminAuthenticated()) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  const { id } = await req.json();
  const { error } = await supabaseAdmin().from('events').delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
