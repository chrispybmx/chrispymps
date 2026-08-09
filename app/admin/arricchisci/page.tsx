import { redirect } from 'next/navigation';
import { isAdminAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import ArricchisciClient, { type SpotRow } from './ArricchisciClient';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

/**
 * Strumento admin per riempire i due buchi di contenuto che pesano sulla SEO:
 *  - descrizione mancante (al 2026-08: 65 spot su 109 senza, 35 sotto gli 80
 *    caratteri) -> le pagine spot/citta restano sottili e non si posizionano
 *  - youtube_url mai usato (0 su 109) anche se la pagina spot incorpora gia il
 *    player: collegare i video arricchisce la pagina e porta traffico dal canale
 *
 * Ordinamento pensato per lavorare in serie: prima quelli piu incompleti.
 */
async function getSpots(): Promise<SpotRow[]> {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from('spots')
    .select('id, slug, name, city, type, description, youtube_url, spot_photos(url, position)')
    .eq('status', 'approved')
    .order('city', { ascending: true });

  return (data ?? []).map((s: any) => ({
    id:          s.id,
    slug:        s.slug,
    name:        s.name,
    city:        s.city ?? null,
    type:        s.type,
    description: s.description ?? '',
    youtube_url: s.youtube_url ?? '',
    cover:       (s.spot_photos ?? []).sort((a: any, b: any) => a.position - b.position)[0]?.url ?? null,
  }));
}

export default async function ArricchisciPage() {
  if (!isAdminAuthenticated()) redirect('/admin/login');
  const spots = await getSpots();
  return <ArricchisciClient initialSpots={spots} />;
}
