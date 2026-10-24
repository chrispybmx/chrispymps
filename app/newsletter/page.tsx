import type { Metadata } from 'next';
import Link from 'next/link';
import NewsletterLandingForm from '@/components/NewsletterLandingForm';
import { APP_CONFIG, LINKS } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Newsletter: cinque cose dal mondo BMX',
  description:
    'Ogni lunedì cinque cose dal mondo BMX: spot nuovi, il video della settimana, la scena italiana e un consiglio pratico. Tre minuti di lettura, zero spam.',
  alternates: { canonical: `${APP_CONFIG.url}/newsletter` },
  openGraph: {
    type: 'website',
    locale: 'it_IT',
    url: `${APP_CONFIG.url}/newsletter`,
    siteName: APP_CONFIG.siteName,
    title: 'Newsletter: cinque cose dal mondo BMX',
    description:
      'Ogni lunedì cinque cose dal mondo BMX. Spot, video, scena italiana. Tre minuti, zero spam.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Newsletter Chrispy BMX' }],
  },
  robots: { index: true, follow: true },
};

/* Le cinque cose di ogni lunedi', nell'ordine in cui arrivano. Lista numerata
   e non griglia di card: e' il formato della newsletter, non un elenco di vantaggi. */
const CINQUE = [
  { title: 'Spot nuovi', text: 'I posti dove girano i rider, spesso prima che finiscano su Google.' },
  { title: 'Il video della settimana', text: "L'edit che vale i tuoi tre minuti, scelto a mano. Niente algoritmo." },
  { title: 'Scena italiana', text: 'Contest, jam e gente da seguire, magari vicino a te.' },
  { title: 'Un trick o un setup', text: 'Un consiglio pratico per la bici o per quello che stai imparando.' },
  { title: 'La cosa che mi ha acceso', text: 'Quella che non sta in nessuna categoria ma valeva la pena.' },
];

const heading = { fontFamily: 'var(--font-heading)' } as const;

export default function NewsletterPage() {
  return (
    <main className="min-h-[100dvh] bg-black text-bone">
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-16 sm:pt-24">
        <p className="text-vhs-sm font-semibold text-orange">Newsletter · ogni lunedì mattina</p>

        <h1 id="iscriviti" style={heading} className="mt-3 text-[2.75rem] font-bold leading-[0.95] text-bone sm:text-[4rem]">
          Cinque cose<br />dal mondo BMX
        </h1>

        <p className="mt-6 max-w-[34rem] text-vhs-lg text-gray-200">
          Le cinque cose che valgono della settimana di freestyle: spot, trick, scena italiana
          e il video da non perdere. Tre minuti di lettura, scritte da uno che ci gira dentro.
        </p>

        <div className="mt-8">
          <NewsletterLandingForm id="nl-hero" />
        </div>

        <h2 style={heading} className="mt-16 text-[1.75rem] font-bold text-bone">Cosa arriva, ogni volta</h2>
        <ol className="mt-4 border-t border-gray-700">
          {CINQUE.map((c, i) => (
            <li key={c.title} className="grid grid-cols-[2.5rem_1fr] gap-x-3 border-b border-gray-700 py-4">
              <span style={heading} className="text-[1.75rem] font-bold leading-none text-orange">{i + 1}</span>
              <div>
                <h3 className="text-vhs-lg font-semibold text-bone">{c.title}</h3>
                <p className="mt-1 text-vhs-base text-gray-200">{c.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <h2 style={heading} className="mt-16 text-[1.75rem] font-bold text-bone">Chi scrive</h2>
        <p className="mt-3 max-w-[34rem] text-vhs-lg text-gray-200">
          Sono Chrispy. Giro in BMX, filmo, e ogni settimana metto insieme le cose che mi hanno
          acceso. Niente fuffa, niente sponsor mascherati: solo quello che guarderei io.
        </p>
        <p className="mt-4 flex gap-5 text-vhs-base font-semibold">
          <a href={LINKS.youtube} target="_blank" rel="noopener noreferrer" className="text-bone underline-offset-4 hover:text-orange hover:underline">YouTube ↗</a>
          <a href={LINKS.instagram} target="_blank" rel="noopener noreferrer" className="text-bone underline-offset-4 hover:text-orange hover:underline">Instagram ↗</a>
        </p>

        <div className="mt-16 border-t border-gray-700 pt-8">
          <p className="text-vhs-lg text-bone">Ti disiscrivi con un click, da ogni email.</p>
          <div className="mt-5">
            <NewsletterLandingForm id="nl-foot" />
          </div>
        </div>
      </div>

      <footer className="border-t border-gray-800 px-5 py-8 text-vhs-sm text-gray-400">
        <div className="mx-auto flex max-w-2xl flex-wrap gap-x-5 gap-y-2">
          <Link href="/map" className="hover:text-orange">← Mappa spot</Link>
          <Link href="/privacy" className="hover:text-orange">Privacy</Link>
          <a href={LINKS.sito} target="_blank" rel="noopener noreferrer" className="hover:text-orange">chrispybmx.com ↗</a>
          <span className="text-gray-500">© {new Date().getFullYear()} Chrispy BMX</span>
        </div>
      </footer>
    </main>
  );
}
