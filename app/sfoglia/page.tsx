import type { Metadata } from 'next';
import SfogliaClient from './SfogliaClient';
import BottomNav from '@/components/BottomNav';

export const metadata: Metadata = {
  title: 'Sfoglia gli spot',
  description: 'Scorri gli spot BMX, skate e scooter uno per uno e salva quelli che ti piacciono nella tua cartella.',
  alternates: { canonical: 'https://maps.chrispybmx.com/sfoglia' },
  /* Pagina personale: il mazzo dipende da chi guarda, non ha senso indicizzarla. */
  robots: { index: false, follow: true },
};

export default function SfogliaPage() {
  return (
    <main style={{
      background: 'var(--black)', minHeight: '100dvh',
      paddingBottom: 'calc(70px + env(safe-area-inset-bottom, 0px))',
    }}>
      <div style={{
        padding: '14px 16px 6px', maxWidth: 520, margin: '0 auto',
        display: 'flex', alignItems: 'baseline', gap: 10,
      }}>
        <h1 style={{
          fontFamily: 'var(--font-mono)', fontSize: 20,
          color: 'var(--orange)', margin: 0,
        }}>
          SFOGLIA
        </h1>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)' }}>
          salva quelli che ti piacciono
        </span>
      </div>

      <SfogliaClient />
      <BottomNav />
    </main>
  );
}
