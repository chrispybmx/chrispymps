import SessionInviteLink from '@/components/SessionInviteLink';
import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase';
import { TIPI_SPOT, CONDIZIONI, APP_CONFIG } from '@/lib/constants';
import { safeJsonLd } from '@/lib/json-ld';
import { getFreshness } from '@/lib/freshness';
import { citySlug, CITY_SLUG_RE } from '@/lib/slugify';
import type { Spot, SpotCondition } from '@/lib/types';
import SpotInteractions from '@/components/SpotInteractions';
import PhotoCarousel from '@/components/PhotoCarousel';
import SupportStrip from '@/components/SupportStrip';
import ShareSpotBtn from '@/components/ShareSpotBtn';
import SpotContributeCTA from '@/components/SpotContributeCTA';
import SpotLikeBtn from '@/components/SpotLikeBtn';
import SpotPageActions, { SpotStarRating } from '@/components/SpotPageActions';
import SpotOwnerActions from '@/components/SpotOwnerActions';
import SpotPageShell from '@/app/map/spot/[slug]/SpotPageShell';
import MapIcon from '@/components/MapIcon';
import { getSiteLanguage } from '@/lib/language-server';
import { conditionText, formatSpotDate, type SpotStatusHistoryItem } from '@/lib/spot-trust';
import { BeforeYouRide, SpotStatusHistory } from '@/components/SpotTrustInfo';

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
    .select('*, likes_count, spot_photos(id, url, position, credit_name, source, created_at, moderation_status)')
    .eq('slug', slug)
    .eq('status', 'approved')
    .single();

  let data = withSource.data as Record<string, unknown> | null;

  if (withSource.error) {
    const legacy = await supabase
      .from('spots')
      .select('*, likes_count, spot_photos(id, url, position, credit_name, created_at, moderation_status)')
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


/** Public history only: never read auth user metadata or contact details. */
async function getSpotHistory(spotId: string): Promise<SpotStatusHistoryItem[]> {
  const sb = supabaseServer();
  const { data, error } = await sb.from('spot_status_updates')
    .select('id, user_id, condition, note, created_at')
    .eq('spot_id', spotId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(3);
  if (error || !data?.length) return [];
  const ids = [...new Set(data.map(row => row.user_id).filter((id): id is string => typeof id === 'string'))];
  const usernames = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await sb.from('profiles').select('id, username').in('id', ids);
    for (const profile of profiles ?? []) if (profile.username) usernames.set(profile.id, profile.username);
  }
  return data.filter(row => Object.hasOwn(CONDIZIONI, row.condition)).map(row => ({
    id: row.id, condition: row.condition as SpotCondition, note: row.note,
    created_at: row.created_at, username: usernames.get(row.user_id) ?? null,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // notFound() QUI (oltre che nel componente) contro il soft-404: serve la 404
  // page con noindex/nofollow invece di metadata inventati su slug inesistenti.
  // NOTA VERIFICATA: lo status resta 200 finché esiste
  // app/map/spot/[slug]/loading.tsx — il suo Suspense boundary fa flushare lo
  // shell prima che notFound() possa impostare il 404 (misurato su Next 14.2.35).
  const spot = await getSpot(params.slug);
  if (!spot) notFound();
  const language = getSiteLanguage();
  const text = (it: string, en: string) => language === 'en' ? en : it;
  const tipo  = TIPI_SPOT[spot.type];
  const cover = spot.spot_photos?.[0]?.url;
  const place = spot.city || spot.country || spot.country_code || '';
  const location = place ? text(` a ${place}`, ` in ${place}`) : '';
  const title = text(`${spot.name} · Spot ${tipo.label}${location}`, `${spot.name} · ${tipo.label} spot${location}`);
  const desc = spot.description || text(
    `${spot.name}, spot ${tipo.label}${location}. Foto, segnalazioni dei rider e indicazioni su Chrispy Maps.`,
    `${spot.name}, a ${tipo.label} spot${location}. Photos, rider reports and directions on Chrispy Maps.`,
  );
  const url   = `${APP_CONFIG.url}/map/spot/${spot.slug}`;
  return {
    title, description: desc,
    alternates: { canonical: url },
    keywords: [`BMX spot ${place}`.trim(), `${tipo.label} ${place}`.trim(), spot.name],
    openGraph: { title, description: desc, url, images: [{ url: cover ?? '/opengraph-image', width: 1200, height: 630 }], type: 'article' },
    twitter: { card: 'summary_large_image', title, description: desc, images: [cover ?? '/opengraph-image'] },
  };
}

export default async function SpotPage({ params, searchParams }: Props) {
  const spot = await getSpot(params.slug);
  if (!spot) notFound();

  const language = getSiteLanguage();
  const text = (it: string, en: string) => language === 'en' ? en : it;
  const history = await getSpotHistory(spot.id);
  const tipo   = TIPI_SPOT[spot.type];
  /* Il badge non dice più solo "alive": dice da quanto tempo nessuno lo conferma.
     Vedi lib/freshness.ts — la condizione da sola valeva 116 spot su 116. */
  const fresh  = getFreshness(spot.condition, spot.condition_updated_at, new Date(), language);
  const photos = spot.spot_photos ?? [];
  const cityPath = spot.city ? citySlug(spot.city) : '';
  const country = spot.country_code && /^[a-z]{2}$/i.test(spot.country_code)
    ? spot.country_code.toUpperCase() : spot.country || undefined;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lon}`;

  const isYouTube = spot.youtube_url && /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(spot.youtube_url);
  const embedUrl = isYouTube
    ? spot.youtube_url!.replace(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/\s]+)/, 'https://www.youtube-nocookie.com/embed/$1?rel=0')
    : null;

  return (
    <main className="cm-detail-page" style={{
      background: 'var(--black)', minHeight: '100dvh',
      maxWidth: 680, margin: '0 auto',
      paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))',
    }}>

      {/* ── HEADER STICKY ── */}
      <div className="cm-detail-header" style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'var(--black)',
        borderBottom: '1px solid var(--gray-700)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link
          href={searchParams.from === 'jamroma' ? '/jamroma' : '/'}
          style={{ color: 'var(--gray-400)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: 14 }}
        >
          {searchParams.from === 'jamroma' ? '← Jam Roma' : text('← Mappa', '← Map')}
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Stato + freschezza — un solo segnale */}
          <span className="cm-detail-condition" title={fresh.label} style={{
            fontFamily: 'var(--font-mono)', fontSize: 14,
            color: fresh.color, background: `${fresh.color}18`,
            padding: '3px 8px', borderRadius: 6,
            border: `1px solid ${fresh.color}44`,
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            <strong>{conditionText(spot.condition, language)}</strong>
            <span>{fresh.days !== null ? fresh.short : spot.condition === 'alive' ? text('Da confermare', 'Not confirmed') : formatSpotDate(spot.condition_updated_at, language)}</span>
          </span>
          {/* 🔥 Like + ❤️ Save — client component */}
          <SpotPageActions spotId={spot.id} initialLikes={spot.likes_count ?? 0} />
        </div>
      </div>

      <div className="cm-detail-layout">
        <div className="cm-detail-gallery">
      {/* ── FOTO ── */}
      {photos.length > 0 ? (
        <PhotoCarousel language={language} photos={photos.map(p => ({ url: p.url, credit_name: p.credit_name ?? undefined, source: p.source, created_at: p.created_at }))} />
      ) : <div className="cm-photo-empty"><MapIcon name="photo" size={32} /><p>{text('Nessuna foto disponibile', 'No photos available')}</p></div>}

        </div>
        <div className="cm-detail-content">
      {/* ── TITOLO + TIPO ── */}
      <div className="cm-detail-title" style={{ padding: '20px 20px 0' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: tipo.color, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          <MapIcon name={spot.type} size={18} /> {tipo.label}
        </div>
        <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 28, color: 'var(--orange)', margin: '0 0 8px', lineHeight: 1.15 }}>
          {spot.name}
        </h1>
        {spot.city && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)', marginBottom: 16 }}>
            {spot.city}{spot.region ? `, ${spot.region}` : ''}
          </div>
        )}
      </div>

      <div className="cm-detail-body" style={{ padding: '16px 20px 0' }}>

        {/* ── PUBLISHER — grande con avatar ── */}
        {spot.submitted_by_username && (
          <Link className="cm-detail-contributor" href={`/u/${spot.submitted_by_username}`} style={{
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', marginBottom: 16,
            background: 'var(--gray-800)', border: '1px solid var(--gray-700)', borderRadius: 6,
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
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-500)', marginTop: 1 }}>
                {text('ha pubblicato questo spot →', 'added this spot →')}
              </div>
            </div>
          </Link>
        )}

        {spot.submitted_by_user_id && spot.submitted_by_username && <SessionInviteLink recipient={spot.submitted_by_username} spotId={spot.id} />}

        {/* ── DESCRIZIONE ── */}
        {spot.description && (
          <p style={{ color: 'var(--bone)', lineHeight: 1.7, fontSize: 15, margin: '0 0 20px' }}>
            {spot.description}
          </p>
        )}

        <BeforeYouRide spot={spot} language={language} />

        {/* ── PORTAMI QUI — grande, prominente ── */}
        <a className="cm-directions" href={mapsUrl} target="_blank" rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px', borderRadius: 6, marginBottom: 16,
            background: 'var(--orange)', color: '#000',
            fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700,
            textDecoration: 'none', letterSpacing: '0.04em',
            boxShadow: 'none',
          }}>
          <MapIcon name="route" /> {text("Apri indicazioni", "Get directions")}
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
          streetViewCover={photos[0]?.source === 'streetview'}
          lastConfirmedAt={spot.condition_updated_at}
        />

        <SpotStatusHistory items={history} language={language} />

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

        <div className="cm-detail-ratings"><SpotStarRating spotId={spot.id} /></div>
        </div>
      </div>
      {/* ── COMMENTI ── */}
      <SpotInteractions spotId={spot.id} spotSlug={spot.slug} />

      <div style={{ textAlign: 'center', padding: '16px 20px 4px', fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-600)' }}>
        {fresh.label}{formatSpotDate(spot.condition_updated_at, language) ? ` · ${formatSpotDate(spot.condition_updated_at, language)}` : ''}
      </div>

      <SupportStrip />

      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd({
          '@context': 'https://schema.org', '@type': ['SportsActivityLocation', 'Place'],
          name: spot.name, description: spot.description ?? `${tipo.label}${spot.city ? ` · ${spot.city}` : ''}`,
          url: `${APP_CONFIG.url}/map/spot/${spot.slug}`,
          geo: { '@type': 'GeoCoordinates', latitude: spot.lat, longitude: spot.lon },
          address: { '@type': 'PostalAddress', addressLocality: spot.city ?? '', addressCountry: country },
          image: photos.map(p => p.url),
        })}}
      />
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd({
          '@context': 'https://schema.org', '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: text('Mappa', 'Map'), item: APP_CONFIG.url },
            ...(CITY_SLUG_RE.test(cityPath) ? [{ '@type': 'ListItem', position: 2, name: spot.city, item: `${APP_CONFIG.url}/map/${cityPath}` }] : []),
            { '@type': 'ListItem', position: CITY_SLUG_RE.test(cityPath) ? 3 : 2, name: spot.name, item: `${APP_CONFIG.url}/map/spot/${spot.slug}` },
          ],
        })}}
      />

      <SpotPageShell />
    </main>
  );
}
