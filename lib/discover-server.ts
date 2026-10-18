import { unstable_cache } from 'next/cache';
import { supabasePublic } from './supabase';
import { countryKey, discoverCover, filterDiscoverSpots, DISCOVER_PAGE_SIZE, type DiscoverFilters, type DiscoverPhoto, type DiscoverSpot } from '@/app/scopri/discover';
/** Reuse a compact cached catalog for accent-insensitive search and legacy region semantics.
 * Only the requested page's approved cover photos leave the database. Spatial/full-text SQL can replace this index as the catalog grows. */
const catalog = unstable_cache(async (): Promise<DiscoverSpot[]> => {
  const sb = supabasePublic(); const rows: DiscoverSpot[] = []; let obstacles = true;
  for (let offset = 0; ; offset += 1000) {
    const query = () => sb.from('spots').select(obstacles
      ? 'id,slug,name,type,lat,lon,city,region,country,country_code,condition,condition_updated_at,difficulty,ostacoli,submitted_by_username,likes_count,approved_at,created_at'
      : 'id,slug,name,type,lat,lon,city,region,country,country_code,condition,condition_updated_at,difficulty,submitted_by_username,likes_count,approved_at,created_at')
      .eq('status', 'approved').order('id').range(offset, offset + 999);
    let result = await query();
    if (result.error && ['42703','PGRST204'].includes(result.error.code) && result.error.message.includes('ostacoli')) { obstacles = false; result = await query(); }
    if (result.error) throw new Error('catalog');
    rows.push(...(result.data ?? []) as unknown as DiscoverSpot[]);
    if ((result.data?.length ?? 0) < 1000) return rows;
  }
}, ['discover-compact-index-v1'], { revalidate: 60 });
export interface DiscoverPage {
  spots: DiscoverSpot[]; total: number; nextOffset: number | null;
  countries: Pick<DiscoverSpot, 'country' | 'country_code'>[];
}
export async function getDiscoverPage(filters: DiscoverFilters, offset = 0): Promise<DiscoverPage> {
  const index = await catalog();
  const filtered = filterDiscoverSpots(index, filters);
  const page = filtered.slice(offset, offset + DISCOVER_PAGE_SIZE);
  let spots = page;
  if (page.length) {
    const { data, error } = await supabasePublic().from('spots')
      .select('id,spot_photos(url,position,source,moderation_status)')
      .eq('status', 'approved').in('id', page.map(spot => spot.id))
      .or('moderation_status.eq.approved,moderation_status.is.null', { referencedTable: 'spot_photos' })
      .order('position', { referencedTable: 'spot_photos', ascending: true }).limit(1, { referencedTable: 'spot_photos' });
    if (error) throw new Error('covers');
    const covers = new Map((data ?? []).map(row => [row.id, discoverCover(row.spot_photos as DiscoverPhoto[])]));
    spots = page.filter(spot => covers.has(spot.id)).map(spot => ({ ...spot, cover_url: covers.get(spot.id)?.url, cover_source: covers.get(spot.id)?.source ?? undefined }));
  }
  const countries = new Map<string, Pick<DiscoverSpot, 'country' | 'country_code'>>();
  for (const spot of index) if (countryKey(spot)) countries.set(countryKey(spot), { country: spot.country, country_code: spot.country_code });
  return { spots, total: filtered.length, nextOffset: offset + DISCOVER_PAGE_SIZE < filtered.length ? offset + DISCOVER_PAGE_SIZE : null, countries: [...countries.values()] };
}
