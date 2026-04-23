import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase';
import { TIPI_SPOT, CONDIZIONI, APP_CONFIG } from '@/lib/constants';
import type { Spot } from '@/lib/types';
import SpotInteractions from '@/components/SpotInteractions';
import PhotoCarousel from '@/components/PhotoCarousel';
import StatusUpdateBtn from '@/components/StatusUpdateBtn';
import SupportStrip from '@/components/SupportStrip';

export const revalidate = 300;

interface Props { params: { slug: string } }

async function getSpot(slug: string): Promise<Spot | null> {
  const supabase = supabaseServer();
  const { data } = await supabase
    .from('spots')
    .select('*, spot_photos(id, url, position, credit_name)')
    .eq('slug', slug)
    .eq('status', 'approved')
    .single();
  if (!data) return null;
  if (data.spot_photos) {
    data.spot_photos.sort((a: { position: number }, b: { position: number }) => a.position - b.position);
  }
  return data as Spot;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const spot = await getSpot(params.slug);
  if (!spot) return { title: 'Spot non trovato' };
  const tipo   = TIPI_SPOT[spot.type];
  const cover  = spot.spot_photos?.[0]?.url;
  const city   = spot.city ?? 'Italia';
  const title  = `${spot.name} — Spot ${tipo.label} a ${city}`;
  const desc   = spot.description
    ? `${spot.description} Spot ${tipo.label} a ${city}.`
    : `${spot.name} è uno spot ${tipo.label} a ${city}. Trova foto, condizione attuale e coordinate GPS su Chrispy Maps.`;
  const url    = `${APP_CONFIG.url}/map/spot/${spot.slug}`;

  return {
    title,
    description: desc,
    alternates: { canonical: url },
    keywords: [
      `spot BMX ${city}`, `${tipo.label} ${city}`, `${spot.name} BMX`,
      `skatepark ${city}`, `spot scooter ${city}`, spot.name,
    ],
    openGraph: {
      title:       `${spot.name} — Spot ${tipo.label} ${city} | Chrispy Maps`,
      description: desc,
      url,
      images:      cover ? [{ url: cover, width: 1200, height: 630, alt: `${spot.name} — spot ${tipo.label} a ${city}` }] : [{ url: '/og-image.jpg' }],
      type:        'article',
    },
    twitter: {
      card:        'summary_large_image',
      title:       `${spot.name} — ${tipo.label} a ${city}`,
      description: desc,
      images:      cover ? [cover] : ['/og-image.jpg'],
    },
  };
}

export default async function SpotPage({ params }: Props) {
  const spot = await getSpot(params.slug);
  if (!spot) notFound();

  const tipo  = TIPI_SPOT[spot.type];
  const cond  = CONDIZIONI[spot.condition];
  const photos = spot.spot_photos ?? [];
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lon}`;

  const isYouTube = spot.youtube_url &&
    /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(spot.youtube_url);
  const embedUrl = isYouTube
    ? spot.youtube_url!.replace(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/\s]+)/,
        'https://www.youtube.com/embed/$1?rel=0'
      )
    : null;

  /* OpenStreetMap embed bounds (±0.004° ~400m) */
  const delta = 0.004;
  const osmEmbed = `https://www.openstreetmap.org/export/embed.html?bbox=${spot.lon - delta},${spot.lat - delta},${spot.lon + delta},${spot.lat + delta}&layer=mapnik&marker=${spot.lat},${spot.lon}`;

  return (
    <main style={{
      background: 'var(--black)',
      minHeight: '100dvh',
      paddingBottom: 'calc(var(--strip-height) + 32px)',
      maxWidth: 680,
      margin: '0 auto',
    }}>

      {/* ── MAPPA FULL-WIDTH IN ALTO ── */}
      <div style={{ position: 'relative', width: '100%' }}>
        <iframe
          src={osmEmbed}
          width="100%"
          height="240"
          style={{ border: 'none', display: 'block', background: '#1a1a1a' }}
          title={`Posizione di ${spot.name} sulla mappa`}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
        />
        {/* Back button sopra la mappa */}
        <div style={{
          position: 'absolute', top: 12, left: 12,
          background: 'rgba(10,10,10,0.82)', borderRadius: 6,
          backdropFilter: 'blur(8px)',
        }}>
          <Link href="/map" style={{
            color: 'var(--orange)', fontFamily: 'var(--font-mono)',
            fontSize: 13, textDecoration: 'none',
            padding: '6px 12px', display: 'block',
          }}>
            ← MAPPA
          </Link>
        </div>
        {/* Condition badge sopra la mappa */}
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: cond.bg, color: cond.color,
          fontFamily: 'var(--font-mono)', fontSize: 12,
          padding: '5px 10px', borderRadius: 4, textTransform: 'uppercase',
        }}>
          ● {cond.label}
        </div>
      </div>

      {/* ── BARRA NERA SOTTO MAPPA — copre i credits OSM ── */}
      {spot.city && (
        <div style={{
          background: '#000',
          padding: '8px 16px',
          borderBottom: '1px solid rgba(255,106,0,0.15)',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--gray-500)',
          }}>
            {spot.city}
          </div>
        </div>
      )}

      {/* ── FOTO CAROUSEL ── */}
      {photos.length > 0 && (
        <PhotoCarousel photos={photos.map(p => ({ url: p.url, credit_name: p.credit_name ?? undefined }))} />
      )}

      <div style={{ padding: '20px 20px 0' }}>

        {/* ── HEADER: Tipo + Titolo + Publisher ── */}
        <div style={{ marginBottom: 20 }}>
          {/* Badge tipo */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontFamily: 'var(--font-mono)', fontSize: 12,
            color: tipo.color, marginBottom: 8,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            <span style={{ fontSize: 16 }}>{tipo.emoji}</span>
            {tipo.label}
          </div>

          {/* Titolo */}
          <h1 style={{
            fontFamily: 'var(--font-mono)', fontSize: 34,
            color: 'var(--orange)', margin: '0 0 10px', lineHeight: 1.1,
          }}>
            {spot.name}
          </h1>

          {/* Città */}
          {spot.city && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 14,
              color: 'var(--gray-400)', marginBottom: 10,
            }}>
              📍 {spot.city}{spot.region ? `, ${spot.region}` : ''}
            </div>
          )}

          {/* Publisher — più visibile */}
          {spot.submitted_by_username && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--gray-800)',
              border: '1px solid var(--gray-700)',
              borderRadius: 20, padding: '6px 14px',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--orange)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 13,
                color: '#000', fontWeight: 700,
              }}>
                {spot.submitted_by_username[0].toUpperCase()}
              </div>
              <div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 13,
                  color: 'var(--bone)', lineHeight: 1.2,
                }}>
                  @{spot.submitted_by_username}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  ha pubblicato questo spot
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── DESCRIZIONE ── */}
        {spot.description && (
          <p style={{
            color: 'var(--bone)', lineHeight: 1.7,
            marginBottom: 24, fontSize: 15,
          }}>
            {spot.description}
          </p>
        )}

        {/* ── META INFO ── */}
        {(spot.surface || spot.difficulty || spot.guardians) && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '12px 20px', marginBottom: 24,
            padding: '16px', background: 'var(--gray-800)',
            borderRadius: 8, border: '1px solid var(--gray-700)',
          }}>
            {spot.surface    && <MetaRow label="Superficie" value={spot.surface} />}
            {spot.difficulty && <MetaRow label="Livello"   value={spot.difficulty} />}
            {spot.guardians && (
              <div style={{ gridColumn: '1/-1' }}>
                <MetaRow label="Note accesso" value={spot.guardians} />
              </div>
            )}
          </div>
        )}

        {/* ── VIDEO YOUTUBE ── */}
        {embedUrl && (
          <div style={{ marginBottom: 24 }}>
            <SectionTitle>▶ VIDEO @CHRISPY_BMX</SectionTitle>
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 6 }}>
              <iframe
                src={embedUrl}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={`Video dello spot ${spot.name}`}
                loading="lazy"
              />
            </div>
          </div>
        )}

        {/* ── CTA BUTTONS ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 32, flexWrap: 'wrap' }}>
          <Link
            href="/map"
            className="btn-secondary"
            style={{ flex: 1, justifyContent: 'center', textDecoration: 'none', minWidth: 140 }}
          >
            ← Torna alla mappa
          </Link>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            style={{ flex: 1, justifyContent: 'center', textDecoration: 'none', minWidth: 140 }}
          >
            🧭 Portami qui
          </a>
        {/* Data aggiornamento — discreta, in fondo a destra */}
        <div style={{
          textAlign: 'right',
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--gray-600)',
          letterSpacing: '0.05em',
          marginBottom: 8,
        }}>
          aggiornato {new Date(spot.condition_updated_at).toLocaleDateString('it-IT')}
        </div>
        </div>
      </div>

      {/* ── SPOT INTERACTIONS: stelle, cuore, commenti ── */}
      <SpotInteractions spotId={spot.id} spotSlug={spot.slug} />

      {/* ── SUPPORT STRIP ── */}
      <SupportStrip />

      {/* ── AGGIORNA STATO ── */}
      <StatusUpdateBtn spotId={spot.id} spotName={spot.name} currentCondition={spot.condition} />

      <div style={{ padding: '0 20px' }}>
        {/* JSON-LD: BreadcrumbList */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Mappa', item: `${APP_CONFIG.url}/map` },
              ...(spot.city ? [{ '@type': 'ListItem', position: 2, name: `Spot ${spot.city}`, item: `${APP_CONFIG.url}/map/${spot.city}` }] : []),
              { '@type': 'ListItem', position: spot.city ? 3 : 2, name: spot.name, item: `${APP_CONFIG.url}/map/spot/${spot.slug}` },
            ],
          })}}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': ['SportsActivityLocation', 'Place'],
            name: spot.name,
            description: spot.description ?? `Spot ${TIPI_SPOT[spot.type].label} a ${spot.city ?? 'Italia'} per BMX, skateboard e scooter.`,
            url: `${APP_CONFIG.url}/map/spot/${spot.slug}`,
            geo: {
              '@type': 'GeoCoordinates',
              latitude:  spot.lat,
              longitude: spot.lon,
            },
            address: {
              '@type': 'PostalAddress',
              addressLocality: spot.city ?? '',
              addressCountry: 'IT',
            },
            image: photos.map(p => p.url),
            sport: ['BMX', 'Skateboarding', 'Scooter Freestyle'],
          })}}
        />
      </div>
    </main>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--bone)', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: 12,
      color: 'var(--gray-400)', textTransform: 'uppercase',
      letterSpacing: '0.08em', marginBottom: 10,
    }}>
      {children}
    </div>
  );
}
