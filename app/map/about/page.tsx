import type { Metadata } from 'next';
import Link from 'next/link';
import { LINKS } from '@/lib/constants';

export const metadata: Metadata = {
  title:       'Chi siamo — Chrispy Maps',
  description: 'Chrispy Maps è la mappa BMX street italiana, community-driven. Creata da Chrispy per la scene italiana.',
};

export default function AboutPage() {
  return (
    <main style={{
      background: 'var(--black)',
      minHeight: '100dvh',
      paddingTop: 'var(--topbar-height)',
      paddingBottom: 'calc(var(--strip-height) + 40px)',
    }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 20px 0' }}>
        <Link href="/" style={{ color: 'var(--orange)', fontFamily: 'var(--font-mono)', fontSize: 14, textDecoration: 'none' }}>
          ← TORNA ALLA MAPPA
        </Link>

        <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 36, color: 'var(--orange)', margin: '24px 0 24px' }}>
          CHI SIAMO
        </h1>

        <div className="vhs-card" style={{ padding: 24, marginBottom: 24 }}>
          <p style={{ color: 'var(--bone)', lineHeight: 1.7, marginBottom: 12 }}>
            <strong style={{ color: 'var(--orange)' }}>Chrispy Maps</strong> è un progetto indipendente di{' '}
            <a href={LINKS.instagram} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--orange)' }}>
              Christian "Chrispy" Ceresato
            </a>
            , rider BMX con base a Merano.
          </p>
          <p style={{ color: 'var(--bone)', lineHeight: 1.7, marginBottom: 12 }}>
            L'obiettivo è semplice: una mappa completa e aggiornata degli spot BMX street in Italia,
            gestita dalla community, verificata da un moderatore umano.
          </p>
          <p style={{ color: 'var(--bone)', lineHeight: 1.7 }}>
            Ogni spot viene revisionato personalmente prima di apparire sulla mappa. Non è un algoritmo,
            non è automatico. È Chrispy che guarda le foto, verifica la posizione GPS e approva.
          </p>
        </div>

        {/* CTA — mappa */}
        <Link href="/" style={{ display: 'block', textDecoration: 'none', marginBottom: 24 }}>
          <div style={{
            background: 'var(--orange)',
            borderRadius: 10,
            padding: '22px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            cursor: 'pointer',
          }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: '#000', fontWeight: 700, letterSpacing: '0.02em', lineHeight: 1.2 }}>
                La mappa più croccante d'Italia 🏴
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'rgba(0,0,0,0.6)', marginTop: 6 }}>
                Spot BMX, skatepark e park scooter in tutta Italia
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, flexShrink: 0, color: '#000' }}>
              →
            </div>
          </div>
        </Link>

        <div className="vhs-card" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--orange)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            PRIVACY
          </div>
          <p style={{ color: 'var(--bone)', lineHeight: 1.6, marginBottom: 10 }}>
            Raccogliamo solo quello che serve: nome, email e posizione GPS per gli spot inviati.
            Non vendiamo dati. Non usiamo cookie di tracciamento.
          </p>
          <p style={{ color: 'var(--bone)', lineHeight: 1.6 }}>
            Se ti sei iscritto alla newsletter, puoi cancellarti in qualsiasi momento rispondendo
            a qualsiasi email con "cancellami".
          </p>
        </div>

        <div className="vhs-card" style={{ padding: 24, marginBottom: 32 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--orange)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            CONTATTI
          </div>
          <p style={{ color: 'var(--bone)', lineHeight: 1.6, marginBottom: 12 }}>
            Per problemi tecnici, segnalazioni o collaborazioni:
          </p>
          <a href={LINKS.mailContact} style={{ color: 'var(--orange)', fontFamily: 'var(--font-mono)', fontSize: 15 }}>
            christian.ceresato@gmail.com
          </a>
          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            <a href={LINKS.instagram} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ textDecoration: 'none', fontSize: 14 }}>
              📸 Instagram
            </a>
            <a href={LINKS.youtube} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ textDecoration: 'none', fontSize: 14 }}>
              ▶ YouTube
            </a>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)' }}>
          Chrispy Maps v1.0 — Community BMX Italia<br />
          Made with 🏴 by Chrispy
        </div>
      </div>
    </main>
  );
}
