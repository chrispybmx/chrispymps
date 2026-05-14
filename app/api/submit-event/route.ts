import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Helper: accetta "", null, undefined come "non fornito" e auto-prepend https://
 * se l'utente digita il dominio senza schema. Output: stringa URL valida o undefined.
 */
const optionalUrl = z
  .union([z.literal(''), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (!v) return undefined;
    const t = String(v).trim();
    if (!t) return undefined;
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
  })
  .pipe(z.string().url().max(500).optional());

const Schema = z.object({
  title:        z.string().trim().min(3, 'Titolo troppo corto (min 3)').max(150),
  description:  z.string().trim().max(2000).optional(),
  location:     z.string().trim().max(200).optional(),
  city:         z.string().trim().max(60).optional(),
  event_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve essere YYYY-MM-DD'),
  link_url:     optionalUrl,
  cover_url:    optionalUrl,
  access_token: z.string().min(1, 'Sessione scaduta, rifai login'),
});

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  if (!raw) {
    return NextResponse.json(
      { ok: false, error: 'Body JSON non valido.' },
      { status: 400 },
    );
  }

  const parsed = Schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.') || 'campo'}: ${i.message}`)
      .join(' | ');
    console.error('[submit-event] validation failed:', issues, '| raw:', JSON.stringify(raw));
    return NextResponse.json(
      { ok: false, error: `Dati non validi: ${issues}` },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const sb = supabaseAdmin();

  const { data: { user }, error: authErr } = await sb.auth.getUser(body.access_token);
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: 'Non autenticato.' }, { status: 401 });
  }

  const { data: profile } = await sb.from('profiles').select('username').eq('id', user.id).maybeSingle();
  const username = profile?.username ?? 'anonimo';

  const { error } = await sb.from('events').insert({
    title: body.title,
    description: body.description || null,
    location: body.location || null,
    city: body.city || null,
    event_date: body.event_date,
    link_url: body.link_url || null,
    cover_url: body.cover_url || null,
    status: 'draft', // not visible until approved
    moderation_status: 'pending',
    submitted_by_user_id: user.id,
    submitted_by_username: username,
  });

  if (error) {
    console.error('[submit-event] DB insert failed:', error);
    return NextResponse.json({ ok: false, error: 'Errore salvataggio.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: 'Evento inviato! Sarà visibile dopo l\'approvazione.',
  });
}
