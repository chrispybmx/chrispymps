import type { MetadataRoute } from 'next';
import { supabaseServer } from '@/lib/supabase';
import { CITTA_ITALIANE, APP_CONFIG } from '@/lib/constants';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = APP_CONFIG.url;

  // Pagine statiche principali
  // NOTA: la home è "/" (rewrite interno → /map), NON "/map" (che ora ridireziona a "/")
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}`,             lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${base}/events`,      lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/news`,        lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/map/about`,   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/map/support`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ];

  // Pagine città — alta priorità per SEO locale
  const cityPages: MetadataRoute.Sitemap = CITTA_ITALIANE.map((c) => ({
    url:             `${base}/map/${c.value}`,
    lastModified:    new Date(),
    changeFrequency: 'weekly' as const,
    priority:        0.85,
  }));

  const supabase = supabaseServer();

  // Pagine spot dinamiche
  const { data: spots } = await supabase
    .from('spots')
    .select('slug, updated_at')
    .eq('status', 'approved')
    .order('updated_at', { ascending: false });

  const spotPages: MetadataRoute.Sitemap = (spots ?? []).map((s) => ({
    url:             `${base}/map/spot/${s.slug}`,
    lastModified:    new Date(s.updated_at),
    changeFrequency: 'weekly' as const,
    priority:        0.75,
  }));

  // Pagine news dinamiche
  const { data: newsItems } = await supabase
    .from('news')
    .select('slug, updated_at, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  const newsPages: MetadataRoute.Sitemap = (newsItems ?? []).map((n) => ({
    url:             `${base}/news/${n.slug}`,
    lastModified:    new Date(n.updated_at ?? n.published_at),
    changeFrequency: 'monthly' as const,
    priority:        0.65,
  }));

  return [...staticPages, ...cityPages, ...spotPages, ...newsPages];
}
