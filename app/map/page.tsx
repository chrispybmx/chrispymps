import type { Metadata } from 'next';
import Link from 'next/link';
import MapClient from './MapClient';
import { APP_CONFIG } from '@/lib/constants';
import { safeJsonLd } from '@/lib/json-ld';

export const metadata: Metadata = {
  title:       'Spot BMX, skate e scooter: mappa della community',
  description: 'Trova spot BMX, skatepark e street spot in Italia e in altri paesi. Foto e informazioni condivise dai rider. Cerca per città, tipo e distanza.',
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
    description: 'La mappa community per trovare spot BMX, skatepark e park scooter. Foto e informazioni aggiornate dai rider.',
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
  name: 'Chrispy Maps',
  url: APP_CONFIG.url,
  description: 'Mappa interattiva di spot BMX, skate e scooter condivisi dai rider.',
  applicationCategory: 'SportsApplication',
  operatingSystem: 'Web, iOS, Android',
  inLanguage: ['it-IT', 'en-GB'],
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
      <noscript>
        <aside style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--black)', color: 'var(--bone)', padding: '40px 24px', overflowY: 'auto' }}>
          <h1>Chrispy Maps</h1>
          <p>La mappa interattiva richiede JavaScript. Puoi consultare fotografie, località e schede degli spot nell’elenco.</p>
          <p><Link href="/scopri">Scopri spot BMX, skate e scooter</Link></p>
          <p><Link href="/map/about">Il progetto e la community</Link></p>
        </aside>
      </noscript>
      <MapClient initialSpots={[]} autoAdd={autoAdd} initialSpotSlug={typeof params.spot === 'string' ? params.spot : undefined} initialQuery={typeof params.q === 'string' ? params.q : undefined} />
    </>
  );
}
