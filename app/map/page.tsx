import type { Metadata } from 'next';
import MapClient from './MapClient';
import { APP_CONFIG } from '@/lib/constants';

export const metadata: Metadata = {
  title:       'Mappa Spot BMX, Skate & Scooter Italia | Chrispy Maps',
  description: 'Trova spot BMX, skatepark, park scooter e street spot in tutta Italia. Mappa interattiva community-driven con centinaia di spot verificati. Cerca per città, tipo e distanza.',
  alternates: { canonical: APP_CONFIG.url },
  keywords: [
    'mappa spot BMX Italia', 'skatepark vicino a me', 'spot scooter Italia',
    'trovare skatepark', 'BMX spot map Italy', 'park scooter vicino',
    'mappa skate Italia', 'spot street BMX', 'bowl skate Italia',
  ],
  openGraph: {
    title:       'Chrispy Maps — Mappa Spot BMX, Skate & Scooter Italia',
    description: 'La mappa community italiana per trovare spot BMX, skatepark e park scooter. Centinaia di spot verificati in tutta Italia.',
    url:         APP_CONFIG.url,
    images:      [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Mappa spot BMX e skatepark Italia' }],
  },
};

const mapJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Chrispy Maps — Mappa Spot BMX Italia',
  url: APP_CONFIG.url,
  description: 'Mappa interattiva community-driven per trovare spot BMX, skatepark, park scooter e street spot in tutta Italia.',
  applicationCategory: 'SportsApplication',
  operatingSystem: 'Web, iOS, Android',
  inLanguage: 'it-IT',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
};

export default async function MapPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await (searchParams ?? Promise.resolve({}));
  const autoAdd = params['add'] === '1';

  // Spots loaded CLIENT-SIDE for instant page render
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(mapJsonLd) }}
      />
      <MapClient initialSpots={[]} autoAdd={autoAdd} />
    </>
  );
}
