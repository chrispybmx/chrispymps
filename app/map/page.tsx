import type { Metadata } from 'next';
import MapClient from './MapClient';
import { supabaseServer } from '@/lib/supabase';
import type { SpotMapPin } from '@/lib/types';
import { APP_CONFIG } from '@/lib/constants';

export const metadata: Metadata = {
  title:       `${APP_CONFIG.siteName} — Find Your Spot`,
  description: APP_CONFIG.description,
  openGraph: {
    title:       `${APP_CONFIG.siteName} — Find Your Spot`,
    description: 'La mappa BMX street italiana, community-driven. Trova o segnala spot nella tua città.',
    url:         `${APP_CONFIG.url}/map`,
    images:      [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
};

// Rivalidazione ogni 5 minuti — aggiornamenti spot appaiono entro 5 min senza rebuild
export const revalidate = 300;

async function getSpots(): Promise<SpotMapPin[]> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('spots')
    .select(`
      id, slug, name, type, lat, lon, city, condition,
      spot_photos (url, position)
    `)
    .eq('status', 'approved')
    .order('approved_at', { ascending: false });

  if (error) {
    console.error('[map/page] Supabase error:', error.message);
    return [];
  }

  return (data ?? []).map((s) => {
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
    } as SpotMapPin;
  });
}

export default async function MapPage() {
  const spots = await getSpots();

  return <MapClient initialSpots={spots} />;
}
