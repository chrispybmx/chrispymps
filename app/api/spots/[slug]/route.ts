import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('spots')
    .select(`
      *,
      spot_photos (id, url, position, credit_name)
    `)
    .eq('slug', params.slug)
    .eq('status', 'approved')
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'Spot non trovato' }, { status: 404 });
  }

  // Ordina foto per posizione
  if (data.spot_photos) {
    data.spot_photos.sort((a: { position: number }, b: { position: number }) => a.position - b.position);
  }

  return NextResponse.json({ ok: true, data }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
