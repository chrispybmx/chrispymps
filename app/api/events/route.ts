import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = supabaseServer();

    // Try with spot join first (requires spot_id FK to exist)
    let data: unknown[] | null = null;
    let error: { message: string } | null = null;

    ({ data, error } = await supabase
      .from('events')
      .select('*, spot:spots(name, slug)')
      .eq('status', 'published')
      .gte('event_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('event_date', { ascending: true }) as { data: unknown[] | null; error: { message: string } | null });

    // Fallback: join might fail if spot_id column doesn't exist yet
    if (error) {
      ({ data, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .gte('event_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('event_date', { ascending: true }) as { data: unknown[] | null; error: { message: string } | null });
    }

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch {
    return NextResponse.json({ ok: true, data: [] });
  }
}
