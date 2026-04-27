import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from('news')
      .select('id, slug, title, excerpt, cover_url, tags, published_at, created_at')
      .eq('status', 'published')
      /* Ordina per published_at se disponibile, altrimenti per created_at */
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[api/news] Supabase error:', error.message);
      return NextResponse.json({ ok: false, error: error.message, data: [] }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (err) {
    console.error('[api/news] Unexpected error:', err);
    return NextResponse.json({ ok: true, data: [] });
  }
}
