import type { Metadata } from 'next';
import Link from 'next/link';
import { LINKS, APP_CONFIG } from '@/lib/constants';

export const metadata: Metadata = {
  title:       'Supporta ChrispyMPS',
  description: 'ChrispyMPS è gratuito per sempre. Se ti è utile, puoi sostenere il progetto su Ko-fi.',
};

export default function SupportPage() {
  return (
    <main style={{
      background: 'var(--black)',
      minHeight: '100dvh',
      paddingTop: 'var(--topbar-height)',
      paddingBottom: 'calc(var(--strip-height) + 40px)',
    }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 20px 0' }}>
        {/* Back */}
        <Link href="/map" style={{ color: 'var(--orange)', fontFamily: 'var(--font-mono)', fontSize: 14, textDecoration: 'none' }}>
          ← TORNA ALLA MAPPA
        </Link>

        {/* Hero */}
        <div style={{ textAlign: 'center', margin: '32px 0 40px' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>☕</div>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 36, color: 'var(--orange)', margin: '0 0 12px' }}>
            SUPPORTA IL PROGETTO
          </h1>
          <p style={{ color: 'var(--bone)', fontSize: 17, lineHeight: 1.7 }}>
            ChrispyMPS è gratuito, senza pubblicità, senza account obbligatorio.<br />
            Lo tengo vivo nel tempo libero, tra un session e l'altro.
          </p>
        </div>

        {/* Story */}
        <div className="vhs-card" style={{ padding: '24px', marginBottom: 32 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--orange)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            PERCHÉ ESISTE QUESTA MAPPA
          </div>
          <p style={{ color: 'var(--bone)', lineHeight: 1.7, marginBottom: 12 }}>
            Ci sono mille app di mappe. Nessuna è fatta da chi fa BMX, per chi fa BMX, con la cura
            per i dettagli che contano davvero: la condizione dello spot aggiornata, il tipo di
            superficie, se serve cera, se c'è un guardiano alle 18.
          </p>
          <p style={{ color: 'var(--bone)', lineHeight: 1.7, marginBottom: 12 }}>
            Ho costruito ChrispyMPS perché la scene italiana merita uno strumento suo.
            Community-driven significa che la mappa è buona quanto le persone che ci contribuiscono.
          </p>
          <p style={{ color: 'var(--bone)', lineHeight: 1.7 }}>
            Se la usi, se ci giri, se trovi un posto nuovo grazie a questa mappa — considera di offrire
            un caffè. Non è un paywall, non è obbligatorio. È un gesto.
          </p>
          <div style={{ marginTop: 16, borderTop: '1px solid var(--gray-700)', paddingTop: 16 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gray-400)' }}>
              — Chrispy |{' '}
              <a href={LINKS.instagram} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--orange)' }}>
                @chrispy_bmx
              </a>
            </div>
          </div>
        </div>

        {/* CTA Ko-fi */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <a
            href={LINKS.kofi}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            style={{
              fontSize: 20, padding: '16px 40px',
              display: 'inline-flex', alignItems: 'center', gap: 10,
              textDecoration: 'none', boxShadow: 'var(--vhs-lg)',
            }}
          >
            ☕ Offrimi un caffè su Ko-fi
          </a>
          <p style={{ color: 'var(--gray-400)', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 12 }}>
            Ko-fi · Apple Pay / Google Pay · nessuna commissione nascosta
          </p>
        </div>

        {/* FAQ */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
            DOMANDE FREQUENTI
          </div>
          {[
            ['Il progetto diventerà a pagamento?', 'No. La mappa è e resterà gratuita per sempre.'],
            ['Chi dona riceve qualcosa in cambio?', 'Niente di speciale — la donazione è un gesto, non un acquisto.'],
            ['Posso contribuire in altri modi?', 'Sì! Aggiungere spot è il contributo più prezioso. Passa voce nella crew.'],
          ].map(([q, a]) => (
            <div key={q} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--gray-700)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--bone)', marginBottom: 6 }}>{q}</div>
              <div style={{ color: 'var(--gray-400)', fontSize: 14, lineHeight: 1.5 }}>{a}</div>
            </div>
          ))}
        </div>

        {/* Aggiungi spot */}
        <div style={{
          background: 'var(--gray-800)',
          border: '1px solid var(--gray-700)',
          borderRadius: 4, padding: '20px',
          textAlign: 'center',
        }}>
          <p style={{ color: 'var(--bone)', marginBottom: 16 }}>
            Non hai budget ma vuoi dare una mano? Aggiungi uno spot.
          </p>
          <Link href="/map?add=1" className="btn-secondary" style={{ textDecoration: 'none' }}>
            🏴 Aggiungi uno spot
          </Link>
        </div>
      </div>
    </main>
  );
}
