import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase';
import { CITTA_ITALIANE, APP_CONFIG } from '@/lib/constants';
import type { Spot } from '@/lib/types';
import CityMapList from './CityMapList';
import { safeJsonLd } from '@/lib/json-ld';
import { citySlug, CITY_SLUG_RE } from '@/lib/slugify';
import { getApprovedCityNames } from '@/lib/spot-cities';

export const revalidate = 3600;

interface Props { params: { city: string } }

/** Label leggibile: lista curata italiana, altrimenti de-slug Title Case
    (world-wide: le città estere arrivano dai dati, non da una lista). */
function getCityLabel(slug: string, storedName?: string): string {
  const curated = CITTA_ITALIANE.find((c) => c.value === slug)?.label;
  if (curated) return curated;
  if (storedName && storedName !== slug) return storedName;
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Check di esistenza QUI (oltre che nel componente) contro il soft-404: uno
  // slug inventato generava un <title> SEO dallo slug + canonical self-
  // referencing => doorway page indicizzabile su URL infinite. Con notFound()
  // qui viene servita la 404 page (noindex, nofollow, nessun canonical).
  //
  // NOTA VERIFICATA: questo NON porta lo status a 404 finché app/map/loading.tsx
  // esiste. Quel loading.tsx crea un Suspense boundary e Next flusha lo shell
  // con 200 prima che notFound() possa cambiare lo status — misurato su Next
  // 14.2.35: rimuovendo il loading.tsx la stessa route risponde 404, tenendolo
  // resta 200. Per il 404 vero serve spostare il fallback in un <Suspense>
  // interno alla pagina (dopo il check) invece del loading.tsx di segmento.
  if (!CITY_SLUG_RE.test(params.city)) notFound();
  const spots = await getCitySpots(params.city);
  const isCuratedCity = CITTA_ITALIANE.some((c) => c.value === params.city);
  if (!isCuratedCity && spots.length === 0) notFound();

  const cityLabel = getCityLabel(params.city, spots[0]?.city);
  const hasSpots = spots.length > 0;
  const title = hasSpots ? `Spot BMX ${cityLabel} — Skatepark & Park Scooter` : `Segnala il primo spot a ${cityLabel}`;
  const description = hasSpots
    ? `${spots.length} spot pubblicati a ${cityLabel}. Consulta foto, posizione e stato segnalato dalla community di BMX, skate e scooter.`
    : `Nessuno spot pubblicato a ${cityLabel}. Conosci un posto dove girare? Segnala il primo spot alla community.`;
  const url = `${APP_CONFIG.url}/map/${params.city}`;

  return {
    title,
    description,
    robots: { index: hasSpots, follow: true, googleBot: { index: hasSpots, follow: true } },
    alternates: { canonical: url },
    keywords: [
      `spot BMX ${cityLabel}`, `skatepark ${cityLabel}`, `park scooter ${cityLabel}`,
      `spot skate ${cityLabel}`, `dove fare BMX ${cityLabel}`, `skatepark vicino ${cityLabel}`,
      `bowl ${cityLabel}`, `street spot ${cityLabel}`, `park BMX ${cityLabel}`,
    ],
    openGraph: {
      title,
      description,
      url,
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: `Spot BMX e skatepark a ${cityLabel}` }],
    },
    twitter: {
      card:        'summary_large_image',
      site:        '@chrispy_bmx',
      title,
      description,
      images:      ['/opengraph-image'],
    },
  };
}

export async function generateStaticParams() {
  // Lista curata italiana (SEO storico) + città reali dai dati (world-wide)
  const params = new Map(CITTA_ITALIANE.map((c) => [c.value, { city: c.value }]));
  try {
    for (const name of await getApprovedCityNames()) {
      const slug = citySlug(name);
      if (CITY_SLUG_RE.test(slug) && !params.has(slug)) params.set(slug, { city: slug });
    }
  } catch { /* build resiliente: se il DB non risponde, restano le città curate */ }
  return Array.from(params.values());
}

/** cache(): la query gira una volta sola per richiesta, condivisa tra
    generateMetadata (dove sta il check di esistenza) e il componente. */
const getCitySpots = cache(async (slug: string): Promise<Spot[]> => {
  const names = (await getApprovedCityNames()).filter(name => citySlug(name) === slug);
  if (names.length === 0) return [];
  const supabase = supabaseServer();
  // Resolve stored names first: accents and apostrophes cannot be reversed from a slug.
  const { data, error } = await supabase
    .from('spots')
    .select('*, spot_photos(url, position)')
    .eq('status', 'approved')
    .in('city', names)
    .order('approved_at', { ascending: false });
  if (error) throw new Error('Could not load city spots');
  return (data ?? []) as Spot[];
});

export default async function CityPage({ params }: Props) {
  if (!CITY_SLUG_RE.test(params.city)) notFound();
  const spots = await getCitySpots(params.city);
  const cityLabel = getCityLabel(params.city, spots[0]?.city);
  // Pagina valida se: città curata (SEO, anche a 0 spot) oppure ha spot reali (world-wide)
  const isCurated = CITTA_ITALIANE.some((c) => c.value === params.city);
  if (!isCurated && spots.length === 0) notFound();
  const url = `${APP_CONFIG.url}/map/${params.city}`;

  // JSON-LD: BreadcrumbList + CollectionPage con FAQ
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Mappa', item: APP_CONFIG.url },
      { '@type': 'ListItem', position: 2, name: `Spot BMX ${cityLabel}`, item: url },
    ],
  };

  const faqs = spots.length > 0 ? [
    [`Dove sono gli spot a ${cityLabel}?`, `La mappa mostra ${spots.length} spot pubblicati dalla community a ${cityLabel}. Apri una scheda per consultare foto, coordinate e ultimo stato segnalato.`],
    ['Come raggiungo uno spot?', 'Nella scheda dello spot trovi il collegamento alle indicazioni stradali. Controlla anche le note di accesso e la data dell’ultima conferma.'],
  ] : [];
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(([name, text]) => ({
      '@type': 'Question', name,
      acceptedAnswer: { '@type': 'Answer', text },
    })),
  };

  const collectionJsonLd = spots.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Spot BMX e Skatepark a ${cityLabel}`,
    url,
    description: `${spots.length} spot a ${cityLabel} pubblicati dalla community.`,
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
      {faqs.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />}
      {collectionJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(collectionJsonLd) }} />
      )}

      {/* Header */}
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--gray-700)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', marginBottom: 4 }}>
          <Link href="/" style={{ color: 'var(--orange)', textDecoration: 'none' }}>← MAPPA</Link>
          {' / '}
          {cityLabel.toUpperCase()}
        </div>
        <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 28, overflowWrap: 'anywhere', color: 'var(--orange)', margin: '4px 0 8px' }}>
          SPOT BMX {cityLabel.toUpperCase()}
        </h1>
        <p style={{ color: 'var(--gray-400)', fontSize: 15, marginBottom: 4 }}>
          {spots.length === 0
            ? 'Nessuno spot approvato ancora. Sii il primo a segnalarne uno!'
            : `${spots.length} spot pubblicati — BMX, skate & scooter`}
        </p>
        {/* Testo SEO visibile — descrive la città, aiuta il ranking */}
        {spots.length > 0 && <p style={{ color: 'var(--gray-400)', fontSize: 12, fontFamily: 'var(--font-mono)', marginTop: 8, lineHeight: 1.5 }}>
          Foto, posizione e stato degli spot segnalati dalla community.
        </p>}
      </div>

      {/* Mappa + Lista interattiva */}
      {spots.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 64, padding: '64px 20px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏴</div>
          <p style={{ color: 'var(--bone)', marginBottom: 20 }}>
            Conosci qualche spot a {cityLabel}?
          </p>
          <Link href="/?add=1" className="btn-primary" style={{ textDecoration: 'none', padding: '12px 24px' }}>
            Aggiungi il primo spot
          </Link>
        </div>
      ) : (
        <>
          <CityMapList spots={spots} cityLabel={cityLabel} city={params.city} />

          {/* Lista spot leggibile dai crawler — complement al componente client */}
          <div style={{ padding: '24px 20px 0', borderTop: '1px solid var(--gray-800)', marginTop: 8 }}>
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
              {spots.length} Spot a {cityLabel}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {spots.map(spot => {
                const t = (spot as Spot & { type: string }).type;
                return (
                  <Link
                    key={spot.id}
                    href={`/map/spot/${spot.slug}`}
                    style={{
                      display: 'block', padding: '10px 14px',
                      background: 'var(--gray-800)',
                      border: '1px solid var(--gray-700)',
                      borderRadius: 6, textDecoration: 'none',
                    }}
                  >
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {spot.name}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)', textTransform: 'uppercase' }}>
                      {t} · {cityLabel}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Sezione FAQ testuale — aiuta Google a capire la pagina */}
      {faqs.length > 0 && <div style={{ padding: '32px 20px 0', borderTop: '1px solid var(--gray-800)', marginTop: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--gray-400)', marginBottom: 16 }}>
          DOMANDE FREQUENTI — {cityLabel.toUpperCase()}
        </h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {faqs.map(([q, a]) => (
            <div key={q} style={{ background: 'var(--gray-800)', borderRadius: 6, padding: '12px 16px', border: '1px solid var(--gray-700)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)', marginBottom: 6 }}>{q}</div>
              <div style={{ fontSize: 13, color: 'var(--gray-400)', lineHeight: 1.5 }}>{a}</div>
            </div>
          ))}
        </div>
      </div>}
    </main>
  );
}
