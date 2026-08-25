import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import type { SpotMapPin } from '@/lib/types';

/** Una foto e' pubblicabile se e' stata approvata (o e' precedente alla
 *  moderazione, quando la colonna era ancora NULL).
 *
 *  Il filtro sta qui e non nella query perche' non deve dipendere da quali
 *  policy RLS sono attive sul database: in `supabase/schema.sql` ne esiste
 *  una che apre in lettura tutte le foto di uno spot approvato senza
 *  guardare `moderation_status`, e le policy permissive in Postgres si
 *  sommano fra loro. Finche' quella non viene rimossa, filtrare qui e'
 *  l'unica garanzia che una foto in attesa non finisca sulla mappa. */
function pubblicabile(p: { moderation_status?: string | null }): boolean {
  return p.moderation_status === 'approved' || p.moderation_status == null;
}

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('spots')
    .select(`
      id, slug, name, type, lat, lon, city, condition, condition_updated_at, submitted_by_username, likes_count,
      spot_photos (url, position, source, moderation_status)
    `)
    .eq('status', 'approved')
    .order('approved_at', { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const pins: SpotMapPin[] = (data ?? []).map((s) => {
    const photos = (s.spot_photos ?? []) as {
      url: string; position: number;
      source?: 'rider' | 'streetview';
      moderation_status?: string | null;
    }[];
    const sorted = photos.filter(pubblicabile).sort((a, b) => a.position - b.position);
    return {
      id:        s.id,
      slug:      s.slug,
      name:      s.name,
      type:      s.type,
      lat:       s.lat,
      lon:       s.lon,
      city:      s.city,
      condition: s.condition,
      condition_updated_at: s.condition_updated_at ?? undefined,
      cover_url: sorted[0]?.url,
      /* Le foto erano gia' tutte caricate qui e venivano buttate tenendo solo
         la prima: la card espansa sulla mappa mostrava una foto sola anche
         quando lo spot ne aveva cinque, e carosello, frecce e lightbox non
         potevano attivarsi. Il costo della query lo pagavamo comunque. */
      photo_urls: sorted.map(p => p.url),
      photo_sources: sorted.map(p => p.source ?? null),
      cover_source: sorted[0]?.source,
      submitted_by_username: s.submitted_by_username ?? undefined,
      likes_count: s.likes_count ?? 0,
    };
  });

  return NextResponse.json({ ok: true, data: pins }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
