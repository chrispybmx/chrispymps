import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | Chrispy Maps',
  description:
    'Informativa sulla privacy ai sensi dell\'Art. 13 GDPR per Chrispy Maps (maps.chrispybmx.com). Titolare: Christian Ceresato.',
  alternates: { canonical: 'https://maps.chrispybmx.com/privacy' },
  openGraph: {
    title: 'Privacy Policy | Chrispy Maps',
    description:
      'Informativa sulla privacy ai sensi dell\'Art. 13 Regolamento UE 2016/679 (GDPR).',
    url: 'https://maps.chrispybmx.com/privacy',
    siteName: 'Chrispy Maps',
    locale: 'it_IT',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privacy Policy | Chrispy Maps',
    description:
      'Informativa sulla privacy ai sensi dell\'Art. 13 Regolamento UE 2016/679 (GDPR).',
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

  h3: {
    fontFamily: 'var(--font-mono)',
    fontSize: 17,
    color: 'var(--bone)',
    marginTop: 18,
    marginBottom: 8,
  } as React.CSSProperties,

  p: {
    color: 'var(--bone)',
    fontFamily: 'var(--font-display)',
    fontSize: 15,
    lineHeight: 1.7,
    marginBottom: 10,
  } as React.CSSProperties,

  ul: {
    color: 'var(--bone)',
    fontFamily: 'var(--font-display)',
    fontSize: 15,
    lineHeight: 1.7,
    marginBottom: 10,
    paddingLeft: 20,
  } as React.CSSProperties,

  li: {
    marginBottom: 6,
  } as React.CSSProperties,

  link: {
    color: 'var(--orange)',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  } as React.CSSProperties,

  label: {
    color: 'var(--gray-400)',
    fontFamily: 'var(--font-display)',
    fontSize: 13,
    lineHeight: 1.5,
  } as React.CSSProperties,

  tableWrap: {
    overflowX: 'auto' as const,
    WebkitOverflowScrolling: 'touch' as const,
    marginBottom: 10,
  } as React.CSSProperties,

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontFamily: 'var(--font-display)',
    fontSize: 14,
    lineHeight: 1.5,
  } as React.CSSProperties,

  th: {
    background: 'var(--gray-700)',
    color: 'var(--orange)',
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    fontWeight: 400,
    textAlign: 'left' as const,
    padding: '10px 12px',
    whiteSpace: 'nowrap' as const,
    borderBottom: '1px solid var(--gray-600)',
  } as React.CSSProperties,

  td: {
    color: 'var(--bone)',
    padding: '10px 12px',
    borderBottom: '1px solid var(--gray-700)',
    verticalAlign: 'top' as const,
  } as React.CSSProperties,

  tdSecondary: {
    color: 'var(--gray-400)',
    padding: '10px 12px',
    borderBottom: '1px solid var(--gray-700)',
    verticalAlign: 'top' as const,
    fontSize: 13,
  } as React.CSSProperties,

  code: {
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    color: 'var(--orange)',
    background: 'var(--gray-700)',
    padding: '2px 6px',
    borderRadius: 4,
  } as React.CSSProperties,

  divider: {
    border: 'none',
    borderTop: '1px solid var(--gray-600)',
    margin: '32px 0',
  } as React.CSSProperties,
};

/* ------------------------------------------------------------------ */
/*  Tabella dati: righe                                                */
/* ------------------------------------------------------------------ */

const dataRows = [
  {
    trattamento: 'Registrazione account',
    dati: 'Email, username, password (hash bcrypt)',
    base: 'Art. 6(1)(b) — esecuzione contratto',
    durata: 'Durata account + 24 mesi di inattivita',
  },
  {
    trattamento: 'Invio spot',
    dati: '@username, coordinate GPS dello spot, citta e paese, foto (metadati EXIF/GPS rimossi automaticamente al caricamento), descrizione',
    base: 'Art. 6(1)(b) — esecuzione contratto',
    durata: 'Durata pubblicazione dello spot',
  },
  {
    trattamento: 'Comunicazioni di servizio',
    dati: 'Email, username (benvenuto, regolamento d’uso, avvisi account — tramite MailerLite)',
    base: 'Art. 6(1)(b) — esecuzione contratto',
    durata: 'Durata account',
  },
  {
    trattamento: 'Newsletter',
    dati: 'Email, username',
    base: 'Art. 6(1)(a) — consenso',
    durata: 'Fino a revoca del consenso',
  },
  {
    trattamento: 'Geolocalizzazione',
    dati: 'Coordinate GPS del dispositivo',
    base: 'Art. 6(1)(a) — consenso',
    durata: 'Non conservato server-side',
  },
  {
    trattamento: 'Spot Radar',
    dati: 'Coordinate periodiche del dispositivo',
    base: 'Art. 6(1)(a) — consenso',
    durata: 'Solo client-side (localStorage)',
  },
  {
    trattamento: 'Email di moderazione',
    dati: 'Email utente',
    base: 'Art. 6(1)(b) — esecuzione contratto',
    durata: 'Durata account',
  },
  {
    trattamento: 'Cookie tecnici',
    dati: 'Dati di sessione',
    base: 'Art. 6(1)(f) — legittimo interesse',
    durata: 'Durata della sessione',
  },
];

/* ------------------------------------------------------------------ */
/*  Componente pagina                                                  */
/* ------------------------------------------------------------------ */

export default function PrivacyPage() {
  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {/* Back link */}
        <Link href="/" style={styles.backLink}>
          ← TORNA ALLA MAPPA
        </Link>

        {/* Title */}
        <h1 style={styles.h1}>PRIVACY POLICY</h1>
        <p style={styles.subtitle}>
          Informativa sul trattamento dei dati personali ai sensi dell&apos;Art. 13
          del Regolamento UE 2016/679 (GDPR)
        </p>

        {/* -------------------------------------------------------- */}
        {/*  1. Titolare del trattamento                              */}
        {/* -------------------------------------------------------- */}
        <section style={styles.section}>
          <h2 style={styles.h2}>1. TITOLARE DEL TRATTAMENTO</h2>
          <p style={styles.p}>
            Il titolare del trattamento dei dati personali e:
          </p>
          <p style={{ ...styles.p, fontWeight: 600 }}>
            Christian Ceresato
          </p>
          <p style={styles.p}>
            Email:{' '}
            <a href="mailto:christian.ceresato@gmail.com" style={styles.link}>
              christian.ceresato@gmail.com
            </a>
          </p>
          <p style={styles.p}>
            Sito:{' '}
            <a href="https://maps.chrispybmx.com" style={styles.link}>
              maps.chrispybmx.com
            </a>{' '}
            (di seguito &quot;Chrispy Maps&quot; o &quot;il Servizio&quot;)
          </p>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  2. Dati raccolti e finalita                              */}
        {/* -------------------------------------------------------- */}
        <section style={styles.section}>
          <h2 style={styles.h2}>2. DATI RACCOLTI E FINALITA</h2>
          <p style={styles.p}>
            Chrispy Maps raccoglie e tratta i seguenti dati personali per le
            finalita indicate, con le relative basi giuridiche e periodi di
            conservazione:
          </p>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Trattamento</th>
                  <th style={styles.th}>Dati raccolti</th>
                  <th style={styles.th}>Base giuridica</th>
                  <th style={styles.th}>Conservazione</th>
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row) => (
                  <tr key={row.trattamento}>
                    <td style={{ ...styles.td, fontWeight: 600, whiteSpace: 'nowrap' as const }}>
                      {row.trattamento}
                    </td>
                    <td style={styles.td}>{row.dati}</td>
                    <td style={styles.tdSecondary}>{row.base}</td>
                    <td style={styles.tdSecondary}>{row.durata}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  3. Destinatari e sub-responsabili                        */}
        {/* -------------------------------------------------------- */}
        <section style={styles.section}>
          <h2 style={styles.h2}>3. DESTINATARI E SUB-RESPONSABILI</h2>
          <p style={styles.p}>
            I dati personali possono essere comunicati ai seguenti fornitori
            terzi, in qualita di sub-responsabili del trattamento:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>
              <strong>Supabase Inc.</strong> (USA) — database, autenticazione,
              storage
            </li>
            <li style={styles.li}>
              <strong>Vercel Inc.</strong> (USA) — hosting e CDN
            </li>
            <li style={styles.li}>
              <strong>Resend Inc.</strong> (USA) — invio email transazionali
              (moderazione, reset password)
            </li>
            <li style={styles.li}>
              <strong>MailerLite UAB</strong> (Lituania) — invio newsletter e
              comunicazioni di servizio relative all&apos;account
            </li>
            <li style={styles.li}>
              <strong>OpenStreetMap Foundation</strong> (Regno Unito) — servizio
              di geocoding Nominatim: quando cerchi un luogo o selezioni una
              posizione, le relative coordinate vengono inviate a
              nominatim.openstreetmap.org per ottenere il nome di citta e paese.
              Nessun dato identificativo (email, username) viene trasmesso.
            </li>
          </ul>
          <p style={styles.p}>
            I dati non vengono venduti, ceduti o diffusi a terzi per finalita
            di marketing.
          </p>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  4. Trasferimenti extra-UE                                */}
        {/* -------------------------------------------------------- */}
        <section style={styles.section}>
          <h2 style={styles.h2}>4. TRASFERIMENTI EXTRA-UE</h2>
          <p style={styles.p}>
            Alcuni sub-responsabili hanno sede negli Stati Uniti. I trasferimenti
            di dati personali verso gli USA avvengono sulla base di garanzie
            adeguate, in conformita al Capo V del GDPR:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>
              <strong>EU-US Data Privacy Framework</strong> (decisione di
              adeguatezza della Commissione Europea del 10 luglio 2023), ove il
              provider aderisca al DPF;
            </li>
            <li style={styles.li}>
              <strong>Clausole Contrattuali Standard (SCC)</strong> adottate
              dalla Commissione Europea ai sensi dell&apos;Art. 46(2)(c) GDPR, negli
              altri casi.
            </li>
          </ul>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  5. Diritti dell'interessato                              */}
        {/* -------------------------------------------------------- */}
        <section style={styles.section}>
          <h2 style={styles.h2}>5. DIRITTI DELL&apos;INTERESSATO</h2>
          <p style={styles.p}>
            In qualita di interessato, hai il diritto di:
          </p>
          <ul style={styles.ul}>
            <li style={styles.li}>
              <strong>Accesso</strong> (Art. 15) — ottenere conferma
              dell&apos;esistenza di un trattamento e accedere ai tuoi dati
            </li>
            <li style={styles.li}>
              <strong>Rettifica</strong> (Art. 16) — correggere dati inesatti o
              incompleti
            </li>
            <li style={styles.li}>
              <strong>Cancellazione</strong> (Art. 17) — richiedere la
              cancellazione dei tuoi dati (&quot;diritto all&apos;oblio&quot;)
            </li>
            <li style={styles.li}>
              <strong>Limitazione</strong> (Art. 18) — limitare il trattamento
              in determinate circostanze
            </li>
            <li style={styles.li}>
              <strong>Portabilita</strong> (Art. 20) — ricevere i tuoi dati in
              formato strutturato e leggibile da dispositivo automatico
            </li>
            <li style={styles.li}>
              <strong>Opposizione</strong> (Art. 21) — opporti al trattamento
              basato su legittimo interesse
            </li>
          </ul>
          <p style={styles.p}>
            Per esercitare i tuoi diritti, scrivi a:{' '}
            <a href="mailto:christian.ceresato@gmail.com" style={styles.link}>
              christian.ceresato@gmail.com
            </a>
          </p>
          <p style={styles.label}>
            Il titolare risponde entro 30 giorni dalla ricezione della richiesta,
            prorogabili di ulteriori 60 giorni in caso di complessita, con
            comunicazione motivata.
          </p>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  6. Reclamo al Garante                                    */}
        {/* -------------------------------------------------------- */}
        <section style={styles.section}>
          <h2 style={styles.h2}>6. RECLAMO AL GARANTE</h2>
          <p style={styles.p}>
            Se ritieni che il trattamento dei tuoi dati personali violi il GDPR,
            hai diritto di proporre reclamo all&apos;autorita di controllo competente:
          </p>
          <p style={{ ...styles.p, fontWeight: 600 }}>
            Garante per la protezione dei dati personali
          </p>
          <p style={styles.p}>
            Piazza Venezia 11, 00187 Roma
          </p>
          <p style={styles.p}>
            Sito web:{' '}
            <a
              href="https://www.gpdp.it"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              www.gpdp.it
            </a>
          </p>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  7. Minori                                                */}
        {/* -------------------------------------------------------- */}
        <section style={styles.section}>
          <h2 style={styles.h2}>7. MINORI</h2>
          <p style={styles.p}>
            Il Servizio e riservato a utenti di almeno{' '}
            <strong>14 anni di eta</strong>, in conformita all&apos;Art. 2-quinquies
            del D.lgs. 196/2003 (Codice Privacy), come modificato dal D.lgs.
            101/2018.
          </p>
          <p style={styles.p}>
            Il titolare non raccoglie consapevolmente dati personali di soggetti
            di eta inferiore ai 14 anni. Qualora venisse a conoscenza di tale
            circostanza, provvedera alla cancellazione immediata dei dati.
          </p>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  8. Cookie e tecnologie locali                            */}
        {/* -------------------------------------------------------- */}
        <section style={styles.section}>
          <h2 style={styles.h2}>8. COOKIE E TECNOLOGIE LOCALI</h2>
          <p style={styles.p}>
            Chrispy Maps utilizza esclusivamente{' '}
            <strong>cookie tecnici e necessari</strong> per il funzionamento del
            servizio. Non vengono utilizzati cookie di profilazione, tracciamento
            o di terze parti a fini pubblicitari.
          </p>

          <h3 style={styles.h3}>Cookie utilizzati</h3>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Nome</th>
                  <th style={styles.th}>Tipo</th>
                  <th style={styles.th}>Finalita</th>
                  <th style={styles.th}>Durata</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={styles.td}>
                    <span style={styles.code}>sb-*-auth-token</span>
                  </td>
                  <td style={styles.tdSecondary}>Necessario</td>
                  <td style={styles.td}>Sessione di autenticazione utente (Supabase Auth)</td>
                  <td style={styles.tdSecondary}>Sessione</td>
                </tr>
                <tr>
                  <td style={styles.td}>
                    <span style={styles.code}>cmps_admin_session</span>
                  </td>
                  <td style={styles.tdSecondary}>Necessario</td>
                  <td style={styles.td}>Sessione di autenticazione amministratore</td>
                  <td style={styles.tdSecondary}>Sessione</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 style={styles.h3}>localStorage</h3>
          <p style={styles.p}>
            Chrispy Maps utilizza il localStorage del browser per salvare
            preferenze dell&apos;interfaccia utente (tema, filtri, impostazioni Spot
            Radar). Questi dati restano esclusivamente sul dispositivo
            dell&apos;utente e non vengono mai trasmessi al server.
          </p>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  9. Ultimo aggiornamento                                  */}
        {/* -------------------------------------------------------- */}
        <section style={styles.section}>
          <h2 style={styles.h2}>9. ULTIMO AGGIORNAMENTO</h2>
          <p style={styles.p}>
            La presente informativa e stata aggiornata l&apos;ultima volta a{' '}
            <strong>luglio 2026</strong>.
          </p>
          <p style={styles.p}>
            Il titolare si riserva il diritto di modificare la presente
            informativa in qualsiasi momento. Le modifiche saranno pubblicate su
            questa pagina con indicazione della data di ultimo aggiornamento.
          </p>
        </section>

        {/* Divider */}
        <hr style={styles.divider} />

        {/* Footer link */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Link href="/" style={styles.backLink}>
            ← TORNA ALLA MAPPA
          </Link>
        </div>
      </div>
    </main>
  );
}
