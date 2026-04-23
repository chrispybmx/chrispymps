import type { Metadata } from 'next';
import MapClient from './MapClient';
import { supabaseServer } from '@/lib/supabase';
import type { SpotMapPin } from '@/lib/types';
import { APP_CONFIG } from '@/lib/constants';

export const metadata: Metadata = {
  title:       'Mappa Spot BMX, Skate & Scooter Italia | Chrispy Maps',
  description: 'Trova spot BMX, skatepark, park scooter e street spot in tutta Italia. Mappa interattiva community-driven con centinaia di spot verificati. Cerca per città, tipo e distanza.',
  alternates: { canonical: `${APP_CONFIG.url}/map` },
  keywords: [
    'mappa spot BMX Italia', 'skatepark vicino a me', 'spot scooter Italia',
    'trovare skatepark', 'BMX spot map Italy', 'park scooter vicino',
    'mappa skate Italia', 'spot street BMX', 'bowl skate Italia',
  ],
  openGraph: {
    title:       'Chrispy Maps — Mappa Spot BMX, Skate & Scooter Italia',
    description: 'La mappa community italiana per trovare spot BMX, skatepark e park scooter. Centinaia di spot verificati in tutta Italia.',
    url:         `${APP_CONFIG.url}/map`,
    images:      [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Mappa spot BMX e skatepark Italia' }],
  },
};

export const revalidate = 300;

const mapJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Chrispy Maps — Mappa Spot BMX Italia',
  url: `${APP_CONFIG.url}/map`,
  description: 'Mappa interattiva community-driven per trovare spot BMX, skatepark, park scooter e street spot in tutta Italia.',
  applicationCategory: 'SportsApplication',
  operatingSystem: 'Web, iOS, Android',
  inLanguage: 'it-IT',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  author: {
    '@type': 'Person',
    name: 'Christian Ceresato',
    alternateName: 'Chrispy BMX',
  },
  about: {
    '@type': 'Thing',
    name: 'BMX, Skateboarding, Scooter',
    description: 'Sport di street e park: BMX freestyle, skateboard, monopattino freestyle',
  },
};

async function getSpots(): Promise<SpotMapPin[]> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('spots')
    .select(`id, slug, name, type, lat, lon, city, condition, description, submitted_by_username, spot_photos (url, position)`)
    .eq('status', 'approved')
    .order('approved_at', { ascending: false })
    .order('position', { referencedTable: 'spot_photos', ascending: true });

  if (error) {
    console.error('[map/page] Supabase error:', error.message);
    return [];
  }

  return (data ?? []).map((s) => {
    // spot_photos è già ordinato per position ASC dalla query
    const photos = (s.spot_photos ?? []) as { url: string; position: number }[];
    return {
      id: s.id, slug: s.slug, name: s.name, type: s.type,
      lat: s.lat, lon: s.lon, city: s.city, condition: s.condition,
      cover_url:   photos[0]?.url,
      photo_urls:  photos.map(p => p.url),
      description: s.description ?? undefined,
      submitted_by_username: s.submitted_by_username ?? undefined,
    } as SpotMapPin;
  });
}

export default async function MapPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const spots = await getSpots();
  const params = await (searchParams ?? Promise.resolve({}));
  const autoAdd = params['add'] === '1';

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(mapJsonLd) }}
      />
      <MapClient initialSpots={spots} autoAdd={autoAdd} />
    </>
  );
}
