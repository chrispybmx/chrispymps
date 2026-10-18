import type { Metadata } from 'next';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase';
import { sharedSpotIds } from '@/lib/shared-spots';
import { discoverCover, type DiscoverPhoto } from '@/app/scopri/discover';
import { miniatura } from '@/lib/immagini';
import MapIcon from '@/components/MapIcon';
import styles from '@/app/preferiti/favorites.module.css';
export const metadata: Metadata = { title: 'Spot da girare', description: 'Una selezione di spot condivisa su Chrispy Maps.', robots: { index: false, follow: true } };
export default async function SharedSpots({ searchParams }: { searchParams: { spots?: string } }) {
  const ids = sharedSpotIds(typeof searchParams.spots === 'string' ? searchParams.spots : null);
  let failed = false;
  let rows: { id: string; slug: string; name: string; city: string | null; spot_photos: DiscoverPhoto[] }[] = [];
  if (ids.length) {
    try {
      const { data, error } = await supabaseServer().from('spots').select('id,slug,name,city,spot_photos(url,position,source,moderation_status)')
        .eq('status','approved').in('id',ids)
        .or('moderation_status.eq.approved,moderation_status.is.null', {referencedTable:'spot_photos'})
        .order('position',{referencedTable:'spot_photos',ascending:true}).limit(1,{referencedTable:'spot_photos'});
      if (error) throw new Error(); rows = (data ?? []) as typeof rows;
      rows.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id));
    } catch { failed = true; }
  }
  return <main className={styles.page}><header className={styles.header}><Link className={styles.back} href="/">← Mappa</Link><Link href="/preferiti">I tuoi salvati</Link></header><div className={styles.content}><h1>Spot da girare</h1><p className={styles.intro}>Una selezione condivisa. Apri uno spot per vedere foto, caratteristiche e indicazioni.</p>{failed ? <p role="alert">Non riesco a caricare gli spot. Ricarica la pagina per riprovare.</p> : !rows.length ? <p>Questa selezione è vuota, non valida o non contiene più spot disponibili.</p> : <div className={styles.list}>{rows.map(spot => {const photo=discoverCover(spot.spot_photos);return <article className={styles.spot} key={spot.id}><Link href={`/map/spot/${encodeURIComponent(spot.slug)}`} className={styles.spotLink}><div className={styles.photo}>{photo ? <img src={miniatura(photo.url,480)} alt="" loading="lazy" /> : <MapIcon name="photo" />}</div><div className={styles.info}><h2>{spot.name}</h2>{spot.city && <p>{spot.city}</p>}{photo?.source === 'streetview' && <p>Immagine Street View</p>}<span className={styles.open}>Apri spot →</span></div></Link></article>;})}</div>}{!failed && rows.length > 0 && rows.length < ids.length && <p>Alcuni spot della selezione non sono più disponibili.</p>}</div></main>;
}
