import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Grazie per l\'iscrizione! | Newsletter ChrispyBMX',
  description: 'La tua iscrizione è confermata. Riceverai la newsletter ogni lunedì.',
};

export default function NewsletterThankYouPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white overflow-x-hidden relative">
      {/* VHS scanlines overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-5"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
        }}
        aria-hidden="true"
      />

      {/* Gradient BG */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-950/20 to-transparent -z-10" />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-5 text-center">
        <div className="max-w-2xl">
          {/* Checkmark */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-orange-600 text-white text-4xl font-bold">
              ✓
            </div>
          </div>

          {/* Main heading */}
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 tracking-tight font-mono">
            Iscritto!
          </h1>

          {/* Subheading */}
          <p className="text-xl text-zinc-300 mb-6 leading-relaxed">
            La tua iscrizione a <span className="text-orange-400 font-bold">Cinque cose dal mondo BMX</span> è confermata.
          </p>

          {/* Info box */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-6 mb-8 space-y-4 text-left">
            <div>
              <h2 className="text-sm font-bold text-orange-400 uppercase tracking-wider mb-2">📧 Quando arriva</h2>
              <p className="text-zinc-300">
                La prima newsletter ti arriverà <strong>lunedì mattina</strong>. Non ne perderai una più.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-bold text-orange-400 uppercase tracking-wider mb-2">📨 Gestisci l'iscrizione</h2>
              <p className="text-zinc-300">
                In fondo a ogni email troverai un link per <strong>disiscriverti</strong> in qualsiasi momento, senza domande.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-bold text-orange-400 uppercase tracking-wider mb-2">🔒 I tuoi dati</h2>
              <p className="text-zinc-300">
                La tua email è protetta. Leggi la nostra <a href="https://chrispybmx.com/privacy/" target="_blank" rel="noopener" className="text-orange-400 hover:underline">Privacy Policy</a> per i dettagli.
              </p>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://chrispybmx.com/"
              className="inline-block px-8 py-3 bg-orange-600 hover:bg-orange-700 text-black font-bold rounded-lg transition-colors"
            >
              ← Torna al sito
            </a>
            <a
              href="https://maps.chrispybmx.com/map"
              className="inline-block px-8 py-3 border border-orange-600 text-orange-400 hover:bg-orange-600/10 font-bold rounded-lg transition-colors"
            >
              Guarda la mappa spot →
            </a>
          </div>
        </div>
      </div>

      {/* Footer links */}
      <footer className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-zinc-950 to-transparent p-4 text-center text-xs text-zinc-500 space-y-2">
        <div className="flex flex-wrap gap-4 justify-center">
          <a href="https://chrispybmx.com/privacy/" target="_blank" rel="noopener" className="hover:text-orange-400">Privacy Policy</a>
          <span>•</span>
          <a href="https://chrispybmx.com/cookie-policy/" target="_blank" rel="noopener" className="hover:text-orange-400">Cookie Policy</a>
          <span>•</span>
          <a href="mailto:christian.ceresato@gmail.com" className="hover:text-orange-400">Contatti</a>
        </div>
        <p>© 2026 Chrispy BMX</p>
      </footer>
    </main>
  );
}
