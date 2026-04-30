import type { Metadata } from 'next';
import SessioniClient from './SessioniClient';

export const metadata: Metadata = {
  title: 'Sessioni Live — Chi sta ridando ora',
  description: 'Guarda chi sta ridando in questo momento sugli spot BMX in Italia. Unisciti alla session!',
  alternates: { canonical: 'https://maps.chrispybmx.com/sessioni' },
  robots: { index: true, follow: true },
};

export default function SessioniPage() {
  return <SessioniClient />;
}
