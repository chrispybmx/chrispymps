import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase';
import { CITTA_ITALIANE, APP_CONFIG } from '@/lib/constants';
import type { Spot } from '@/lib/types';
import CityMapList from './CityMapList';

export const revalidate = 3600;

interface Props { params: { city: string } }

function getCityLabel(slug: string): string {
  return CITTA_ITALIANE.find((c) => c.value === slug)?.label ?? slug;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cityLabel = getCityLabel(params.city);
  const title       = `Spot BMX ${cityLabel} — Skatepark & Park Scooter`;
  const description = `Trova i migliori spot BMX, skatepark e park scooter a ${cityLabel}. Mappa interattiva con spot street, bowl, rail e park verificati dalla community.`;
  const url = `${APP_CONFIG.url}/map/${params.city}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    keywords: [
      `spot BMX ${cityLabel}`, `skatepark ${cityLabel}`, `park scooter ${cityLabel}`,
      `spot skate ${cityLabel}`, `dove fare BMX ${cityLabel}`, `skatepark vicino ${cityLabel}`,
      `bowl ${cityLabel}`, `street spot ${cityLabel}`, `park BMX ${cityLabel}`,
    ],
    openGraph: {
      title:       `Spot BMX ${cityLabel} — Chrispy Maps`,
      description: `I migliori spot BMX e skatepark a ${cityLabel}. Trova dove andare con la bici, lo skateboard o lo scooter.`,
      url,
      images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
    },
  };
}

export async function generateStaticParams() {
  return CITTA_ITALIANE.map((c) => ({ city: c.value }));
}

async function getCitySpots(city: string): Promise<Spot[]> {
  const supabase = supabaseServer();
  const { data } = await supabase
    .from('spots')
    .select('*, spot_photos(url, position)')
    .eq('status', 'approved')
    .eq('city', city)
    .order('approved_at', { ascending: false });
  return (data ?? []) as Spot[];
}

export default async function CityPage({ params }: Props) {
  const cityLabel = getCityLabel(params.city);
  if (!CITTA_ITALIANE.find((c) => c.value === params.city)) notFound();

  const spots = await getCitySpots(params.city);
  const url = `${APP_CONFIG.url}/map/${params.city}`;

  // JSON-LD: BreadcrumbList + CollectionPage con FAQ
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Mappa', item: `${APP_CONFIG.url}/map` },
      { '@type': 'ListItem', position: 2, name: `Spot BMX ${cityLabel}`, item: url },
    ],
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Dove si trovano gli spot BMX a ${cityLabel}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Su Chrispy Maps trovi tutti gli spot BMX verificati a ${cityLabel}: park, street, bowl e rail. La mappa è aggiornata dalla community di rider italiani.`,
        },
      },
      {
        '@type': 'Question',
        name: `Ci sono skatepark a ${cityLabel}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Sì, Chrispy Maps raccoglie skatepark e spot street a ${cityLabel} per BMX, skateboard e scooter. Clicca su un pin per vedere foto, condizioni e come arrivarci.`,
        },
      },
      {
        '@type': 'Question',
        name: `Dove fare scooter a ${cityLabel}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Trovi i park e gli spot adatti al freestyle scooter a ${cityLabel} su Chrispy Maps: skatepark con rampe, bowl e street features.`,
        },
      },
    ],
  };

  const collectionJsonLd = spots.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Spot BMX e Skatepark a ${cityLabel}`,
    url,
    description: `${spots.length} spot BMX, skatepark e park scooter a ${cityLabel} verificati dalla community.`,
    numberOfItems: spots.length,
  } : null;

  return (
    <main style={{
      background: 'var(--black)',
      minHeight: '100dvh',
      paddingTop: 'var(--topbar-height)',
      paddingBottom: 'calc(var(--strip-height) + 24px)',
    }}>
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      {collectionJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      )}

      {/* Header */}
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--gray-700)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', marginBottom: 4 }}>
          <Link href="/map" style={{ color: 'var(--orange)', textDecoration: 'none' }}>← MAPPA</Link>
          {' / '}
          {cityLabel.toUpperCase()}
        </div>
        <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 34, color: 'var(--orange)', margin: '4px 0 8px' }}>
          SPOT BMX {cityLabel.toUpperCase()}
        </h1>
        <p style={{ color: 'var(--gray-400)', fontSize: 15, marginBottom: 4 }}>
          {spots.length === 0
            ? 'Nessuno spot approvato ancora. Sii il primo a segnalarne uno!'
            : `${spots.length} spot ${spots.length === 1 ? 'verificato' : 'verificati'} — BMX, skate & scooter`}
        </p>
        {/* Testo SEO visibile — descrive la città, aiuta il ranking */}
        <p style={{ color: 'var(--gray-600)', fontSize: 12, fontFamily: 'var(--font-mono)', marginTop: 8, lineHeight: 1.5 }}>
          Skatepark, street spot, bowl e park a {cityLabel}. Aggiornato dalla community di BMX, skate e scooter.
        </p>
      </div>

      {/* Mappa + Lista interattiva */}
      {spots.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 64, padding: '64px 20px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏴</div>
          <p style={{ color: 'var(--bone)', marginBottom: 20 }}>
            Conosci qualche spot a {cityLabel}?
          </p>
          <Link href="/map?add=1" className="btn-primary" style={{ textDecoration: 'none', padding: '12px 24px' }}>
            Aggiungi il primo spot
          </Link>
        </div>
      ) : (
        <CityMapList spots={spots} cityLabel={cityLabel} city={params.city} />
      )}

      {/* Sezione FAQ testuale — aiuta Google a capire la pagina */}
      <div style={{ padding: '32px 20px 0', borderTop: '1px solid var(--gray-800)', marginTop: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--gray-400)', marginBottom: 16 }}>
          DOMANDE FREQUENTI — {cityLabel.toUpperCase()}
        </h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {[
            [`Dove sono gli spot BMX a ${cityLabel}?`, `Qui sopra trovi tutti gli spot BMX verificati a ${cityLabel}: park, street, bowl, rail e DIY. Ogni spot ha foto, condizione attuale e coordinate GPS.`],
            [`Ci sono skatepark a ${cityLabel}?`, `Chrispy Maps raccoglie skatepark e spot street a ${cityLabel} per BMX, skateboard e scooter. Clicca su un pin per vedere dettagli e come arrivarci.`],
            [`Dove fare scooter a ${cityLabel}?`, `I park e gli spot adatti al freestyle scooter a ${cityLabel} sono segnalati su Chrispy Maps con rampe, bowl e street features.`],
          ].map(([q, a]) => (
            <div key={q} style={{ background: 'var(--gray-800)', borderRadius: 6, padding: '12px 16px', border: '1px solid var(--gray-700)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)', marginBottom: 6 }}>{q}</div>
              <div style={{ fontSize: 13, color: 'var(--gray-400)', lineHeight: 1.5 }}>{a}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
