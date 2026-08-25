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

  /* `ostacoli` arriva con 20260824_ostacoli.sql. Finche' la migration non e'
     stata eseguita la colonna non esiste, e Postgrest non ignora il campo
     mancante: fa fallire l'INTERA query. Senza questo ripiego, pubblicare il
     codice prima della migration lascerebbe la mappa completamente vuota —
     verificato in locale, "column spots.ostacoli does not exist" e zero spot.
     I due select sono scritti per esteso perche' il parser dei tipi di
     supabase-js legge la stringa letterale, non un template. */
  const conOstacoli = await supabase
    .from('spots')
    .select('id, slug, name, type, ostacoli, lat, lon, city, condition, condition_updated_at, submitted_by_username, likes_count, spot_photos (url, position, source, moderation_status)')
    .eq('status', 'approved')
    .order('approved_at', { ascending: false });

  let data = conOstacoli.data as Record<string, unknown>[] | null;
  let error = conOstacoli.error;

  if (error) {
    const senzaOstacoli = await supabase
      .from('spots')
      .select('id, slug, name, type, lat, lon, city, condition, condition_updated_at, submitted_by_username, likes_count, spot_photos (url, position, source, moderation_status)')
      .eq('status', 'approved')
      .order('approved_at', { ascending: false });
    data  = senzaOstacoli.data as Record<string, unknown>[] | null;
    error = senzaOstacoli.error;
  }

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const pins: SpotMapPin[] = (data ?? []).map((s) => {
    const photos = (s.spot_photos ?? []) as unknown as {
      url: string; position: number;
      source?: 'rider' | 'streetview';
      moderation_status?: string | null;
    }[];
    const sorted = photos.filter(pubblicabile).sort((a, b) => a.position - b.position);
    return {
      id:        s.id as string,
      slug:      s.slug as string,
      name:      s.name as string,
      type:      s.type as SpotMapPin['type'],
      lat:       s.lat as number,
      lon:       s.lon as number,
      city:      s.city as string | undefined,
      condition: s.condition as SpotMapPin['condition'],
      ostacoli:  (s.ostacoli ?? []) as SpotMapPin['ostacoli'],
      condition_updated_at: (s.condition_updated_at as string) ?? undefined,
      cover_url: sorted[0]?.url,
      /* Le foto erano gia' tutte caricate qui e venivano buttate tenendo solo
         la prima: la card espansa sulla mappa mostrava una foto sola anche
         quando lo spot ne aveva cinque, e carosello, frecce e lightbox non
         potevano attivarsi. Il costo della query lo pagavamo comunque. */
      photo_urls: sorted.map(p => p.url),
      photo_sources: sorted.map(p => p.source ?? null),
      cover_source: sorted[0]?.source,
      submitted_by_username: (s.submitted_by_username as string) ?? undefined,
      likes_count: (s.likes_count as number) ?? 0,
    };
  });

  return NextResponse.json({ ok: true, data: pins }, {
    /* 60 secondi, non 300. L'elenco degli spot non e' un asset statico: e' la
       notizia. Con cinque minuti uno spot appena approvato restava invisibile
       per cinque minuti — successo davvero con "Thermal forum" di Natanael, il
       25/08. `stale-while-revalidate` tiene comunque la risposta immediata:
       serve la copia vecchia mentre aggiorna in sottofondo, quindi il costo
       della soglia piu' bassa e' un rinfresco piu' frequente, non una attesa. */
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
