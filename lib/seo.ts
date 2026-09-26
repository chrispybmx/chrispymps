import type { Metadata } from 'next';
import { APP_CONFIG, TIPI_SPOT } from './constants';
import type { Spot } from './types';

export const PRIVATE_ROBOTS: Metadata['robots'] = {
  index: false, follow: false, googleBot: { index: false, follow: false },
};

/** Omit unknown dates; never claim an update happened at crawl time. */
export function seoDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

export function spotStructuredData(spot: Spot) {
  const url = `${APP_CONFIG.url}/map/spot/${encodeURIComponent(spot.slug)}`;
  const country = spot.country_code && /^[a-z]{2}$/i.test(spot.country_code)
    ? spot.country_code.toUpperCase() : spot.country || undefined;
  const hasCoordinates = Number.isFinite(spot.lat) && Math.abs(spot.lat) <= 90 && Number.isFinite(spot.lon) && Math.abs(spot.lon) <= 180;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage', '@id': `${url}#webpage`, url, name: spot.name,
        isPartOf: { '@id': `${APP_CONFIG.url}/#website` },
        mainEntity: { '@id': `${url}#place` },
        datePublished: seoDate(spot.approved_at), dateModified: seoDate(spot.updated_at),
        ...(spot.submitted_by_username ? { author: {
          '@type': 'Person', name: `@${spot.submitted_by_username}`,
          url: `${APP_CONFIG.url}/u/${encodeURIComponent(spot.submitted_by_username)}`,
        } } : {}),
      },
      {
        '@type': 'Place', '@id': `${url}#place`, url, name: spot.name,
        description: spot.description || `${TIPI_SPOT[spot.type].label}${spot.city ? ` · ${spot.city}` : ''}`,
        ...(hasCoordinates ? { geo: { '@type': 'GeoCoordinates', latitude: spot.lat, longitude: spot.lon } } : {}),
        ...(spot.city || country ? { address: { '@type': 'PostalAddress', addressLocality: spot.city || undefined, addressCountry: country } } : {}),
        ...(spot.spot_photos?.length ? { image: spot.spot_photos.map(photo => photo.url) } : {}),
      },
    ] as const,
  };
}

export function cityCollectionData(city: string, url: string, spots: Pick<Spot, 'slug' | 'name'>[]) {
  return {
    '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': `${url}#webpage`,
    name: `Spot BMX e skate a ${city}`, url,
    description: `${spots.length} spot a ${city} pubblicati dalla community.`,
    isPartOf: { '@id': `${APP_CONFIG.url}/#website` },
    mainEntity: {
      '@type': 'ItemList', numberOfItems: spots.length,
      itemListElement: spots.map((spot, index) => ({
        '@type': 'ListItem', position: index + 1, name: spot.name,
        url: `${APP_CONFIG.url}/map/spot/${encodeURIComponent(spot.slug)}`,
      })),
    },
  };
}
