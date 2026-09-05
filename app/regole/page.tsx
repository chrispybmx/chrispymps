import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * Le regole della mappa.
 *
 * Perche' esiste: fino a settembre 2026 le sei regole vivevano SOLO dentro
 * l'email di benvenuto. Chi voleva rileggerle doveva ritrovare quella mail, e
 * chi non l'aveva ricevuta — per esempio chi e' stato importato, o chi ha
 * creato l'account prima che l'automazione esistesse — non le aveva mai viste.
 *
 * Un regolamento si legge quando serve, e serve mentre carichi uno spot o
 * quando te ne rifiutano uno. Non trenta secondi dopo la registrazione.
 *
 * Stile e struttura copiati da app/privacy/page.tsx: stessa pagina statica,
 * stesso design system, stessa larghezza di lettura.
 */

export const metadata: Metadata = {
  title: 'Le regole della mappa',
  description:
    'Come funziona Chrispy Maps: cosa entra in mappa, cosa no, e cosa succede quando uno spot viene rifiutato.',
  alternates: { canonical: 'https://maps.chrispybmx.com/regole' },
  openGraph: {
    title: 'Le regole della mappa | Chrispy Maps',
    description: 'Cosa entra in mappa, cosa no, e perché.',
    url: 'https://maps.chrispybmx.com/regole',
    siteName: 'Chrispy Maps',
    locale: 'it_IT',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
};

/* ------------------------------------------------------------------ */
/*  Stili inline — coerenti con il design system dell'app              */
/* ------------------------------------------------------------------ */

const styles = {
  page: {
    background: 'var(--black)',
    minHeight: '100dvh',
    paddingTop: 'var(--topbar-height)',
    paddingBottom: 'calc(var(--strip-height) + 60px)',
  } as React.CSSProperties,

  container: {
    maxWidth: 640,
    margin: '0 auto',
    padding: '32px 20px 0',
  } as React.CSSProperties,

  backLink: {
    color: 'var(--orange)',
    fontFamily: 'var(--font-mono)',
    fontSize: 14,
    textDecoration: 'none',
  } as React.CSSProperties,

  h1: {
    fontFamily: 'var(--font-mono)',
    fontSize: 36,
    color: 'var(--orange)',
    margin: '24px 0 8px',
    lineHeight: 1.1,
  } as React.CSSProperties,

  subtitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 15,
    color: 'var(--gray-400)',
    marginBottom: 32,
    lineHeight: 1.5,
  } as React.CSSProperties,

  section: {
    background: 'var(--gray-800)',
    borderRadius: 10,
    padding: '24px 24px 20px',
    marginBottom: 20,
  } as React.CSSProperties,

  h2: {
    fontFamily: 'var(--font-mono)',
    fontSize: 22,
    color: 'var(--orange)',
    marginBottom: 14,
    letterSpacing: '0.02em',
  } as React.CSSProperties,

  p: {
    color: 'var(--bone)',
    fontFamily: 'var(--font-display)',
    fontSize: 15,
    lineHeight: 1.7,
    marginBottom: 10,
  } as React.CSSProperties,

  regolaNum: {
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    color: 'var(--orange)',
    letterSpacing: '0.1em',
    marginBottom: 6,
  } as React.CSSProperties,

  regolaTitolo: {
    fontFamily: 'var(--font-mono)',
    fontSize: 18,
    color: 'var(--bone)',
    marginBottom: 8,
    lineHeight: 1.3,
  } as React.CSSProperties,

  regola: {
    borderTop: '1px solid var(--gray-700)',
    paddingTop: 18,
    marginTop: 18,
  } as React.CSSProperties,

  link: {
    color: 'var(--orange)',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  } as React.CSSProperties,

  cta: {
    display: 'inline-block',
    background: 'var(--orange)',
    color: '#000',
    fontFamily: 'var(--font-mono)',
    fontSize: 15,
    padding: '14px 26px',
    borderRadius: 10,
    textDecoration: 'none',
    letterSpacing: '0.04em',
  } as React.CSSProperties,
};

/* ------------------------------------------------------------------ */
/*  Le regole                                                          */
/* ------------------------------------------------------------------ */

const regole = [
  {
    titolo: 'Solo spot reali e raggiungibili',
    testo:
      'Posti dove si gira davvero e in cui si entra senza problemi. Se ci vai e non puoi pedalare, non è uno spot: è un posto.',
  },
  {
    titolo: 'Niente proprietà private e niente posti vietati',
    testo:
      'Se per entrare devi scavalcare, forzare o passare da dove c’è scritto che non si passa, quello spot non va in mappa. Non è una questione di regolamento: è che pubblicarlo rovina il posto per tutti e mette nei guai chi ci va dopo di te.',
  },
  {
    titolo: 'Foto tue, scattate lì',
    testo:
      'La foto serve a far capire com’è messo lo spot: il terreno, gli ostacoli, lo spazio per rincorrere. Una foto presa da Google o da un edit di qualcun altro non lo dice, e non è tua da pubblicare.',
  },
  {
    titolo: 'Informazioni giuste',
    testo:
      'Posizione precisa, tipo di spot, condizione attuale. Chi arriva dopo di te si fida di quello che hai scritto: se il pin è a duecento metri o il park è chiuso da un anno, gli hai fatto fare il viaggio a vuoto.',
  },
  {
    titolo: 'Rispetto, negli spot e nei commenti',
    testo:
      'Niente spam, niente insulti, niente roba fuori luogo. La mappa la usano anche ragazzini.',
  },
  {
    titolo: 'Ogni spot passa dalla moderazione',
    testo:
      'Li guardo io, uno per uno, prima che vadano online. Non è un controllo di qualità sulla bellezza dello spot: è per tenere fuori i posti vietati, le foto non tue e i doppioni.',
  },
];

/* ------------------------------------------------------------------ */
/*  Componente pagina                                                  */
/* ------------------------------------------------------------------ */

export default function RegolePage() {
  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link href="/map" style={styles.backLink}>
          ← TORNA ALLA MAPPA
        </Link>

        <h1 style={styles.h1}>LE REGOLE</h1>
        <p style={styles.subtitle}>
          Chrispy Maps la costruiscono i rider. Sei regole, tutte per lo stesso
          motivo: che chi arriva dopo di te trovi quello che ha letto.
        </p>

        {/* -------------------------------------------------------- */}
        {/*  Le sei regole                                            */}
        {/* -------------------------------------------------------- */}
        <section style={styles.section}>
          {regole.map((r, i) => (
            <div key={i} style={i === 0 ? undefined : styles.regola}>
              <div style={styles.regolaNum}>{String(i + 1).padStart(2, '0')}</div>
              <div style={styles.regolaTitolo}>{r.titolo}</div>
              <p style={{ ...styles.p, marginBottom: 0 }}>{r.testo}</p>
            </div>
          ))}
        </section>

        {/* -------------------------------------------------------- */}
        {/*  Cosa succede se uno spot viene rifiutato                 */}
        {/* -------------------------------------------------------- */}
        <section style={styles.section}>
          <h2 style={styles.h2}>SE TI RIFIUTO UNO SPOT</h2>
          <p style={styles.p}>
            Capita, e quasi sempre per uno di due motivi: il posto è privato,
            oppure la foto non mostra lo spot. Non è un giudizio su di te e non
            perdi niente: puoi rimandarlo sistemato.
          </p>
          <p style={styles.p}>
            Se non capisci perché,{' '}
            <a href="mailto:christian.ceresato@gmail.com" style={styles.link}>
              scrivimi
            </a>{' '}
            e te lo dico.
          </p>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  Contenuti e cancellazione                                */}
        {/* -------------------------------------------------------- */}
        <section style={styles.section}>
          <h2 style={styles.h2}>LE TUE FOTO RESTANO TUE</h2>
          <p style={styles.p}>
            Caricando una foto mi dai il permesso di mostrarla su Chrispy Maps,
            niente di più: resta tua, puoi usarla dove vuoi e puoi chiedermi di
            toglierla quando vuoi.
          </p>
          <p style={styles.p}>
            Se cancelli l’account, gli spot che hai aggiunto e che sono già
            approvati restano sulla mappa come contributi anonimi — servono a chi
            li usa — mentre tutto il resto dei tuoi dati sparisce. I dettagli
            stanno nella{' '}
            <Link href="/privacy" style={styles.link}>
              privacy policy
            </Link>
            .
          </p>
        </section>

        <div style={{ textAlign: 'center', margin: '32px 0 16px' }}>
          <a href="/map?add=1" style={styles.cta}>
            🏴 AGGIUNGI UNO SPOT
          </a>
        </div>
      </div>
    </main>
  );
}
