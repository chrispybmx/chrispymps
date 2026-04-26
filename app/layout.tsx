import type { Metadata, Viewport } from 'next';
import './globals.css';
import { APP_CONFIG } from '@/lib/constants';
import VhsOverlay from '@/components/VhsOverlay';

export const metadata: Metadata = {
  title: {
    template: `%s | Chrispy Maps`,
    default:  `Chrispy Maps — Mappa Spot BMX, Skate & Scooter Italia`,
  },
  description: APP_CONFIG.description,
  metadataBase:    new URL(APP_CONFIG.url),
  applicationName: 'Chrispy Maps',
  keywords: [
    // Core sport keywords
    'spot BMX Italia', 'skatepark Italia', 'spot scooter Italia',
    'mappa skatepark', 'mappa spot BMX', 'BMX street Italia',
    // City combos — Google li premia
    'spot BMX Milano', 'spot BMX Roma', 'spot BMX Torino',
    'skatepark Milano', 'skatepark Roma', 'skatepark Torino',
    'skatepark Napoli', 'skatepark Firenze', 'skatepark Bologna',
    // Tipo spot
    'park BMX', 'bowl skate', 'spot street skate', 'spot DIY BMX',
    'ledge skate', 'rail BMX', 'gap skate', 'plaza spot',
    // Intenzione utente
    'dove fare BMX', 'dove andare con lo scooter', 'dove skate in Italia',
    'trovare spot skate', 'skatepark vicino a me', 'park scooter vicino a me',
    // Brand
    'Chrispy BMX', 'ChrispyMPS', 'chrispy maps',
  ],
  authors:  [{ name: 'Chrispy BMX', url: APP_CONFIG.url }],
  creator:  'Chrispy BMX',
  publisher:'Chrispy BMX',
  robots:   { index: true, follow: true, googleBot: { index: true, follow: true } },
  alternates: { canonical: APP_CONFIG.url },
  openGraph: {
    type:        'website',
    locale:      'it_IT',
    url:         APP_CONFIG.mapUrl,
    siteName:    'Chrispy Maps',
    title:       'Chrispy Maps — Mappa Spot BMX, Skate & Scooter Italia',
    description: APP_CONFIG.description,
    images: [{
      url:    '/og-image.jpg',
      width:  1200,
      height: 630,
      alt:    'Chrispy Maps — Trova spot BMX, skatepark e spot scooter in Italia',
    }],
  },
  twitter: {
    card:        'summary_large_image',
    site:        '@chrispy_bmx',
    creator:     '@chrispy_bmx',
    title:       'Chrispy Maps — Mappa Spot BMX Italia',
    description: APP_CONFIG.description,
    images:      ['/og-image.jpg'],
  },
  manifest: '/manifest.json',
  icons: {
    icon:  [
      { url: '/icons/icon-32.png',  sizes: '32x32',   type: 'image/png' },
      { url: '/icons/icon-96.png',  sizes: '96x96',   type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor:    '#ff6a00',
  width:         'device-width',
  initialScale:  1,
  // SEO-FIX: rimosso userScalable:false e maximumScale:1 — violano WCAG 1.4.4
  // e Google penalizza le pagine che bloccano lo zoom su mobile
  viewportFit:   'cover',
};

// JSON-LD: WebSite + SearchAction (Google sitelinks searchbox)
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Chrispy Maps',
  alternateName: ['ChrispyMPS', 'Chrispy BMX Maps'],
  url: APP_CONFIG.url,
  description: APP_CONFIG.description,
  inLanguage: 'it-IT',
  author: {
    '@type': 'Person',
    name: 'Christian Ceresato',
    alternateName: 'Chrispy BMX',
    sameAs: [
      'https://www.instagram.com/chrispy_bmx',
      'https://www.youtube.com/@chrispy_bmx',
    ],
  },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${APP_CONFIG.url}/map?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        {/* Service Worker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker'in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});})}`,
          }}
        />
        {/* JSON-LD WebSite */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body>
        <VhsOverlay />
        {children}
      </body>
    </html>
  );
}
