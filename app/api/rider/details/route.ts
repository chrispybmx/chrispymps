import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  normalizzaDiscipline,
  normalizzaAnnoInizio,
} from '@/lib/rider-profile';

/** Saves only supplied rider fields. Newsletter consent uses its dedicated API. */

export const dynamic = 'force-dynamic';

interface Corpo {
  birthDate?:   string | null;
  region?:      string | null;
  disciplines?: unknown;
  ridingSinceYear?: unknown;
  setupBrand?:  string | null;
  newsletter?:  boolean;
  /** Serve solo per l'iscrizione a MailerLite. */
  username?:    string;
}

/** 'YYYY-MM-DD' plausibile, altrimenti null. */
function dataValida(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const anno = d.getFullYear();
  if (anno < 1920 || d.getTime() > Date.now()) return null;
  return v;
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: { user }, error: userErr } = await sb.auth.getUser(auth.slice(7));
  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: 'Sessione scaduta' }, { status: 401 });
  }

  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return NextResponse.json({ ok:false, error:'Dati non validi.' }, { status:400 });
  const body = raw as Corpo;

  const birthDate   = dataValida(body.birthDate);
  const region      = typeof body.region === 'string' && body.region.trim() ? body.region.trim().slice(0, 60) : null;
  const disciplines = normalizzaDiscipline(body.disciplines);
  const ridingSinceYear = normalizzaAnnoInizio(body.ridingSinceYear);
  const setupBrand  = typeof body.setupBrand === 'string' && body.setupBrand.trim() ? body.setupBrand.trim().slice(0, 80) : null;
  const { error: upsertErr } = await sb
    .from('rider_details')
    .upsert({
      user_id:              user.id,
      ...('birthDate' in body ? { birth_date: birthDate } : {}),
      ...('region' in body ? { region } : {}),
      ...('disciplines' in body ? { disciplines } : {}),
      ...('ridingSinceYear' in body ? { riding_since_year: ridingSinceYear } : {}),
      ...('setupBrand' in body ? { setup_brand: setupBrand } : {}),
      updated_at:           new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (upsertErr) {
    console.error('[api/rider/details] upsert error:', upsertErr.message, upsertErr);
    return NextResponse.json({ ok: false, error: 'Salvataggio non riuscito' }, { status: 500 });
  }

  // Consent lives exclusively in /api/newsletter/preferences. Profile changes must
  // never subscribe, withdraw, reset consent dates or overwrite omitted fields.
  return NextResponse.json({ ok: true, ...(body.newsletter === true ? {
    newsletterAttiva: false, motivo: 'Conferma la newsletter dalle preferenze del profilo.',
  } : {}) });
}
