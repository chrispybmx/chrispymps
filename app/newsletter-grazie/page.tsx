import Link from 'next/link';
import { Metadata } from 'next';
import { PRIVATE_ROBOTS } from '@/lib/seo';

export const metadata: Metadata = {
  robots: PRIVATE_ROBOTS,
  title: 'Newsletter Chrispy Maps',
  description: 'Informazioni sulla newsletter BMX e sulla conferma dell’iscrizione.',
};

const heading = { fontFamily: 'var(--font-heading)' } as const;

export default function NewsletterThankYouPage() {
  return (
    <main className="min-h-[100dvh] bg-black text-bone">
      <div className="mx-auto max-w-xl px-5 pb-16 pt-16 sm:pt-24">
        <p className="text-vhs-sm font-semibold text-orange">Newsletter · quasi fatto</p>
        <h1 style={heading} className="mt-3 text-[2.5rem] font-bold leading-[1.05] sm:text-[3.25rem]">
          Controlla la tua email
        </h1>
        <p className="mt-5 text-vhs-lg text-gray-200">
          Se hai chiesto <strong className="text-bone">Cinque cose dal mondo BMX</strong>, ti ho mandato un link:
          aprilo e premi Conferma. Senza quel passaggio la newsletter non parte.
        </p>

        <dl className="mt-10 border-t border-gray-700">
          <div className="border-b border-gray-700 py-4">
            <dt className="font-semibold text-bone">Quando arriva</dt>
            <dd className="mt-1 text-gray-200">Il lunedì mattina, dopo che hai confermato.</dd>
          </div>
          <div className="border-b border-gray-700 py-4">
            <dt className="font-semibold text-bone">Come esci</dt>
            <dd className="mt-1 text-gray-200">In fondo a ogni email c&apos;è il link per disiscriverti, senza domande.</dd>
          </div>
          <div className="border-b border-gray-700 py-4">
            <dt className="font-semibold text-bone">I tuoi dati</dt>
            <dd className="mt-1 text-gray-200">
              Uso la tua email solo per la newsletter. I dettagli sono nella{' '}
              <Link href="/privacy#newsletter" className="text-orange underline-offset-4 hover:underline">privacy</Link>.
            </dd>
          </div>
        </dl>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/map" className="inline-flex min-h-[44px] items-center rounded-md bg-orange px-5 font-bold text-black">
            Guarda la mappa spot
          </Link>
          <a href="https://chrispybmx.com/" className="inline-flex min-h-[44px] items-center rounded-md border border-gray-600 px-5 font-semibold text-bone hover:border-orange">
            chrispybmx.com
          </a>
        </div>

        <p className="mt-12 text-vhs-sm text-gray-400">
          Problemi? <a href="mailto:christian.ceresato@gmail.com" className="hover:text-orange">Scrivimi</a>
        </p>
      </div>
    </main>
  );
}
