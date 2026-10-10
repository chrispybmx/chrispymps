import type { Metadata } from 'next';
import Link from 'next/link';
import { RiderHistory } from '@/components/RiderSessions';

export const metadata: Metadata = {
  title: 'Le tue sessioni',
  description: 'Sessioni personali e gestione della presenza negli spot.',
  alternates: { canonical: null },
  robots: { index: false, follow: false },
};

export default function SessioniPage() {
  return <main style={{maxWidth:760,margin:'0 auto',padding:'24px 20px'}}><Link href="/">Torna alla mappa</Link><RiderHistory /></main>;
}
