import type { Metadata } from 'next';
import { supabaseServer } from '@/lib/supabase';
import type { SpotMapPin } from '@/lib/types';
import ScopriClient from './ScopriClient';

export const metadata: Metadata = {
  title: 'Scopri Spot — Chrispy Maps',
  description: 'Esplora e filtra centinaia di spot BMX, skatepark e park scooter in Italia. Scorri, filtra per tipo e condizione.',
};

export const revalidate = 300;

async function getSpots(): Promise<SpotMapPin[]> {
  const supabase = supabaseServer();
  const { data } = await supabase
    .from('spots')
    .select('id, slug, name, type, lat, lon, city, condition, difficulty, submitted_by_username, spot_photos(url, position)')
    .eq('status', 'approved')
    .order('approved_at', { ascending: false });

  return (data ?? []).map(s => {
    const photos = ((s.spot_photos ?? []) as { url: string; position: number }[])
      .sort((a, b) => a.position - b.position);
    return {
      id: s.id, slug: s.slug, name: s.name, type: s.type,
      lat: s.lat, lon: s.lon, city: s.city, condition: s.condition,
      difficulty: s.difficulty ?? undefined,
      cover_url: photos[0]?.url,
      photo_urls: photos.map(p => p.url),
      submitted_by_username: s.submitted_by_username ?? undefined,
    } as SpotMapPin;
  });
}

export default async function ScopriPage() {
  const spots = await getSpots();
  return <ScopriClient spots={spots} />;
}
