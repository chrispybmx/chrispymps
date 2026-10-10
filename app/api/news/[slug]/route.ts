import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from('news')
      .select('*')
      .eq('slug', params.slug)
      .eq('status', 'published')
      .single();

    if (error || !data) return NextResponse.json({ ok: false, error: 'Non trovato' }, { status: 404 });
    return NextResponse.json({ ok: true, data });
  } catch {
    return NextResponse.json({ ok: false, error: 'Errore' }, { status: 500 });
  }
}
