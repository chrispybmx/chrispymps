import type { MetadataRoute } from 'next';
import { supabaseServer } from '@/lib/supabase';
import { CITTA_ITALIANE, APP_CONFIG } from '@/lib/constants';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = APP_CONFIG.url;

  // Pagine statiche
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/map`,         lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${base}/map/support`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/map/about`,   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ];

  // Pagine città
  const cityPages: MetadataRoute.Sitemap = CITTA_ITALIANE.map((c) => ({
    url:             `${base}/map/${c.value}`,
    lastModified:    new Date(),
    changeFrequency: 'weekly' as const,
    priority:        0.8,
  }));

  // Pagine spot dinamiche
  const supabase = supabaseServer();
  const { data } = await supabase
    .from('spots')
    .select('slug, updated_at')
    .eq('status', 'approved')
    .order('updated_at', { ascending: false });

  const spotPages: MetadataRoute.Sitemap = (data ?? []).map((s) => ({
    url:             `${base}/map/spot/${s.slug}`,
    lastModified:    new Date(s.updated_at),
    changeFrequency: 'weekly' as const,
    priority:        0.7,
  }));

  return [...staticPages, ...cityPages, ...spotPages];
}
