import { z } from 'zod';
import { TIPI_SPOT, OSTACOLI, CONDIZIONI } from './constants';
import type { SpotType, Ostacolo, SpotCondition } from './types';

export const EXPLORE_STATE_KEY = 'cmaps_explore_v1';
export const mapViewSchema = z.object({ lat: z.number().min(-85).max(85), lon: z.number().min(-180).max(180), zoom: z.number().min(3).max(19) });
export type MapView = z.infer<typeof mapViewSchema>;
const boundsSchema = z.object({ south:z.number(), west:z.number(), north:z.number(), east:z.number() });
const schema = z.object({
  version: z.literal(1), savedAt:z.number(),
  search:z.string().max(500),
  type:z.enum(Object.keys(TIPI_SPOT) as [SpotType, ...SpotType[]]).nullable(),
  region:z.string().nullable(), condition:z.enum(Object.keys(CONDIZIONI) as [SpotCondition, ...SpotCondition[]]).nullable(),
  difficulty:z.enum(['beginner','intermediate','pro']).nullable(),
  obstacle:z.enum(Object.keys(OSTACOLI) as [Ostacolo, ...Ostacolo[]]).nullable(),
  selected:z.string().nullable(), expanded:z.string().nullable(),
  view:mapViewSchema.nullable(), returnView:mapViewSchema.nullable(), returnBounds:boundsSchema.nullable(),
  panelHeight:z.number().min(64).max(3000), scrollTop:z.number().min(0), returnScroll:z.number().min(0), seed:z.number(),
  radiusMode:z.boolean(), radiusCenter:z.object({lat:z.number().min(-85).max(85),lon:z.number().min(-180).max(180)}).nullable(),
  radiusKm:z.number().positive().max(1000), radiusPanelOpen:z.boolean(),
});
export type ExploreState = z.infer<typeof schema>;
export function parseExploreState(raw: string | null, now = Date.now()): ExploreState | null {
  if (!raw) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success || now - parsed.data.savedAt > 2 * 60 * 60 * 1000 || parsed.data.savedAt > now) return null;
    return parsed.data;
  } catch { return null; }
}
