import type { Metadata } from 'next';
import Link from 'next/link';
import { LINKS } from '@/lib/constants';

export const metadata: Metadata = {
  title:       'Supporta ChrispyMPS',
  description: 'Vuoi supportare la mappa BMX italiana? Il modo migliore è aggiungere uno spot. Oppure dona via PayPal, Revolut o Bitcoin.',
};

/* ── Aggiorna questi con i tuoi dati reali ── */
const DONATE = {
  paypal:  'https://paypal.me/christianceresato',   // ← sostituisci con il tuo PayPal.me
  revolut: 'https://revolut.me/chrispy',            // ← sostituisci con il tuo Revolut.me tag
  btc:     'bc1qplaceholderaddressXXXXXXXXXXXXXXXX', // ← sostituisci con il tuo indirizzo BTC
};

export default function SupportPage() {
  const btcQr = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&color=ff6a00&bgcolor=0a0a0a&data=bitcoin:${DONATE.btc}`;

  return (
    <main style={{
      background: 'var(--black)',
      minHeight: '100dvh',
      paddingTop: 'var(--topbar-height)',
      paddingBottom: 'calc(var(--strip-height) + 40px)',
    }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '28px 20px 0' }}>

        {/* Back */}
        <Link href="/map" style={{
          color: 'var(--orange)', fontFamily: 'var(--font-mono)',
          fontSize: 13, textDecoration: 'none', letterSpacing: '0.04em',
        }}>
          ← TORNA ALLA MAPPA
        </Link>

        {/* Hero */}
        <div style={{ margin: '28px 0 32px' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--orange)', letterSpacing: '0.1em',
            textTransform: 'uppercase', marginBottom: 10,
          }}>
            COMMUNITY · BMX ITALIA
          </div>
          <h1 style={{
            fontFamily: 'var(--font-mono)', fontSize: 34,
            color: 'var(--bone)', margin: '0 0 16px', lineHeight: 1.1,
          }}>
            Supporta<br />
            <span style={{ color: 'var(--orange)' }}>la mappa.</span>
          </h1>
          <p style={{ color: 'var(--gray-400)', fontSize: 15, lineHeight: 1.65, margin: 0 }}>
            ChrispyMPS è gratuito, senza pubblicità, community-driven.
            Lo costruisco nel tempo libero tra una session e l&apos;altra.
            La mappa è buona quanto le persone che ci contribuiscono.
          </p>
        </div>

        {/* ═══ CTA PRINCIPALE: Aggiungi uno spot ═══ */}
        <div style={{
          background: 'rgba(255,106,0,0.06)',
          border: '1.5px solid rgba(255,106,0,0.4)',
          borderRadius: 12, padding: '28px 24px',
          marginBottom: 32, textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏴</div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 20,
            color: 'var(--orange)', marginBottom: 8, fontWeight: 700,
            letterSpacing: '0.04em',
          }}>
            IL MODO MIGLIORE PER SUPPORTARMI
          </div>
          <p style={{
            color: 'var(--bone)', fontSize: 15, lineHeight: 1.6,
            marginBottom: 20,
          }}>
            Aggiungi uno spot. Ogni location nuova fa crescere la community
            e aiuta altri rider a trovare posti nuovi. È il contributo più prezioso.
          </p>
          <Link
            href="/map?add=1"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--orange)', color: '#000',
              fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700,
              padding: '14px 32px', borderRadius: 8,
              textDecoration: 'none', letterSpacing: '0.04em',
              boxShadow: '0 0 24px rgba(255,106,0,0.3)',
            }}
          >
            + AGGIUNGI UNO SPOT →
          </Link>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--gray-500)', marginTop: 12,
          }}>
            Serve un account gratuito · approvazione manuale · la tua crew ti ringrazierà
          </div>
        </div>

        {/* ═══ DONAZIONI ═══ */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--gray-500)', textTransform: 'uppercase',
            letterSpacing: '0.08em', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ flex: 1, height: 1, background: 'var(--gray-700)' }} />
            <span>oppure dona</span>
            <div style={{ flex: 1, height: 1, background: 'var(--gray-700)' }} />
          </div>

          <p style={{
            color: 'var(--gray-400)', fontSize: 14, lineHeight: 1.6,
            marginBottom: 20, textAlign: 'center',
          }}>
            Non è obbligatorio. Se vuoi fare un gesto, scegli come preferisci:
          </p>

          {/* PayPal — opzione consigliata */}
          <a
            href={DONATE.paypal}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '18px 20px', marginBottom: 10,
              background: 'var(--gray-800)',
              border: '1px solid rgba(0,119,184,0.4)',
              borderRadius: 10, textDecoration: 'none',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = '#0077b8';
              (e.currentTarget as HTMLElement).style.background = 'rgba(0,119,184,0.06)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,119,184,0.4)';
              (e.currentTarget as HTMLElement).style.background = 'var(--gray-800)';
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 8,
              background: '#003087', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 22, flexShrink: 0,
            }}>
              P
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 15,
                color: 'var(--bone)', marginBottom: 3,
              }}>
                PayPal
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)' }}>
                paypal.me/christianceresato · universale, carta o conto
              </div>
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: '#0077b8', textTransform: 'uppercase', letterSpacing: '0.06em',
              background: 'rgba(0,119,184,0.12)', padding: '3px 8px', borderRadius: 4,
              flexShrink: 0,
            }}>
              CONSIGLIATO
            </div>
          </a>

          {/* Revolut */}
          <a
            href={DONATE.revolut}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '18px 20px', marginBottom: 10,
              background: 'var(--gray-800)',
              border: '1px solid rgba(99,91,255,0.35)',
              borderRadius: 10, textDecoration: 'none',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = '#635bff';
              (e.currentTarget as HTMLElement).style.background = 'rgba(99,91,255,0.06)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,91,255,0.35)';
              (e.currentTarget as HTMLElement).style.background = 'var(--gray-800)';
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 8,
              background: '#191c28', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 20, flexShrink: 0,
              border: '1px solid #635bff55',
            }}>
              𝐑
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--bone)', marginBottom: 3 }}>
                Revolut
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)' }}>
                @chrispy · zero commissioni tra utenti Revolut
              </div>
            </div>
            <span style={{ color: 'var(--gray-500)', fontSize: 18, flexShrink: 0 }}>→</span>
          </a>

          {/* Bitcoin */}
          <div style={{
            background: 'var(--gray-800)',
            border: '1px solid rgba(247,147,26,0.3)',
            borderRadius: 10, padding: '18px 20px',
            marginBottom: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 8,
                background: '#1a1000', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 22, flexShrink: 0,
                border: '1px solid #f7931a44',
              }}>
                ₿
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--bone)', marginBottom: 3 }}>
                  Bitcoin
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)' }}>
                  Scansiona il QR o copia l&apos;indirizzo
                </div>
              </div>
            </div>

            {/* QR + indirizzo */}
            <div style={{
              display: 'flex', gap: 16, alignItems: 'flex-start',
              background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '14px',
            }}>
              {/* QR code */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={btcQr}
                alt="QR code Bitcoin"
                width={80} height={80}
                style={{ borderRadius: 6, background: '#0a0a0a', flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: 'var(--gray-400)', marginBottom: 6, letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}>
                  Indirizzo BTC
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: '#f7931a',
                  wordBreak: 'break-all', lineHeight: 1.5,
                  userSelect: 'all',
                }}>
                  {DONATE.btc}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: 'var(--gray-600)', marginTop: 6,
                }}>
                  Seleziona e copia
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Story block */}
        <div style={{
          background: 'var(--gray-800)',
          border: '1px solid var(--gray-700)',
          borderRadius: 10, padding: '20px 20px',
          marginBottom: 32,
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--orange)', marginBottom: 10,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            PERCHÉ ESISTE QUESTA MAPPA
          </div>
          <p style={{ color: 'var(--gray-400)', lineHeight: 1.7, fontSize: 14, marginBottom: 12 }}>
            Ci sono mille app di mappe. Nessuna è fatta da chi fa BMX, per chi fa BMX.
            ChrispyMPS nasce perché la scena italiana merita uno strumento suo — con la
            condizione degli spot aggiornata, le foto reali, le info che contano davvero.
          </p>
          <div style={{ borderTop: '1px solid var(--gray-700)', paddingTop: 14 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)' }}>
              — Chrispy |{' '}
              <a href={LINKS.instagram} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--orange)', textDecoration: 'none' }}>
                @chrispy_bmx
              </a>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div style={{ marginBottom: 32 }}>
          {[
            ['Il progetto diventerà a pagamento?', 'No. La mappa è e resterà gratuita per sempre.'],
            ['Donare dà qualcosa in cambio?', 'Niente di speciale — è solo un gesto, non un acquisto.'],
            ['Posso condividere la mappa?', 'Sì! Passa il link alla tua crew. Più siamo, migliore è la mappa.'],
          ].map(([q, a]) => (
            <div key={q} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--gray-700)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)', marginBottom: 5 }}>{q}</div>
              <div style={{ color: 'var(--gray-400)', fontSize: 13, lineHeight: 1.5 }}>{a}</div>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
