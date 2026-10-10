import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getDiscoverPage } from '@/lib/discover-server';
import { parseDiscoverFilters, discoverSearchParams } from './discover';
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

export async function generateMetadata(
  props: { searchParams: Promise<Record<string, string | string[] | undefined>> }
): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const filtered = ['q', 'type', 'country', 'region', 'obstacle', 'difficulty', 'condition', 'sort'].some(key => Boolean(searchParams[key]));
  return { ...baseMetadata, ...(filtered ? { robots: { index: false, follow: true } } : {}) };
}

export const revalidate = 300;

export default async function ScopriPage(
  props: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  const searchParams = await props.searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) if (typeof value === 'string') params.set(key, value);
  const filters = parseDiscoverFilters(params);
  let result;
  try { result = { ...(await getDiscoverPage(filters)), loadError: false }; }
  catch { result = { spots: [], total: 0, nextOffset: null, countries: [], loadError: true }; }
  return <Suspense fallback={<ScopriLoading />}><ScopriClient {...result} initialKey={discoverSearchParams(filters)} /></Suspense>;
}
