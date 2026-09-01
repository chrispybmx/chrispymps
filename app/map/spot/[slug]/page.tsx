import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase';
import { TIPI_SPOT, OSTACOLI, CONDIZIONI, APP_CONFIG } from '@/lib/constants';
import { safeJsonLd } from '@/lib/json-ld';
import { getFreshness } from '@/lib/freshness';
import type { Ostacolo, Spot } from '@/lib/types';
import SpotInteractions from '@/components/SpotInteractions';
import PhotoCarousel from '@/components/PhotoCarousel';
import SupportStrip from '@/components/SupportStrip';
import ShareSpotBtn from '@/components/ShareSpotBtn';
import SpotContributeCTA from '@/components/SpotContributeCTA';
import SpotLikeBtn from '@/components/SpotLikeBtn';
import SpotPageActions, { SpotStarRating } from '@/components/SpotPageActions';
import SpotOwnerActions from '@/components/SpotOwnerActions';
import SpotPageShell from './SpotPageShell';

export const revalidate = 300;

interface Props { params: { slug: string }; searchParams: { from?: string } }

/** cache(): la query gira una volta sola per richiesta, condivisa tra
    generateMetadata (dove sta il check di esistenza) e il componente. */
const getSpot = cache(async (slug: string): Promise<Spot | null> => {
  const supabase = supabaseServer();

  /* `spot_photos.source` arriva con 20260819_spot_photos_source.sql. Finché la
     migration non è applicata in produzione la colonna non esiste e Postgrest
     fa fallire l'intera query: riproviamo senza. Stesso pattern già usato in
     app/api/events/route.ts per il join opzionale su spots.
     I due select sono scritti per esteso perché il parser dei tipi di
     supabase-js legge la stringa letterale, non un template. */
  const withSource = await supabase
    .from('spots')
    .select('*, likes_count, spot_photos(id, url, position, credit_name, source, moderation_status)')
    .eq('slug', slug)
    .eq('status', 'approved')
    .single();

  let data = withSource.data as Record<string, unknown> | null;

  if (withSource.error) {
    const legacy = await supabase
      .from('spots')
      .select('*, likes_count, spot_photos(id, url, position, credit_name, moderation_status)')
      .eq('slug', slug)
      .eq('status', 'approved')
      .single();
    data = legacy.data as Record<string, unknown> | null;
  }
  if (!data) return null;

  /* Solo foto approvate. La lettura non si puo' lasciare alle policy: in
     schema.sql ne esiste una che apre tutte le foto di uno spot approvato
     senza guardare `moderation_status`, e le permissive in Postgres si
     sommano. Senza questo filtro una foto appena caricata sarebbe pubblica
     prima di essere moderata. Le righe piu' vecchie della moderazione hanno
     la colonna a NULL e restano visibili. */
  const photos = data.spot_photos as
    { position: number; moderation_status?: string | null }[] | undefined;
  if (photos) {
    data.spot_photos = photos
      .filter(p => p.moderation_status === 'approved' || p.moderation_status == null)
      .sort((a, b) => a.position - b.position);
  }
  return data as unknown as Spot;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // notFound() QUI (oltre che nel componente) contro il soft-404: serve la 404
  // page con noindex/nofollow invece di metadata inventati su slug inesistenti.
  // NOTA VERIFICATA: lo status resta 200 finché esiste
  // app/map/spot/[slug]/loading.tsx — il suo Suspense boundary fa flushare lo
  // shell prima che notFound() possa impostare il 404 (misurato su Next 14.2.35).
  const spot = await getSpot(params.slug);
  if (!spot) notFound();
  const tipo  = TIPI_SPOT[spot.type];
  const cover = spot.spot_photos?.[0]?.url;
  const city  = spot.city ?? 'Italia';
  const title = `${spot.name} — Spot ${tipo.label} a ${city}`;
  const desc  = spot.description
    ? `${spot.description} Spot ${tipo.label} a ${city}.`
    : `${spot.name} è uno spot ${tipo.label} a ${city}. Trova foto, condizione attuale e coordinate GPS su Chrispy Maps.`;
  const url   = `${APP_CONFIG.url}/map/spot/${spot.slug}`;
  return {
    title, description: desc,
    alternates: { canonical: url },
    keywords: [`spot BMX ${city}`, `${tipo.label} ${city}`, spot.name],
    openGraph: { title, description: desc, url, images: [{ url: cover ?? '/opengraph-image', width: 1200, height: 630 }], type: 'article' },
    twitter: { card: 'summary_large_image', title, description: desc, images: [cover ?? '/opengraph-image'] },
  };
}

export default async function SpotPage({ params, searchParams }: Props) {
  const spot = await getSpot(params.slug);
  if (!spot) notFound();

  const tipo   = TIPI_SPOT[spot.type];
  const cond   = CONDIZIONI[spot.condition];
  /* Il badge non dice più solo "alive": dice da quanto tempo nessuno lo conferma.
     Vedi lib/freshness.ts — la condizione da sola valeva 116 spot su 116. */
  const fresh  = getFreshness(spot.condition, spot.condition_updated_at);
  const photos = spot.spot_photos ?? [];
  /* Filtrati contro OSTACOLI: un valore sconosciuto nel database — per esempio
     rimasto da una versione futura o da un import — non deve far esplodere la
     pagina con OSTACOLI[o].emoji su undefined. */
  const ostacoli = ((spot.ostacoli ?? []) as Ostacolo[]).filter(o => OSTACOLI[o]);
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lon}`;

  const isYouTube = spot.youtube_url && /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(spot.youtube_url);
  const embedUrl = isYouTube
    ? spot.youtube_url!.replace(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/\s]+)/, 'https://www.youtube-nocookie.com/embed/$1?rel=0')
    : null;

  return (
    <main style={{
      background: 'var(--black)', minHeight: '100dvh',
      maxWidth: 680, margin: '0 auto',
      paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))',
    }}>

      {/* ── HEADER STICKY ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--gray-700)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link
          href={searchParams.from === 'jamroma' ? '/jamroma' : '/'}
          style={{ color: 'var(--gray-400)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: 13 }}
        >
          {searchParams.from === 'jamroma' ? '← Jam Roma' : '← Mappa'}
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Stato + freschezza — un solo segnale */}
          <span title={fresh.label} style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: fresh.color, background: `${fresh.color}18`,
            padding: '3px 8px', borderRadius: 10,
            border: `1px solid ${fresh.color}44`,
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            {cond.label.toUpperCase()}
            {fresh.days !== null && (
              <span style={{ opacity: 0.75 }}>· {fresh.short}</span>
            )}
          </span>
          {/* 🔥 Like + ❤️ Save — client component */}
          <SpotPageActions spotId={spot.id} initialLikes={spot.likes_count ?? 0} />
        </div>
      </div>

      {/* ── TITOLO + TIPO ── */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: tipo.color, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {tipo.emoji} {tipo.label}
        </div>
        {/* Cosa c'e' sullo spot. E' l'informazione che fa decidere se vale la
            pena prendere la bici — piu' della categoria, che dice solo dove sei. */}
        {ostacoli.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
            {ostacoli.map(o => (
              <span key={o} style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: 'var(--bone)', background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                padding: '3px 9px', borderRadius: 12,
              }}>
                {OSTACOLI[o].emoji} {OSTACOLI[o].label}
              </span>
            ))}
          </div>
        )}
        <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 28, color: 'var(--orange)', margin: '0 0 8px', lineHeight: 1.15 }}>
          {spot.name}
        </h1>
        {spot.city && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', marginBottom: 16 }}>
            📍 {spot.city}{spot.region ? `, ${spot.region}` : ''}
            {spot.difficulty && <span style={{ color: '#ffce4d', marginLeft: 8 }}>⚡ {spot.difficulty.toUpperCase()}</span>}
          </div>
        )}
      </div>

      {/* ── FOTO ── */}
      {photos.length > 0 && (
        <PhotoCarousel photos={photos.map(p => ({ url: p.url, credit_name: p.credit_name ?? undefined, source: p.source }))} />
      )}

      <div style={{ padding: '16px 20px 0' }}>

        {/* ── PUBLISHER — grande con avatar ── */}
        {spot.submitted_by_username && (
          <Link href={`/u/${spot.submitted_by_username}`} style={{
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', marginBottom: 16,
            background: 'var(--gray-800)', border: '1px solid var(--gray-700)', borderRadius: 10,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: 'var(--orange)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 18, color: '#000', fontWeight: 700, flexShrink: 0,
            }}>
              {spot.submitted_by_username[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--orange)', fontWeight: 700 }}>
                @{spot.submitted_by_username}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)', marginTop: 1 }}>
                ha pubblicato questo spot →
              </div>
            </div>
          </Link>
        )}

        {/* ── DESCRIZIONE ── */}
        {spot.description && (
          <p style={{ color: 'var(--bone)', lineHeight: 1.7, fontSize: 15, margin: '0 0 20px' }}>
            {spot.description}
          </p>
        )}

        {/* Meta info */}
        {(spot.surface || spot.guardians) && (
          <div style={{
            padding: '12px 14px', marginBottom: 16,
            background: 'var(--gray-800)', borderRadius: 8,
            border: '1px solid var(--gray-700)',
            fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', lineHeight: 1.6,
          }}>
            {spot.surface && <div>Superficie: <span style={{ color: 'var(--bone)' }}>{spot.surface}</span></div>}
            {spot.guardians && <div>⚠️ {spot.guardians}</div>}
          </div>
        )}

        {/* ── STELLE ── */}
        <SpotStarRating spotId={spot.id} />

        {/* ── PORTAMI QUI — grande, prominente ── */}
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px', borderRadius: 10, marginBottom: 16,
            background: 'var(--orange)', color: '#000',
            fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700,
            textDecoration: 'none', letterSpacing: '0.04em',
            boxShadow: '0 4px 20px rgba(255,106,0,0.3)',
          }}>
          📍 PORTAMI QUI
        </a>

        {/* ── CONDIVIDI ── */}
        <div style={{ marginBottom: 20 }}>
          <ShareSpotBtn spotName={spot.name} spotSlug={spot.slug} city={spot.city} />
        </div>

        {/* ── CONTRIBUISCI — discreto ── */}
        <SpotContributeCTA
          spotId={spot.id}
          spotName={spot.name}
          currentCondition={spot.condition}
          photoCount={photos.length}
          lastConfirmedAt={spot.condition_updated_at}
        />

        {/* ── AZIONI PROPRIETARIO (modifica/elimina) — visibile solo all'owner ── */}
        <SpotOwnerActions
          spotId={spot.id}
          ownerId={spot.submitted_by_user_id ?? null}
          name={spot.name}
          type={spot.type}
          description={spot.description ?? null}
          guardians={spot.guardians ?? null}
          difficulty={spot.difficulty ?? null}
        />

        {/* ── VIDEO ── */}
        {embedUrl && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 8 }}>
              <iframe src={embedUrl} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen title={`Video ${spot.name}`} loading="lazy" />
            </div>
          </div>
        )}
      </div>

      {/* ── COMMENTI ── */}
      <SpotInteractions spotId={spot.id} spotSlug={spot.slug} />

      <div style={{ textAlign: 'center', padding: '16px 20px 4px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-600)' }}>
        {fresh.label.toLowerCase()} · {new Date(spot.condition_updated_at).toLocaleDateString('it-IT')}
      </div>

      <SupportStrip />

      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd({
          '@context': 'https://schema.org', '@type': ['SportsActivityLocation', 'Place'],
          name: spot.name, description: spot.description ?? `Spot ${tipo.label} a ${spot.city ?? 'Italia'}`,
          url: `${APP_CONFIG.url}/map/spot/${spot.slug}`,
          geo: { '@type': 'GeoCoordinates', latitude: spot.lat, longitude: spot.lon },
          address: { '@type': 'PostalAddress', addressLocality: spot.city ?? '', addressCountry: 'IT' },
          image: photos.map(p => p.url),
        })}}
      />
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd({
          '@context': 'https://schema.org', '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Mappa', item: APP_CONFIG.url },
            ...(spot.city ? [{ '@type': 'ListItem', position: 2, name: spot.city, item: `${APP_CONFIG.url}/map/${spot.city.toLowerCase().replace(/\s+/g, '-')}` }] : []),
            { '@type': 'ListItem', position: spot.city ? 3 : 2, name: spot.name, item: `${APP_CONFIG.url}/map/spot/${spot.slug}` },
          ],
        })}}
      />

      <SpotPageShell />
    </main>
  );
}
