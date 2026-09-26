import type { MetadataRoute } from 'next';
import { supabaseServer } from '@/lib/supabase';
import { APP_CONFIG } from '@/lib/constants';
import { citySlug, CITY_SLUG_RE } from '@/lib/slugify';
import { seoDate } from '@/lib/seo';

export const revalidate = 3600;
const PAGE_SIZE = 1000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = APP_CONFIG.url;
  // Personal pages and short-lived live sessions have no search destination.
  // Static routes deliberately omit lastModified: request time is not an edit.
  const paths = ['', '/scopri', '/classifica', '/events', '/news', '/newsletter', '/cerca-spot', '/skate-maps', '/map/about', '/map/support', '/regole', '/privacy'];
  const pages: MetadataRoute.Sitemap = paths.map(path => ({ url: base + path }));
  const cities = new Map<string, string | undefined>();
  const sb = supabaseServer();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await sb.from('spots').select('slug, city, updated_at')
      .eq('status', 'approved').order('id').range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error('Cannot generate sitemap: spot query failed');
    for (const spot of data ?? []) {
      const modified = seoDate(spot.updated_at);
      if (spot.slug) pages.push({ url: `${base}/map/spot/${encodeURIComponent(spot.slug)}`, ...(modified ? { lastModified: modified } : {}) });
      if (spot.city) {
        const slug = citySlug(spot.city);
        if (CITY_SLUG_RE.test(slug) && !['spot', 'about', 'support'].includes(slug)) {
          const previous = cities.get(slug);
          cities.set(slug, modified && (!previous || modified > previous) ? modified : previous);
        }
      }
    }
    if (!data || data.length < PAGE_SIZE) break;
  }
  for (const [slug, lastModified] of cities) pages.push({ url: `${base}/map/${slug}`, ...(lastModified ? { lastModified } : {}) });
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await sb.from('news').select('slug, updated_at, published_at')
      .eq('status', 'published').order('id').range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error('Cannot generate sitemap: news query failed');
    for (const article of data ?? []) {
      const modified = seoDate(article.updated_at) ?? seoDate(article.published_at);
      if (article.slug) pages.push({ url: `${base}/news/${encodeURIComponent(article.slug)}`, ...(modified ? { lastModified: modified } : {}) });
    }
    if (!data || data.length < PAGE_SIZE) break;
  }
  return [...new Map(pages.map(page => [page.url, page])).values()];
}
