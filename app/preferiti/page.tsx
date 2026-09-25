import type { Metadata } from 'next';
import PreferiteClient from './PreferiteClient';

// The per-request CSP nonce cannot be embedded in a prerendered favorites page.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'I miei spot preferiti',
  description: 'I tuoi spot BMX, skate e scooter salvati su Chrispy Maps.',
  robots: { index: false, follow: false },
};

export default function PreferitiPage() {
  return <PreferiteClient />;
}
