import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * La 404 non deve essere indicizzabile, e non deve ereditare dal root layout il
 * canonical verso la homepage: un canonical self-referencing sbagliato dice ai
 * motori che quella URL È la home. canonical: null rimuove l'ereditarietà.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function NotFound() {
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--black)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <p style={{ color: 'var(--orange)', fontWeight: 600, fontSize: 14, margin: 0 }}>Errore 404</p>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.5rem', lineHeight: 1.05, color: 'var(--bone)', margin: '8px 0 12px' }}>
          Questo spot non esiste
        </h1>
        <p style={{ color: '#bdbbb4', fontSize: 16, lineHeight: 1.6, margin: '0 0 24px' }}>
          Il link è sbagliato o la pagina è stata tolta. Sulla mappa ce ne sono di veri.
        </p>
        <Link href="/map" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 20px', background: 'var(--orange)', color: '#0a0a0a', fontWeight: 700, borderRadius: 6, textDecoration: 'none' }}>
          Torna alla mappa
        </Link>
      </div>
    </main>
  );
}
