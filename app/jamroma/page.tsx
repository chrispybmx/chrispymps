import type { Metadata } from 'next';
import { JAM_ROMA } from '@/lib/jamroma';
import { safeJsonLd } from '@/lib/json-ld';
import JamRomaClient from './JamRomaClient';

export const metadata: Metadata = {
  title: `${JAM_ROMA.title} — ${JAM_ROMA.subtitle} | Chrispy Maps`,
  description: `${JAM_ROMA.title}: ${JAM_ROMA.subtitle}. ${JAM_ROMA.dateLabel}, ${JAM_ROMA.locationLabel}. Mappa live, spot e partecipanti.`,
  alternates: { canonical: 'https://maps.chrispybmx.com/jamroma' },
  openGraph: {
    title: `${JAM_ROMA.title} — ${JAM_ROMA.subtitle}`,
    description: `${JAM_ROMA.dateLabel} · ${JAM_ROMA.locationLabel}`,
    images: [{ url: JAM_ROMA.posterUrl, width: 800, height: 1000 }],
    type: 'website',
    url: 'https://maps.chrispybmx.com/jamroma',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${JAM_ROMA.title} — ${JAM_ROMA.subtitle}`,
    description: `${JAM_ROMA.dateLabel} · ${JAM_ROMA.locationLabel}`,
    images: [JAM_ROMA.posterUrl],
  },
};

const eventJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SportsEvent',
  name: JAM_ROMA.title,
  description: `${JAM_ROMA.subtitle} — BMX Street Jam a EUR Fermi, Roma. Mappa live con spot e rider.`,
  startDate: JAM_ROMA.startsAt,
  endDate: JAM_ROMA.endsAt,
  eventStatus: 'https://schema.org/EventScheduled',
  eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  location: {
    '@type': 'Place',
    name: 'EUR Fermi',
    address: { '@type': 'PostalAddress', addressLocality: 'Roma', addressCountry: 'IT' },
    geo: { '@type': 'GeoCoordinates', latitude: JAM_ROMA.center.lat, longitude: JAM_ROMA.center.lon },
  },
  image: `https://maps.chrispybmx.com${JAM_ROMA.posterUrl}`,
  organizer: {
    '@type': 'Person',
    name: 'Chrispy BMX',
    url: 'https://maps.chrispybmx.com',
  },
  sport: 'BMX Freestyle',
  url: 'https://maps.chrispybmx.com/jamroma',
  isAccessibleForFree: true,
};

export default function JamRomaPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(eventJsonLd) }}
      />
      <JamRomaClient />
    </>
  );
}
