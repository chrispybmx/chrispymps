import type { Metadata } from 'next';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase';
import { discoverCover, type DiscoverPhoto, type DiscoverSpot } from './discover';
import ScopriClient from './ScopriClient';
import ScopriLoading from './loading';

const baseMetadata: Metadata = {
  title: 'Scopri spot BMX, skate e scooter',
  description: 'Trova spot della community con fotografie, località e caratteristiche. Cerca un posto o un rider e salva gli spot per la prossima uscita.',
  alternates: { canonical: 'https://maps.chrispybmx.com/scopri' },
  openGraph: {
    title: 'Scopri spot — Chrispy Maps',
    description: 'Fotografie e informazioni condivise dai rider. Cerca spot per luogo, categoria e ostacoli.',
    url: 'https://maps.chrispybmx.com/scopri', siteName: 'Chrispy Maps', locale: 'it_IT', type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', site: '@chrispy_bmx', title: 'Scopri spot — Chrispy Maps' },
};

export function generateMetadata({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }): Metadata {
  const filtered = ['q', 'type', 'country', 'region', 'obstacle', 'difficulty', 'condition', 'sort'].some(key => Boolean(searchParams[key]));
  return { ...baseMetadata, ...(filtered ? { robots: { index: false, follow: true } } : {}) };
}

export const revalidate = 300;

async function getSpots(): Promise<{ spots: DiscoverSpot[]; loadError: boolean }> {
  try {
    const supabase = supabaseServer();
    const result = await supabase.from('spots')
      .select('id, slug, name, type, lat, lon, city, region, country, country_code, condition, condition_updated_at, difficulty, ostacoli, submitted_by_username, likes_count, approved_at, created_at, spot_photos(url, position, source, moderation_status)')
      .eq('status', 'approved').order('approved_at', { ascending: false, nullsFirst: false }).order('id');
    let data = result.data as unknown as Record<string, unknown>[] | null;
    let error = result.error;
    if (error && /ostacoli/i.test(error.message)) {
      const fallback = await supabase.from('spots')
        .select('id, slug, name, type, lat, lon, city, region, country, country_code, condition, condition_updated_at, difficulty, submitted_by_username, likes_count, approved_at, created_at, spot_photos(url, position, source, moderation_status)')
        .eq('status', 'approved').order('approved_at', { ascending: false, nullsFirst: false }).order('id');
      data = fallback.data as unknown as Record<string, unknown>[] | null; error = fallback.error;
    }
    if (error) return { spots: [], loadError: true };
    const spots = (data ?? []).map(row => {
      const cover = discoverCover(row.spot_photos as DiscoverPhoto[] | null);
      const { spot_photos: _photos, ...spot } = row;
      return { ...spot, cover_url: cover?.url, cover_source: cover?.source ?? undefined } as unknown as DiscoverSpot;
    });
    return { spots, loadError: false };
  } catch { return { spots: [], loadError: true }; }
}

export default async function ScopriPage() {
  const result = await getSpots();
  return <Suspense fallback={<ScopriLoading />}><ScopriClient {...result} /></Suspense>;
}
