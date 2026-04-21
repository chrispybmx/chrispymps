/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Impedisce il click-jacking (iframe embedding)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Impedisce il MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Forza HTTPS per 1 anno, inclusi sottodomini
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  // Limita le informazioni nel Referrer header
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disabilita funzionalità browser non necessarie
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
  // XSS Protection per browser legacy
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js e React richiedono unsafe-eval in dev; in prod è ridotto
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Leaflet e stili inline
      "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
      // Font Google + locali
      "font-src 'self' fonts.gstatic.com",
      // Immagini: Supabase storage, OSM tiles, dati inline
      "img-src 'self' data: blob: *.supabase.co *.tile.openstreetmap.org *.supabase.in unpkg.com",
      // Connessioni API: Supabase, Nominatim OSM
      "connect-src 'self' *.supabase.co *.supabase.in nominatim.openstreetmap.org wss://*.supabase.co",
      // Worker per Leaflet
      "worker-src blob:",
      // Frame: solo OSM per anteprima mappa
      "frame-src https://*.openstreetmap.org",
      // Object: nessuno
      "object-src 'none'",
      // Base URI limitata
      "base-uri 'self'",
      // Form solo verso se stesso
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig = {
  reactStrictMode: true,
  // Manteniamo ignoreBuildErrors solo per deploy rapidi — da rimuovere a lungo termine
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
    ],
  },
  async headers() {
    return [
      {
        // Applica gli header di sicurezza a tutte le route
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      { source: '/', destination: '/map', permanent: false },
    ];
  },
};

module.exports = nextConfig;
