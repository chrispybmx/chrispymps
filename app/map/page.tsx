import type { Metadata } from 'next';
import MapClient from './MapClient';
import { APP_CONFIG } from '@/lib/constants';
import { safeJsonLd } from '@/lib/json-ld';

export const metadata: Metadata = {
  title:       'Mappa Spot BMX, Skate & Scooter Italia',
  description: 'Trova spot BMX, skatepark, park scooter e street spot in tutta Italia. Mappa interattiva community-driven con centinaia di spot verificati. Cerca per città, tipo e distanza.',
  alternates: { canonical: APP_CONFIG.url },
  keywords: [
    'mappa spot BMX Italia', 'skatepark vicino a me', 'spot scooter Italia',
    'trovare skatepark', 'BMX spot map Italy', 'park scooter vicino',
    'mappa skate Italia', 'spot street BMX', 'bowl skate Italia',
  ],
  // NB: la home "/" fa rewrite su "/map" (next.config.js), quindi QUESTI sono i
  // metadata dell'anteprima quando si condivide il sito — non quelli del layout.
  openGraph: {
    title:       APP_CONFIG.shareTagline,
    description: 'La mappa community per trovare spot BMX, skatepark e park scooter. Centinaia di spot verificati, aggiornati dai rider.',
    url:         APP_CONFIG.url,
    images:      [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Chrispy Maps — la mappa freestyle' }],
  },
  twitter: {
    card:        'summary_large_image',
    site:        '@chrispy_bmx',
    title:       APP_CONFIG.shareTagline,
    description: 'La mappa community per trovare spot BMX, skatepark e park scooter.',
    images:      ['/opengraph-image'],
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
  const params: { [key: string]: string | string[] | undefined } = searchParams ? await searchParams : {};
  const autoAdd = params['add'] === '1';

  // Spots loaded CLIENT-SIDE for instant page render
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(mapJsonLd) }}
      />
      <MapClient initialSpots={[]} autoAdd={autoAdd} />
    </>
  );
}
