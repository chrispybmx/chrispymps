import type { Metadata } from 'next';
import Link from 'next/link';
import NewsletterLandingForm from '@/components/NewsletterLandingForm';
import { APP_CONFIG, LINKS } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Newsletter — Cinque cose dal mondo BMX',
  description:
    'Ogni lunedì cinque cose dal mondo BMX: spot nuovi, il video della settimana, la scena italiana e un consiglio pratico. Tre minuti di lettura, zero spam.',
  alternates: { canonical: `${APP_CONFIG.url}/newsletter` },
  openGraph: {
    type: 'website',
    locale: 'it_IT',
    url: `${APP_CONFIG.url}/newsletter`,
    siteName: APP_CONFIG.siteName,
    title: 'Newsletter — Cinque cose dal mondo BMX',
    description:
      'Ogni lunedì cinque cose dal mondo BMX. Spot, video, scena italiana. Tre minuti, zero spam.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Newsletter Chrispy BMX' }],
  },
  robots: { index: true, follow: true },
};

const BENEFITS = [
  { icon: '🛹', title: 'Spot nuovi', text: 'I posti dove girano i rider, spesso prima che li trovi su Google.' },
  { icon: '🎬', title: 'Video della settimana', text: "L'edit che vale i tuoi tre minuti, scelto a mano. Niente algoritmo." },
  { icon: '🇮🇹', title: 'Scena italiana', text: 'Contest, jam e gente da seguire — anche vicino a te.' },
  { icon: '🔧', title: 'Trick & setup', text: 'Un consiglio pratico a settimana per la bici e per i tuoi trick.' },
];

export default function NewsletterPage() {
  return (
    <main className="relative min-h-[100dvh] bg-black text-bone">
      {/* ===== HERO ===== */}
      <section
        id="iscriviti"
        className="mx-auto flex max-w-2xl flex-col items-center px-5 pb-16 pt-20 text-center sm:pt-28"
      >
        <span className="mb-5 inline-block rounded-full border border-orange/40 px-4 py-1 font-mono text-vhs-xs uppercase tracking-[0.18em] text-orange">
          📬 Newsletter settimanale
        </span>

        <h1 className="font-mono text-vhs-2xl leading-none text-bone sm:text-vhs-3xl">
          <span className="text-glitch" data-text="Cinque cose dal mondo BMX">
            Cinque cose dal mondo BMX
          </span>
        </h1>

        <p className="mt-6 max-w-xl font-display text-vhs-lg text-gray-200">
          Ogni lunedì mattina. Le cinque cose che valgono dalla settimana di freestyle mondiale —
          spot, trick, scena italiana, il video da non perdere. Raccontate da uno che ci gira dentro.
        </p>

        <div className="mt-9 flex w-full flex-col items-center">
          <NewsletterLandingForm id="nl-hero" />
        </div>
      </section>

      {/* ===== COSA RICEVI ===== */}
      <section className="border-t border-gray-800 bg-gray-800/30 px-5 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 text-center font-mono text-vhs-xl uppercase tracking-wide text-orange">
            Cosa trovi dentro
          </h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {BENEFITS.map((b) => (
              <li
                key={b.title}
                className="rounded-xl border border-gray-700 bg-black/40 p-5 transition-colors hover:border-orange/50"
              >
                <span className="text-2xl" aria-hidden>{b.icon}</span>
                <h3 className="mt-3 font-mono text-vhs-lg text-bone">{b.title}</h3>
                <p className="mt-1 font-display text-vhs-base text-gray-200">{b.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ===== CHI SCRIVE ===== */}
      <section className="px-5 py-16">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="mb-4 font-mono text-vhs-xl uppercase tracking-wide text-orange">
            Chi scrive
          </h2>
          <p className="font-display text-vhs-lg text-gray-200">
            Sono Chrispy. Giro in BMX, filmo, e ogni settimana metto insieme le cose che mi hanno
            acceso. Niente fuffa, niente sponsor mascherati — solo quello che guarderei io.
          </p>
          <div className="mt-6 flex items-center justify-center gap-5 font-mono text-vhs-sm uppercase tracking-wider">
            <a href={LINKS.youtube} target="_blank" rel="noopener noreferrer" className="text-bone transition-colors hover:text-orange">
              YouTube ↗
            </a>
            <a href={LINKS.instagram} target="_blank" rel="noopener noreferrer" className="text-bone transition-colors hover:text-orange">
              Instagram ↗
            </a>
          </div>
        </div>
      </section>

      {/* ===== CTA FINALE ===== */}
      <section className="border-t border-gray-800 bg-gray-800/30 px-5 py-16">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <h2 className="font-mono text-vhs-xl text-bone">Niente impegno. Un click per uscire.</h2>
          <p className="mt-3 font-display text-vhs-base text-gray-200">
            Unisciti ai rider che ogni lunedì leggono prima di salire in sella.
          </p>
          <div className="mt-7 flex w-full flex-col items-center">
            <NewsletterLandingForm id="nl-foot" />
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="px-5 py-10 text-center font-mono text-vhs-xs uppercase tracking-wider text-gray-400">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link href="/map" className="transition-colors hover:text-orange">← Mappa spot</Link>
          <Link href="/privacy" className="transition-colors hover:text-orange">Privacy</Link>
          <a href={LINKS.sito} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-orange">
            chrispybmx.com ↗
          </a>
        </div>
        <p className="mt-4 text-gray-600">© {new Date().getFullYear()} Chrispy BMX</p>
      </footer>
    </main>
  );
}
