import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase';
import { TIPI_SPOT, CONDIZIONI, APP_CONFIG } from '@/lib/constants';
import type { Spot } from '@/lib/types';

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
  const tipo = TIPI_SPOT[spot.type];
  const cover = spot.spot_photos?.[0]?.url;
  return {
    title:       `${spot.name} — ${spot.city ?? 'Italia'}`,
    description: spot.description ?? `Spot BMX ${tipo.label} a ${spot.city ?? 'Italia'}.`,
    openGraph: {
      title:       `${spot.name} — ChrispyMPS`,
      description: spot.description ?? `Spot BMX ${tipo.label} a ${spot.city ?? 'Italia'}. Condition: ${spot.condition}.`,
      url:         `${APP_CONFIG.url}/map/spot/${spot.slug}`,
      images:      cover ? [{ url: cover, width: 1200, height: 630 }] : [{ url: '/og-image.jpg' }],
      type:        'article',
    },
    twitter: {
      card:        'summary_large_image',
      title:       `${spot.name} — ChrispyMPS`,
      description: spot.description ?? `Spot BMX ${tipo.label} a ${spot.city ?? 'Italia'}.`,
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
  const shareUrl = `${APP_CONFIG.url}/map/spot/${spot.slug}`;

  const embedUrl = spot.youtube_url
    ? spot.youtube_url.replace(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/\s]+)/,
        'https://www.youtube.com/embed/$1?rel=0'
      )
    : null;

  return (
    <main style={{
      background: 'var(--black)',
      minHeight: '100dvh',
      paddingBottom: 'calc(var(--strip-height) + 24px)',
      maxWidth: 680,
      margin: '0 auto',
    }}>
      {/* Back */}
      <div style={{ padding: '16px 20px 0' }}>
        <Link href="/map" style={{ color: 'var(--orange)', fontFamily: 'var(--font-mono)', fontSize: 14, textDecoration: 'none' }}>
          ← TORNA ALLA MAPPA
        </Link>
      </div>

      {/* Foto hero */}
      {photos.length > 0 && (
        <div style={{ marginTop: 16, position: 'relative' }}>
          <img
            src={photos[0].url}
            alt={spot.name}
            style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }}
          />
          {/* Condition badge */}
          <div style={{
            position: 'absolute', top: 12, right: 12,
            background: cond.bg, color: cond.color,
            fontFamily: 'var(--font-mono)', fontSize: 13,
            padding: '4px 10px', borderRadius: 2, textTransform: 'uppercase',
          }}>
            ● {cond.label}
          </div>
        </div>
      )}

      <div style={{ padding: '20px 20px 0' }}>
        {/* Titolo */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 32, color: 'var(--orange)', margin: 0, lineHeight: 1.1 }}>
            {spot.name}
          </h1>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 13,
            color: tipo.color, border: `1px solid ${tipo.color}`,
            padding: '4px 10px', borderRadius: 2, textTransform: 'uppercase',
            flexShrink: 0,
          }}>
            {tipo.emoji} {tipo.label}
          </span>
        </div>

        {spot.city && (
          <p style={{ color: 'var(--gray-400)', marginBottom: 16 }}>
            📍 {spot.city}{spot.region ? `, ${spot.region}` : ''}
          </p>
        )}

        {spot.description && (
          <p style={{ color: 'var(--bone)', lineHeight: 1.6, marginBottom: 20 }}>
            {spot.description}
          </p>
        )}

        {/* Meta grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '12px 20px', marginBottom: 24,
          padding: '16px', background: 'var(--gray-800)',
          borderRadius: 4, border: '1px solid var(--gray-700)',
        }}>
          {spot.surface  && <MetaRow label="Superficie" value={spot.surface} />}
          {spot.difficulty && <MetaRow label="Livello"   value={spot.difficulty} />}
          <MetaRow label="Cera" value={spot.wax_needed ? '🕯️ Necessaria' : 'Non necessaria'} />
          {spot.guardians && <div style={{ gridColumn: '1/-1' }}><MetaRow label="Note accesso" value={spot.guardians} /></div>}
          <MetaRow label="Aggiornato" value={new Date(spot.condition_updated_at).toLocaleDateString('it-IT')} />
        </div>

        {/* Galleria foto aggiuntive */}
        {photos.length > 1 && (
          <div style={{ marginBottom: 24 }}>
            <SectionTitle>FOTO ({photos.length})</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
              {photos.map((photo, i) => (
                <img
                  key={photo.id}
                  src={photo.url}
                  alt={`Foto ${i + 1} di ${spot.name}`}
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 4, display: 'block' }}
                  loading="lazy"
                />
              ))}
            </div>
          </div>
        )}

        {/* Video YouTube */}
        {embedUrl && (
          <div style={{ marginBottom: 24 }}>
            <SectionTitle>▶ VIDEO @CHRISPY_BMX</SectionTitle>
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 4 }}>
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

        {/* Mappa mini (link) */}
        <div style={{ marginBottom: 24 }}>
          <SectionTitle>POSIZIONE GPS</SectionTitle>
          <a
            href={`https://www.openstreetmap.org/?mlat=${spot.lat}&mlon=${spot.lon}&zoom=17`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'block', textDecoration: 'none' }}
          >
            <div style={{
              background: 'var(--gray-800)',
              border: '1px solid var(--gray-700)',
              borderRadius: 4, padding: '14px 16px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--orange)', fontSize: 14,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              📍 {spot.lat.toFixed(6)}, {spot.lon.toFixed(6)}
              <span style={{ marginLeft: 'auto', color: 'var(--gray-400)', fontSize: 12 }}>Apri mappa ↗</span>
            </div>
          </a>
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            style={{ flex: 1, justifyContent: 'center', textDecoration: 'none', minWidth: 140 }}
          >
            🧭 Portami qui
          </a>
          <a
            href={`/map${spot.city ? `/${spot.city}` : ''}`}
            className="btn-secondary"
            style={{ flex: 1, justifyContent: 'center', textDecoration: 'none', minWidth: 140 }}
          >
            📍 Altri spot {spot.city ? `a ${spot.city}` : 'in Italia'}
          </a>
        </div>

        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Place',
            name: spot.name,
            description: spot.description,
            geo: { '@type': 'GeoCoordinates', latitude: spot.lat, longitude: spot.lon },
            address: { '@type': 'PostalAddress', addressLocality: spot.city, addressCountry: 'IT' },
            image: photos[0]?.url,
          })}}
        />
      </div>
    </main>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
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
