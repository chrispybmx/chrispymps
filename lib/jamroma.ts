/**
 * Configurazione evento Jam Roma — Colle del Cemento V4
 */

export const JAM_ROMA = {
  slug: 'jamroma',
  title: 'Colle del Cemento V4',
  subtitle: 'BMX Street Jam',
  dateLabel: '6 giugno · ore 14',
  locationLabel: 'EUR Fermi · Roma',
  center: { lat: 41.8281, lon: 12.4716 },
  startsAt: '2026-06-06T14:00:00+02:00',
  endsAt: '2026-06-06T20:00:00+02:00',
  posterUrl: '/events/jamroma/poster.jpg',
  mapUrl: '/events/jamroma/map.jpg',
} as const;

export type JamState = 'before' | 'live' | 'after';

export function getJamState(now = new Date()): JamState {
  const start = new Date(JAM_ROMA.startsAt);
  const end = new Date(JAM_ROMA.endsAt);
  if (now < start) return 'before';
  if (now <= end) return 'live';
  return 'after';
}

/**
 * Spot ufficiali della jam — collegati al DB.
 */
export const JAM_SPOTS = [
  {
    spotId: 'c19fb4e4-e88c-4a97-b326-baf8fa422583',
    slug: 'eur-fermi-roma-c19fb4',
    label: 'EUR Fermi',
    lat: 41.82808,
    lon: 12.47158,
    meetingPoint: true,
    description: 'Punto di ritrovo — Meeting point della jam',
  },
  {
    spotId: 'e37f38cc-0c86-4b58-b890-07de02fbc94a',
    slug: 'ledge-museo-della-civilta-roma-e37f38',
    label: 'Ledge museo della civiltà',
    lat: 41.83289,
    lon: 12.47108,
    meetingPoint: false,
    description: 'Ledge lungo fronte museo',
  },
  {
    spotId: 'ccef63a2-1c0a-4143-b00e-98f70b405935',
    slug: 'wall-rossi-via-dell-architettura-roma-ccef63',
    label: 'Wall rossi Via dell\'architettura',
    lat: 41.83078,
    lon: 12.47642,
    meetingPoint: false,
    description: 'Wall con run-up',
  },
  {
    spotId: 'd047e557-55a2-446f-a2fe-6dc667ef5d38',
    slug: 'bank-burger-king-roma-d047e5',
    label: 'Bank Burger King',
    lat: 41.81686,
    lon: 12.45475,
    meetingPoint: false,
    description: 'Bank naturale',
  },
] as const;
