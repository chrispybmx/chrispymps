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
      .order('published_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch {
    return NextResponse.json({ ok: true, data: [] });
  }
}
