import { UUID_RE } from './validation';
export interface SpotBounds { south: number; west: number; north: number; east: number }
export function readSpotQuery(params: URLSearchParams) {
  const rawBounds = params.get('bbox');
  let bounds: SpotBounds | null = null;
  if (rawBounds !== null) {
    const parts = rawBounds.split(',');
    const [west,south,east,north] = parts.map(Number);
    if (parts.length !== 4 || parts.some(p => !p.trim()) || ![west,south,east,north].every(Number.isFinite) || Math.abs(west)>180 || Math.abs(east)>180 || Math.abs(south)>90 || Math.abs(north)>90 || south>north) throw new Error('Invalid bounds');
    bounds = {west,south,east,north};
  }
  const rawIds = params.get('ids');
  const ids = rawIds === null ? null : [...new Set(rawIds.split(','))];
  if (ids && (!ids.length || ids.length>100 || ids.some(id=>!UUID_RE.test(id)))) throw new Error('Invalid ids');
  const view = params.get('view');
  if (view !== null && view !== 'cover') throw new Error('Invalid view');
  const offset = Number(params.get('offset') ?? 0);
  if (!Number.isSafeInteger(offset) || offset<0 || offset>100000) throw new Error('Invalid offset');
  return { bounds, ids, coverOnly: view === 'cover', offset };
}
export function pointInBounds(point: {lat:number;lon:number}, bounds: SpotBounds) {
  const longitude = ((point.lon+180)%360+360)%360-180;
  return point.lat>=bounds.south && point.lat<=bounds.north && (bounds.west<=bounds.east ? longitude>=bounds.west&&longitude<=bounds.east : longitude>=bounds.west||longitude<=bounds.east);
}
export function normalizeMapBounds(bounds: SpotBounds): SpotBounds {
  const longitude = (value:number) => ((value+180)%360+360)%360-180;
  return {...bounds, west:bounds.east-bounds.west>=360?-180:longitude(bounds.west),east:bounds.east-bounds.west>=360?180:longitude(bounds.east)};
}
