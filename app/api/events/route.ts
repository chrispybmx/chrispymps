import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'published')
      .gte('event_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // include ultimi 7 giorni
      .order('event_date', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch {
    return NextResponse.json({ ok: true, data: [] }); // graceful fallback se tabella non esiste
  }
}
