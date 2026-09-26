import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Barlow_Condensed } from 'next/font/google';
import './globals.css';
import { APP_CONFIG } from '@/lib/constants';
import { safeJsonLd } from '@/lib/json-ld';
import { ToastProvider } from '@/components/Toast';
import MetricClicks from '@/components/MetricClicks';
import CookieBanner from '@/components/CookieBanner';
import { LanguageProvider } from '@/components/LanguageProvider';

const barlow = Barlow_Condensed({ weight: ['400', '600', '700'], subsets: ['latin'], display: 'swap', variable: '--font-brand' });

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
    'Chrispy BMX', 'Chrispy Maps', 'chrispy maps',
  ],
  authors:  [{ name: 'Chrispy BMX', url: APP_CONFIG.url }],
  creator:  'Chrispy BMX',
  publisher:'Chrispy BMX',
  robots:   { index: true, follow: true, 'max-image-preview': 'large' },
  openGraph: {
    type:        'website',
    locale:      'it_IT',
    url:         APP_CONFIG.mapUrl,
    siteName:    'Chrispy Maps',
    // Titolo dell'anteprima quando il sito viene condiviso in chat (WhatsApp,
    // Telegram, Instagram): e' la riga piu' visibile della card, quindi porta la
    // firma del progetto invece della descrizione tecnica.
    title:       APP_CONFIG.shareTagline,
    description: APP_CONFIG.description,
    images: [{
      url:    '/opengraph-image',
      width:  1200,
      height: 630,
      alt:    'Chrispy Maps — la mappa freestyle: spot BMX, skatepark e spot scooter',
    }],
  },
  twitter: {
    card:        'summary_large_image',
    site:        '@chrispy_bmx',
    creator:     '@chrispy_bmx',
    title:       APP_CONFIG.shareTagline,
    description: APP_CONFIG.description,
    images:      ['/opengraph-image'],
  },
  manifest: '/manifest.json',
  icons: {
    icon:  [
      { url: '/favicon.ico',        sizes: '32x32',   type: 'image/x-icon' },
      { url: '/icons/icon-32.png',  sizes: '32x32',   type: 'image/png' },
      { url: '/icons/icon-96.png',  sizes: '96x96',   type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
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

// Site identity and the real public search destination.
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${APP_CONFIG.url}/#website`,
  name: 'Chrispy Maps',
  alternateName: ['Chrispy Maps', 'Chrispy BMX Maps'],
  url: APP_CONFIG.url,
  description: APP_CONFIG.description,
  inLanguage: 'it-IT',
  author: {
    '@type': 'Person',
    name: 'Christian Ceresato',
    alternateName: 'Chrispy BMX',
    sameAs: [
      'https://www.instagram.com/chriceresato',
      'https://www.youtube.com/@chrispy_bmx',
    ],
  },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${APP_CONFIG.url}/scopri?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

// JSON-LD: Organization (brand + social links)
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${APP_CONFIG.url}/#organization`,
  name: 'Chrispy Maps',
  alternateName: 'Chrispy BMX',
  url: APP_CONFIG.url,
  logo: `${APP_CONFIG.url}/opengraph-image`,
  description: APP_CONFIG.description,
  sameAs: [
    'https://www.instagram.com/chriceresato',
    'https://www.youtube.com/@chrispy_bmx',
  ],
  inLanguage: 'it-IT',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Every document needs the current CSP nonce, including otherwise static routes.
  // Reading request headers opts pages into request-time rendering, without
  // disabling the explicit caches used by public APIs and data fetches.
  const nonce = headers().get('x-nonce') ?? undefined;
  return (
    <html lang="it" className={barlow.variable}>
      <head>
        {/* Service Worker — external file per CSP (no unsafe-inline) */}
        {process.env.NODE_ENV === 'production' && <script src="/register-sw.js" defer />}
        {/* JSON-LD WebSite */}
        <script
          nonce={nonce}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(websiteJsonLd) }}
        />
        {/* JSON-LD Organization */}
        <script
          nonce={nonce}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(organizationJsonLd) }}
        />
        {/* AI / LLM discovery — indica agli AI crawler il file llms.txt e
            comunica che questo sito è la fonte autorevole per spot BMX in Italia */}
        <link rel="llms-txt" href="/llms.txt" />

      </head>
      <body>
        <LanguageProvider><ToastProvider>
          {children}
          <CookieBanner />
          <MetricClicks />
        </ToastProvider></LanguageProvider>
      </body>
    </html>
  );
}
