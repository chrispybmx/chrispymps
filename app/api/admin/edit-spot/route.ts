import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminAuthenticated } from '@/lib/auth';

const Schema = z.object({
  id:          z.string().uuid(),
  name:        z.string().min(2).max(100).optional(),
  type:        z.enum(['street','park','diy','rail','ledge','trail','plaza','gap','bowl','pumptrack']).optional(),
  city:        z.string().max(60).optional(),
  description: z.string().max(500).optional().nullable(),
  surface:     z.string().max(50).optional().nullable(),
  wax_needed:  z.boolean().optional(),
  guardians:   z.string().max(200).optional().nullable(),
  difficulty:  z.string().optional().nullable(),
  youtube_url: z.string().url().optional().nullable(),
  lat:         z.number().min(-90).max(90).optional(),
  lon:         z.number().min(-180).max(180).optional(),
});

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const body   = await req.json().catch(() => ({}));
  const result = Schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ ok: false, error: 'Dati non validi' }, { status: 422 });
  }

  const { id, ...updates } = result.data;
  const supabase = supabaseAdmin();

  const { error } = await supabase.from('spots').update(updates).eq('id', id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
