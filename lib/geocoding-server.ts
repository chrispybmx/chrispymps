/** Shared across forward and reverse geocoding. Fail closed if a distributed deployment lacks a global limiter. */
const cache = new Map<string, { expires: number; data: unknown }>();
let nextLocalRequest = 0;
export async function requestGeocoding(path: 'search' | 'reverse', params: URLSearchParams, local: boolean): Promise<unknown> {
  const key = path + '?' + params.toString();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (redisUrl && redisToken) {
    const response = await fetch(redisUrl, {
      method: 'POST', headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', 'chrispy:geocoding:slot', '1', 'NX', 'PX', 1100]),
      signal: AbortSignal.timeout(3000), cache: 'no-store',
    });
    const body = await response.json();
    if (!response.ok || body.error) throw new Error('unavailable');
    if (body.result !== 'OK') throw new Error('busy');
  } else if (process.env.GEOCODING_DATABASE_LIMITER_ENABLED === 'true') {
    const { supabaseAdmin } = await import('./supabase');
    const { data, error } = await supabaseAdmin().rpc('cm_claim_geocoding_slot');
    if (error || typeof data !== 'boolean') throw new Error('unavailable');
    if (!data) throw new Error('busy');
  } else {
    if (!local) throw new Error('unavailable');
    if (Date.now() < nextLocalRequest) throw new Error('busy');
    nextLocalRequest = Date.now() + 1100;
  }
  const base = process.env.GEOCODING_BASE_URL || 'https://nominatim.openstreetmap.org';
  const response = await fetch(`${base.replace(/\/$/, '')}/${key}`, {
    headers: { 'User-Agent': 'ChrispyMaps/1.0 (+https://maps.chrispybmx.com)', Accept: 'application/json' },
    signal: AbortSignal.timeout(8000), cache: 'no-store',
  });
  if (!response.ok) throw new Error('unavailable');
  const data = await response.json();
  if (cache.size >= 256) cache.delete(cache.keys().next().value!);
  cache.set(key, { data, expires: Date.now() + 24 * 60 * 60 * 1000 });
  return data;
}
