/** @type {import('next').NextConfig} */

// Security headers STATICI — non includono CSP perché il CSP è generato
// dinamicamente nel middleware con un nonce per-request (anti-XSS).
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
  // NOTA: Content-Security-Policy è stato spostato in middleware.ts
  // per supportare nonce-based CSP (rimuove unsafe-inline da script-src).
];

const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
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
    // Redirect /map rimosso — il rewrite / → /map è sufficiente.
    // Mantenere entrambi creava una redirect chain inutile.
    return [];
  },
};

module.exports = nextConfig;
