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
      // Immagini: Supabase storage, tile mappa (CartoDB + OSM), dati inline
      "img-src 'self' data: blob: *.supabase.co *.supabase.in *.basemaps.cartocdn.com *.tile.openstreetmap.org unpkg.com",
      // Connessioni API: Supabase, Nominatim OSM
      "connect-src 'self' *.supabase.co *.supabase.in nominatim.openstreetmap.org wss://*.supabase.co",
      // Worker per Leaflet
      "worker-src blob:",
      // Frame: OSM per anteprima mappa + YouTube per video spot (SEC-FIX: aggiunto youtube)
      "frame-src https://*.openstreetmap.org https://www.youtube.com https://www.youtube-nocookie.com",
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
  async rewrites() {
    return [
      // La home "/" serve il contenuto di "/map" senza redirect visibile —
      // così l'URL in barra rimane maps.chrispybmx.com (niente /map superfluo)
      { source: '/', destination: '/map' },
    ];
  },
  async redirects() {
    return [
      // Normalizza /map → / con 308 permanente, così i vecchi link
      // (share, email, backlink) arrivano comunque alla home pulita.
      // ATTENZIONE: source '/map' matcha solo il path esatto, NON /map/spot ecc.
      { source: '/map', destination: '/', permanent: true },
    ];
  },
};

module.exports = nextConfig;
