import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = supabaseServer();

    // Try with spot join first (requires spot_id FK to exist)
    let data: unknown[] | null = null;
    let error: { message: string } | null = null;

    /* Restituisce TUTTI gli eventi pubblicati (passati e futuri) così il
       calendario mostra i pallini su tutti i mesi con eventi */
    ({ data, error } = await supabase
      .from('events')
      .select('*, spot:spots(name, slug)')
      .eq('status', 'published')
      .order('event_date', { ascending: true }) as { data: unknown[] | null; error: { message: string } | null });

    // Fallback: join might fail if spot_id column doesn't exist yet
    if (error) {
      ({ data, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .order('event_date', { ascending: true }) as { data: unknown[] | null; error: { message: string } | null });
    }

    if (error) {
      console.error('[api/events] Supabase error:', error.message);
      return NextResponse.json({ ok: false, error: error.message, data: [] }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (err) {
    console.error('[api/events] Unexpected error:', err);
    return NextResponse.json({ ok: true, data: [] });
  }
}
