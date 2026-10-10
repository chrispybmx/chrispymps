import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  normalizzaDiscipline,
  normalizzaAnnoInizio,
} from '@/lib/rider-profile';
import { countryCode, validBirthDate } from '@/lib/registration';

/** Saves only supplied rider fields. Newsletter consent uses its dedicated API. */

export const dynamic = 'force-dynamic';

interface Corpo {
  birthDate?:   string | null;
  region?:      string | null;
  countryCode?: string | null;
  disciplines?: unknown;
  ridingSinceYear?: unknown;
  setupBrand?:  string | null;
  newsletter?:  boolean;
  /** Serve solo per l'iscrizione a MailerLite. */
  username?:    string;
}

/** 'YYYY-MM-DD' plausibile, altrimenti null. */
function dataValida(v: unknown): string | null {
  return validBirthDate(v)?v:null;
}

export async function GET(req:NextRequest) {
  const token=req.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const headers={'Cache-Control':'no-store'};
  if(!token)return NextResponse.json({ok:false},{status:401,headers});
  try {
    const sb=supabaseAdmin();const {data:{user},error}=await sb.auth.getUser(token);
    if(error||!user)return NextResponse.json({ok:false},{status:401,headers});
    const result=await sb.from('rider_details').select('country_code,disciplines,region').eq('user_id',user.id).maybeSingle();
    if(result.error)throw new Error('READ_FAILED');
    return NextResponse.json({ok:true,data:result.data},{headers});
  }catch{return NextResponse.json({ok:false,error:'Preferenze non disponibili.'},{status:503,headers});}
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
  if('birthDate' in body&&body.birthDate!==null&&!validBirthDate(body.birthDate))return NextResponse.json({ok:false,error:'Data non valida.'},{status:422});
  if('countryCode' in body&&body.countryCode!==null&&!countryCode.safeParse(body.countryCode).success)return NextResponse.json({ok:false,error:'Paese non valido.'},{status:422});

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
      ...('countryCode' in body ? { country_code:body.countryCode } : {}),
      ...('disciplines' in body ? { disciplines } : {}),
      ...('ridingSinceYear' in body ? { riding_since_year: ridingSinceYear } : {}),
      ...('setupBrand' in body ? { setup_brand: setupBrand } : {}),
      updated_at:           new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (upsertErr) {
    console.error('[api/rider/details] upsert failed:', upsertErr.code);
    return NextResponse.json({ ok: false, error: 'Salvataggio non riuscito' }, { status: 500 });
  }

  // Consent lives exclusively in /api/newsletter/preferences. Profile changes must
  // never subscribe, withdraw, reset consent dates or overwrite omitted fields.
  return NextResponse.json({ ok: true, ...(body.newsletter === true ? {
    newsletterAttiva: false, motivo: 'Conferma la newsletter dalle preferenze del profilo.',
  } : {}) });
}
