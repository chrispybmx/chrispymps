import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase';
import { TIPI_SPOT, CONDIZIONI, APP_CONFIG } from '@/lib/constants';
import type { Spot } from '@/lib/types';
import SpotInteractions from '@/components/SpotInteractions';
import PhotoCarousel from '@/components/PhotoCarousel';
import SupportStrip from '@/components/SupportStrip';
import ShareSpotBtn from '@/components/ShareSpotBtn';
import SpotContributeCTA from '@/components/SpotContributeCTA';
import SpotLikeBtn from '@/components/SpotLikeBtn';

export const revalidate = 300;

interface Props { params: { slug: string } }

async function getSpot(slug: string): Promise<Spot | null> {
  const supabase = supabaseServer();
  const { data } = await supabase
    .from('spots')
    .select('*, likes_count, spot_photos(id, url, position, credit_name)')
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
  const appleMaps = `maps://maps.apple.com/?daddr=${spot.lat},${spot.lon}&dirflg=d`;

  const isYouTube = spot.youtube_url &&
    /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(spot.youtube_url);
  const embedUrl = isYouTube
    ? spot.youtube_url!.replace(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/\s]+)/,
        'https://www.youtube.com/embed/$1?rel=0'
      )
    : null;

  return (
    <main style={{
      background: 'var(--black)',
      minHeight: '100dvh',
      maxWidth: 680,
      margin: '0 auto',
      paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))',
    }}>

      {/* ── BACK BUTTON — sticky top ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(10,10,10,0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--gray-700)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{
          color: 'var(--gray-400)', textDecoration: 'none',
          fontFamily: 'var(--font-mono)', fontSize: 13,
        }}>
          ← Mappa
        </Link>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: tipo.color }}>
            {tipo.emoji} {tipo.label.toUpperCase()}
          </span>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: cond.bg,
            display: 'inline-block',
          }} />
        </div>
      </div>

      {/* ── TITOLO ── */}
      <div style={{ padding: '20px 20px 0' }}>
        <h1 style={{
          fontFamily: 'var(--font-mono)', fontSize: 28,
          color: 'var(--orange)', margin: '0 0 6px', lineHeight: 1.15,
        }}>
          {spot.name}
        </h1>

        {/* Posizione + condizione — riga compatta */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 16,
        }}>
          {spot.city && (
            <span style={{ color: 'var(--gray-400)' }}>📍 {spot.city}{spot.region ? `, ${spot.region}` : ''}</span>
          )}
          <span style={{ color: cond.bg, background: `${cond.bg}18`, padding: '2px 8px', borderRadius: 10, fontSize: 10, border: `1px solid ${cond.bg}44` }}>
            {cond.label.toUpperCase()}
          </span>
          {spot.difficulty && (
            <span style={{ color: '#ffce4d', fontSize: 10 }}>⚡ {spot.difficulty.toUpperCase()}</span>
          )}
        </div>
      </div>

      {/* ── FOTO CAROUSEL — grande, prominente ── */}
      {photos.length > 0 && (
        <PhotoCarousel photos={photos.map(p => ({ url: p.url, credit_name: p.credit_name ?? undefined }))} />
      )}

      {/* ── DESCRIZIONE ── */}
      <div style={{ padding: '16px 20px 0' }}>
        {spot.description && (
          <p style={{ color: 'var(--bone)', lineHeight: 1.7, marginBottom: 20, fontSize: 15, margin: '0 0 20px' }}>
            {spot.description}
          </p>
        )}

        {/* Publisher */}
        {spot.submitted_by_username && (
          <Link href={`/u/${spot.submitted_by_username}`} style={{
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
            marginBottom: 20,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', background: 'var(--orange)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 11, color: '#000',
            }}>
              {spot.submitted_by_username[0].toUpperCase()}
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)' }}>
              @<strong style={{ color: 'var(--orange)' }}>{spot.submitted_by_username}</strong>
            </span>
          </Link>
        )}

        {/* Meta info */}
        {(spot.surface || spot.guardians) && (
          <div style={{
            padding: '12px 14px', marginBottom: 16,
            background: 'var(--gray-800)', borderRadius: 8,
            border: '1px solid var(--gray-700)',
            fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)',
            lineHeight: 1.6,
          }}>
            {spot.surface && <div>Superficie: <span style={{ color: 'var(--bone)' }}>{spot.surface}</span></div>}
            {spot.guardians && <div>⚠️ {spot.guardians}</div>}
          </div>
        )}

        {/* ── AZIONI — una riga pulita ── */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 20,
        }}>
          <SpotLikeBtn spotId={spot.id} initialCount={spot.likes_count ?? 0} />
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '12px', borderRadius: 8,
              background: 'var(--orange)', color: '#000',
              fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
              textDecoration: 'none', letterSpacing: '0.04em',
            }}>
            📍 PORTAMI QUI
          </a>
          <ShareSpotBtn spotName={spot.name} spotSlug={spot.slug} city={spot.city} />
        </div>

        {/* ── CONTRIBUTE — discreto ── */}
        <SpotContributeCTA
          spotId={spot.id}
          spotName={spot.name}
          currentCondition={spot.condition}
          photoCount={photos.length}
          lastConfirmedAt={spot.condition_updated_at}
        />

        {/* ── VIDEO YOUTUBE ── */}
        {embedUrl && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 8 }}>
              <iframe
                src={embedUrl}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={`Video ${spot.name}`}
                loading="lazy"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── COMMENTI ── */}
      <SpotInteractions spotId={spot.id} spotSlug={spot.slug} />

      {/* ── FOOTER ── */}
      <div style={{
        textAlign: 'center', padding: '16px 20px 4px',
        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-600)',
      }}>
        aggiornato {new Date(spot.condition_updated_at).toLocaleDateString('it-IT')}
      </div>

      <SupportStrip />

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': ['SportsActivityLocation', 'Place'],
          name: spot.name,
          description: spot.description ?? `Spot ${tipo.label} a ${spot.city ?? 'Italia'}`,
          url: `${APP_CONFIG.url}/map/spot/${spot.slug}`,
          geo: { '@type': 'GeoCoordinates', latitude: spot.lat, longitude: spot.lon },
          address: { '@type': 'PostalAddress', addressLocality: spot.city ?? '', addressCountry: 'IT' },
          image: photos.map(p => p.url),
        })}}
      />
    </main>
  );
}
