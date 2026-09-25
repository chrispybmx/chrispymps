import type { Ostacolo, SpotCondition, SpotMapPin, SpotType } from '@/lib/types';
import { DIFFICOLTA, OSTACOLI, REGIONI_ITALIA, TIPI_SPOT } from '@/lib/constants';

export interface DiscoverSpot extends SpotMapPin {
  country?: string; country_code?: string; region?: string; approved_at?: string; created_at?: string;
}
export interface DiscoverFilters {
  query: string; type: SpotType | ''; difficulty: string; country: string; region: string;
  obstacle: Ostacolo | ''; condition: SpotCondition | ''; sort: 'newest' | 'name';
}
export const DISCOVER_PAGE_SIZE = 24;
export const EMPTY_DISCOVER_FILTERS: DiscoverFilters = { query: '', type: '', difficulty: '', country: '', region: '', obstacle: '', condition: '', sort: 'newest' };
export function normalizeDiscover(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim(); }
export function countryKey(spot: Pick<DiscoverSpot, 'country' | 'country_code'>): string {
  const code = spot.country_code?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) ? `code:${code}` : spot.country?.trim() ? `name:${normalizeDiscover(spot.country)}` : '';
}
export function countryLabel(spot: Pick<DiscoverSpot, 'country' | 'country_code'>, language: 'it' | 'en' = 'it'): string {
  const key = countryKey(spot);
  if (key.startsWith('code:')) {
    try { return new Intl.DisplayNames([language], { type: 'region' }).of(key.slice(5)) ?? spot.country ?? key.slice(5); } catch { return spot.country ?? key.slice(5); }
  }
  return spot.country?.trim() ?? '';
}
export function discoverCountries(spots: DiscoverSpot[], language: 'it' | 'en' = 'it') {
  const choices = new Map<string, string>();
  for (const spot of spots) { const key = countryKey(spot); if (key) choices.set(key, countryLabel(spot, language)); }
  return [...choices].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, language));
}
export function filterDiscoverSpots(spots: DiscoverSpot[], filters: DiscoverFilters): DiscoverSpot[] {
  const query = normalizeDiscover(filters.query);
  const region = REGIONI_ITALIA.find(item => item.label === filters.region);
  return spots.filter(spot => {
    if (filters.type && spot.type !== filters.type) return false;
    if (filters.difficulty && spot.difficulty !== filters.difficulty) return false;
    if (filters.country && countryKey(spot) !== filters.country) return false;
    if (filters.condition && spot.condition !== filters.condition) return false;
    if (filters.obstacle && !spot.ostacoli?.includes(filters.obstacle) && spot.type !== filters.obstacle) return false;
    if (region) {
      const [south, west, north, east] = region.bbox;
      if (spot.lat < south || spot.lat > north || spot.lon < west || spot.lon > east) return false;
      // Bounds remain a fallback for old Italian records, never for a known foreign country.
      const country = countryKey(spot);
      if (country && country !== 'code:IT' && country !== 'name:italia' && country !== 'name:italy') return false;
    }
    if (!query) return true;
    if (query.startsWith('@')) return normalizeDiscover(spot.submitted_by_username ?? '').includes(query.slice(1));
    return normalizeDiscover([spot.name, spot.city, spot.country, spot.region, spot.submitted_by_username].filter(Boolean).join(' ')).includes(query);
  }).sort((a, b) => {
    if (filters.sort === 'newest') {
      const dateA = Date.parse(a.approved_at ?? a.created_at ?? '') || 0;
      const dateB = Date.parse(b.approved_at ?? b.created_at ?? '') || 0;
      if (dateA !== dateB) return dateB - dateA;
    }
    return a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }) || a.id.localeCompare(b.id);
  });
}
export function parseDiscoverFilters(params: Pick<URLSearchParams, 'get'>): DiscoverFilters {
  const type = params.get('type') ?? '';
  const obstacle = params.get('obstacle') ?? '';
  const condition = params.get('condition') ?? '';
  const difficulty = params.get('difficulty') ?? '';
  const region = params.get('region') ?? '';
  return {
    query: (params.get('q') ?? '').slice(0, 200), type: Object.hasOwn(TIPI_SPOT, type) ? type as SpotType : '',
    difficulty: DIFFICOLTA.some(item => item.value === difficulty) ? difficulty : '',
    country: (params.get('country') ?? '').slice(0, 100), region: REGIONI_ITALIA.some(item => item.label === region) ? region : '',
    obstacle: Object.hasOwn(OSTACOLI, obstacle) ? obstacle as Ostacolo : '', condition: ['alive', 'bustato', 'demolito'].includes(condition) ? condition as SpotCondition : '',
    sort: params.get('sort') === 'name' ? 'name' : 'newest',
  };
}
export function discoverSearchParams(filters: DiscoverFilters): string {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set('q', filters.query.trim());
  for (const key of ['type', 'difficulty', 'country', 'region', 'obstacle', 'condition'] as const) if (filters[key]) params.set(key, filters[key]);
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  return params.toString();
}

export interface DiscoverPhoto { url: string; position: number; source?: 'rider' | 'streetview' | null; moderation_status?: string | null }
/** Fail closed if moderation was not selected. Legacy NULL remains public, as in the spot API. */
export function discoverCover(photos: DiscoverPhoto[] | null | undefined): DiscoverPhoto | undefined {
  return (photos ?? []).filter(photo => (photo.moderation_status === 'approved' || photo.moderation_status === null) && typeof photo.url === 'string' && photo.url.trim()).sort((a, b) => a.position - b.position)[0];
}
