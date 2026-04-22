import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import type { SpotMapPin } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('spots')
    .select(`
      id, slug, name, type, lat, lon, city, condition, submitted_by_username,
      spot_photos (url, position)
    `)
    .eq('status', 'approved')
    .order('approved_at', { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const pins: SpotMapPin[] = (data ?? []).map((s) => {
    const photos = (s.spot_photos ?? []) as { url: string; position: number }[];
    const sorted = [...photos].sort((a, b) => a.position - b.position);
    return {
      id:        s.id,
      slug:      s.slug,
      name:      s.name,
      type:      s.type,
      lat:       s.lat,
      lon:       s.lon,
      city:      s.city,
      condition: s.condition,
      cover_url: sorted[0]?.url,
      submitted_by_username: s.submitted_by_username ?? undefined,
    };
  });

  return NextResponse.json({ ok: true, data: pins }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
