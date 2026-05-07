import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { JAM_SPOTS } from '@/lib/jamroma';

/**
 * GET — spot ufficiali della jam con foto dal DB.
 */
export async function GET() {
  const sb = supabaseAdmin();
  const spotIds = JAM_SPOTS.map(s => s.spotId);

  const { data: dbSpots } = await sb
    .from('spots')
    .select('id, name, slug, lat, lon, city, type, spot_photos (url, position)')
    .in('id', spotIds);

  const spots = JAM_SPOTS.map(jam => {
    const db = dbSpots?.find((s: { id: string }) => s.id === jam.spotId) as
      | { id: string; name: string; slug: string; type: string; spot_photos: { url: string; position: number }[] }
      | undefined;

    // Prendi la prima foto ordinata per position
    const photos = (db?.spot_photos ?? []).sort((a, b) => a.position - b.position);
    const coverUrl = photos[0]?.url ?? null;

    return {
      id: jam.spotId,
      slug: jam.slug,
      label: jam.label,
      lat: jam.lat,
      lon: jam.lon,
      meetingPoint: jam.meetingPoint,
      description: jam.description,
      coverUrl,
      type: db?.type ?? 'street',
    };
  });

  return NextResponse.json({ ok: true, spots });
}
