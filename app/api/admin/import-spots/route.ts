import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import type { SpotType } from '@/lib/types';

interface ImportSpot {
  name:        string;
  lat:         number;
  lon:         number;
  description: string;
  type:        SpotType;
  city?:       string;
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}

export async function POST(req: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const { spots }: { spots: ImportSpot[] } = await req.json();
  if (!spots || spots.length === 0) {
    return NextResponse.json({ ok: false, error: 'Nessuno spot da importare' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const results  = { ok: 0, error: 0, errors: [] as string[] };

  for (const s of spots) {
    // Genera slug unico
    let slug = slugify(s.name);
    const { data: existing } = await supabase
      .from('spots').select('id').eq('slug', slug).maybeSingle();
    if (existing) slug = `${slug}-${Date.now()}`;

    const { error } = await supabase.from('spots').insert({
      slug,
      name:        s.name,
      type:        s.type,
      lat:         s.lat,
      lon:         s.lon,
      city:        s.city ?? null,
      description: s.description || null,
      condition:   'alive',
      status:      'approved',
      wax_needed:  false,
      approved_at: new Date().toISOString(),
    });

    if (error) { results.error++; results.errors.push(`${s.name}: ${error.message}`); }
    else        { results.ok++; }
  }

  return NextResponse.json({ ok: true, imported: results.ok, failed: results.error, errors: results.errors });
}
