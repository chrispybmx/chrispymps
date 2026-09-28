import type { Metadata } from 'next';
import { Pixelify_Sans } from 'next/font/google';
import AngelicaClient from './AngelicaClient';

/* Pagina nascosta per Angelica: nessun link dal sito, fuori dalla sitemap,
   noindex. Non va in robots.txt: un disallow renderebbe pubblico il percorso.
   Ci si arriva solo col link diretto. */
export const metadata: Metadata = {
  title: 'Messaggio',
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

const pixel = Pixelify_Sans({ weight: ['400', '700'], subsets: ['latin'], display: 'swap', variable: '--w95-font' });

export default function Page() {
  return <AngelicaClient fontClass={pixel.variable} />;
}
