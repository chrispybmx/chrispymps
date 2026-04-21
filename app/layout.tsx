import type { Metadata, Viewport } from 'next';
import './globals.css';
import { APP_CONFIG } from '@/lib/constants';
import VhsOverlay from '@/components/VhsOverlay';
import SupportStrip from '@/components/SupportStrip';

export const metadata: Metadata = {
  title: {
    template: `%s | ${APP_CONFIG.siteName}`,
    default:  `${APP_CONFIG.siteName} — ${APP_CONFIG.tagline}`,
  },
  description:     APP_CONFIG.description,
  metadataBase:    new URL(APP_CONFIG.url),
  applicationName: APP_CONFIG.siteName,
  keywords:        ['BMX', 'spot BMX', 'mappa BMX', 'street BMX', 'Italia', 'skatepark'],
  authors:         [{ name: 'Chrispy BMX', url: APP_CONFIG.url }],
  creator:         'Chrispy BMX',
  robots:          { index: true, follow: true },
  openGraph: {
    type:        'website',
    locale:      'it_IT',
    url:         APP_CONFIG.mapUrl,
    siteName:    APP_CONFIG.siteName,
    title:       `${APP_CONFIG.siteName} — ${APP_CONFIG.tagline}`,
    description: APP_CONFIG.description,
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'ChrispyMPS — Find Your Spot' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       `${APP_CONFIG.siteName} — ${APP_CONFIG.tagline}`,
    description: APP_CONFIG.description,
    images:      ['/og-image.jpg'],
  },
  manifest: '/manifest.json',
  icons: {
    icon:  [
      { url: '/icons/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor:           '#ff6a00',
  width:                'device-width',
  initialScale:         1,
  maximumScale:         1,
  userScalable:         false,
  viewportFit:          'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        {/* Registrazione Service Worker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.warn('SW registration failed:', err);
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body>
        {/* Overlay VHS scanlines — sempre sopra tutto */}
        <VhsOverlay />

        {/* Contenuto pagina */}
        {children}

        {/* Strip supporto ambient — persistente */}
        <SupportStrip />
      </body>
    </html>
  );
}
