import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';

const Schema = z.object({
  title:        z.string().min(3).max(150),
  description:  z.string().max(2000).optional(),
  location:     z.string().max(200).optional(),
  city:         z.string().max(60).optional(),
  event_date:   z.string().min(1), // ISO date
  link_url:     z.string().url().max(500).optional(),
  access_token: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof Schema>;
  try { body = Schema.parse(await req.json()); }
  catch { return NextResponse.json({ ok: false, error: 'Dati non validi.' }, { status: 400 }); }

  const sb = supabaseAdmin();

  const { data: { user }, error: authErr } = await sb.auth.getUser(body.access_token);
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: 'Non autenticato.' }, { status: 401 });
  }

  const { data: profile } = await sb.from('profiles').select('username').eq('id', user.id).maybeSingle();
  const username = profile?.username ?? 'anonimo';

  const { error } = await sb.from('events').insert({
    title: body.title.trim(),
    description: body.description?.trim() || null,
    location: body.location?.trim() || null,
    city: body.city?.trim() || null,
    event_date: body.event_date,
    link_url: body.link_url || null,
    status: 'draft', // not visible until approved
    moderation_status: 'pending',
    submitted_by_user_id: user.id,
    submitted_by_username: username,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: 'Errore salvataggio.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: 'Evento inviato! Sarà visibile dopo l\'approvazione.',
  });
}
