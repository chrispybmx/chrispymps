import type { Metadata } from 'next';
import Link from 'next/link';
import { TIPI_SPOT, CITTA_ITALIANE, APP_CONFIG } from '@/lib/constants';
import { safeJsonLd } from '@/lib/json-ld';

const url = `${APP_CONFIG.url}/skate-maps`;

export const metadata: Metadata = {
  title: 'Skate Maps Italia — Trova Skatepark, Bowl e Street Spot',
  description: 'La mappa italiana di skatepark, bowl, street spot, pumptrack e park scooter. Community-driven, aggiornata e gratuita. Trova lo spot perfetto vicino a te.',
  alternates: { canonical: url },
  keywords: [
    'skate maps Italia', 'skatepark Italia', 'mappa skatepark', 'bowl skate Italia',
    'pumptrack Italia', 'street spot skate', 'park scooter Italia', 'skatepark vicino a me',
  ],
  openGraph: {
    title: 'Skate Maps Italia — Chrispy Maps',
    description: 'Trova skatepark, bowl, street spot e pumptrack in tutta Italia.',
    url,
    siteName: 'Chrispy Maps',
    locale: 'it_IT',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', site: '@chrispy_bmx', title: 'Skate Maps Italia — Chrispy Maps' },
};

const FAQ = [
  {
    q: 'Come trovo uno skatepark vicino a me?',
    a: 'Apri la mappa su Chrispy Maps, attiva la geolocalizzazione e filtra per tipo "Park". Vedrai tutti gli skatepark verificati nella tua zona.',
  },
  {
    q: 'Posso aggiungere uno spot alla mappa?',
    a: 'Certo! Registrati gratuitamente, clicca su "+ Spot" e compila il form con posizione, foto e descrizione. Ogni spot viene verificato manualmente prima di apparire.',
  },
  {
    q: 'La mappa include anche bowl e pumptrack?',
    a: 'S\u00ec, Chrispy Maps include bowl, pumptrack, street spot, rail, ledge, gap, plaza, trail e DIY oltre ai classici skatepark.',
  },
  {
    q: 'Chrispy Maps \u00e8 gratuito?',
    a: 'Completamente gratuito, senza pubblicit\u00e0. \u00c8 un progetto indipendente della community BMX italiana.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(f => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const SPOT_TYPES = Object.entries(TIPI_SPOT).map(([key, info]) => ({ key, ...info }));

const TOP_CITIES = CITTA_ITALIANE.slice(0, 16);

export default function SkateMapPage() {
  return (
    <div style={{ background: 'var(--black)', minHeight: '100dvh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />

      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--gray-700)', background: 'rgba(10,10,10,0.98)' }}>
        <div style={{ maxWidth: 780, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" style={{ color: 'var(--gray-400)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            ← Mappa
          </Link>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--orange)' }}>
            SKATE MAPS
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 20px 60px' }}>

        {/* Hero */}
        <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(26px, 5vw, 38px)', color: 'var(--bone)', margin: '0 0 12px', lineHeight: 1.2 }}>
          Skate Maps Italia
        </h1>
        <p style={{ color: 'var(--gray-400)', fontSize: 16, lineHeight: 1.7, margin: '0 0 32px', maxWidth: 560 }}>
          La mappa community italiana di skatepark, bowl, street spot, pumptrack e park scooter.
          Aggiornata dalla community, verificata a mano. Gratuita, senza pubblicità.
        </p>

        <Link href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700,
          background: 'var(--orange)', color: '#000',
          padding: '12px 24px', borderRadius: 8, textDecoration: 'none',
          marginBottom: 40,
        }}>
          Apri la mappa
        </Link>

        {/* Spot types */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--orange)', margin: '0 0 16px' }}>
            Tipi di spot
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {SPOT_TYPES.map(t => (
              <Link key={t.key} href={`/scopri?type=${t.key}`} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 14px',
                background: 'var(--gray-800)', border: '1px solid var(--gray-700)', borderRadius: 8,
                textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: 14,
                color: t.color,
              }}>
                <span>{t.emoji}</span>
                <span>{t.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Cities grid */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--orange)', margin: '0 0 16px' }}>
            Spot per città
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
            {TOP_CITIES.map(c => (
              <Link key={c.value} href={`/map/${c.value}`} style={{
                padding: '10px 12px',
                background: 'var(--gray-800)', border: '1px solid var(--gray-700)', borderRadius: 6,
                textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: 13,
                color: 'var(--bone)', textAlign: 'center',
              }}>
                {c.label}
              </Link>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--orange)', margin: '0 0 16px' }}>
            Domande frequenti
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {FAQ.map((f, i) => (
              <div key={i} style={{ background: 'var(--gray-800)', border: '1px solid var(--gray-700)', borderRadius: 8, padding: '16px 18px' }}>
                <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--bone)', margin: '0 0 8px', lineHeight: 1.3 }}>
                  {f.q}
                </h3>
                <p style={{ color: 'var(--gray-400)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer CTA */}
        <div style={{ textAlign: 'center', paddingTop: 20, borderTop: '1px solid var(--gray-700)' }}>
          <Link href="/" style={{
            fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--orange)',
            textDecoration: 'none', border: '1px solid var(--orange)',
            padding: '10px 24px', borderRadius: 6, display: 'inline-block',
          }}>
            Esplora la mappa
          </Link>
        </div>
      </div>
    </div>
  );
}
