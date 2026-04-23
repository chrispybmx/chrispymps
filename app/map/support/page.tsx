import type { Metadata } from 'next';
import Link from 'next/link';
import { LINKS } from '@/lib/constants';

export const metadata: Metadata = {
  title:       'Supporta ChrispyMPS',
  description: 'Vuoi supportare la mappa BMX italiana? Il modo migliore è aggiungere uno spot. Oppure dona via Revolut o Bitcoin.',
};

const DONATE = {
  revolut: 'https://revolut.me/chrispybmx',
  btc:     'bc1qlcm90tma74epqsv5gleme2xw3akeunxmhgj765',
};

export default async function SupportPage() {
  let btcQr = '';
  try {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=ff6a00&bgcolor=111111&data=bitcoin:${DONATE.btc}`;
    const res = await fetch(qrUrl, { next: { revalidate: 86400 } });
    if (res.ok) {
      const buf = await res.arrayBuffer();
      btcQr = `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
    }
  } catch { /* fallback */ }

  return (
    <main style={{
      background: 'var(--black)',
      minHeight: '100dvh',
      paddingTop: 'var(--topbar-height)',
      paddingBottom: 'calc(var(--strip-height) + 60px)',
    }}>
      <style>{`
        .sup-back:hover { opacity: 0.7; }
        .sup-cta-btn:hover { background: #ff8c2a !important; box-shadow: 0 0 40px rgba(255,106,0,0.5) !important; transform: translateY(-1px); }
        .sup-cta-btn { transition: background 0.15s, box-shadow 0.15s, transform 0.15s; }
        .rev-card:hover { border-color: rgba(99,91,255,0.7) !important; background: rgba(99,91,255,0.07) !important; }
        .rev-card { transition: border-color 0.15s, background 0.15s; }
        .btc-card:hover { border-color: rgba(247,147,26,0.6) !important; }
        .btc-card { transition: border-color 0.15s; }
        .sup-back { transition: opacity 0.15s; }
      `}</style>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 20px 0' }}>

        {/* ── Back ── */}
        <Link href="/map" className="sup-back" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: 'var(--gray-500)', fontFamily: 'var(--font-mono)',
          fontSize: 12, textDecoration: 'none', letterSpacing: '0.05em',
        }}>
          ← mappa
        </Link>

        {/* ── Hero ── */}
        <div style={{ margin: '36px 0 40px' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--orange)', letterSpacing: '0.14em',
            textTransform: 'uppercase', marginBottom: 14,
          }}>
            BMX · ITALIA · COMMUNITY
          </div>
          <h1 style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'clamp(36px, 8vw, 52px)',
            color: 'var(--bone)', margin: '0 0 20px',
            lineHeight: 1.05, fontWeight: 700,
            letterSpacing: '-0.01em',
          }}>
            Tieni viva<br />
            <span style={{ color: 'var(--orange)' }}>la scena.</span>
          </h1>
          <p style={{
            color: 'var(--gray-400)', fontSize: 15,
            lineHeight: 1.7, margin: 0, maxWidth: 440,
          }}>
            ChrispyMPS è gratuito, senza pubblicità, costruito nel tempo
            libero tra una session e l&apos;altra. Funziona quanto le persone
            che lo alimentano.
          </p>
        </div>

        {/* ── CTA principale ── */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,106,0,0.1) 0%, rgba(255,106,0,0.04) 100%)',
          border: '1px solid rgba(255,106,0,0.35)',
          borderRadius: 16, padding: '32px 28px 28px',
          marginBottom: 16, position: 'relative', overflow: 'hidden',
        }}>
          {/* decorative glow */}
          <div style={{
            position: 'absolute', top: -40, right: -40,
            width: 160, height: 160, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,106,0,0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{
            display: 'flex', alignItems: 'flex-start',
            gap: 16, marginBottom: 20,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'var(--orange)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 22, flexShrink: 0,
            }}>
              📍
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 17,
                color: 'var(--bone)', fontWeight: 700,
                marginBottom: 6, letterSpacing: '0.01em',
              }}>
                Aggiungi uno spot
              </div>
              <p style={{
                color: 'var(--gray-400)', fontSize: 14,
                lineHeight: 1.6, margin: 0,
              }}>
                È il contributo più utile. Ogni posto nuovo aiuta
                altri rider a trovare spot e fa crescere la community.
              </p>
            </div>
          </div>

          <Link
            href="/map?add=1"
            className="sup-cta-btn"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, width: '100%',
              background: 'var(--orange)', color: '#000',
              fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700,
              padding: '15px 24px', borderRadius: 10,
              textDecoration: 'none', letterSpacing: '0.05em',
              boxShadow: '0 0 28px rgba(255,106,0,0.25)',
            }}
          >
            + AGGIUNGI UNO SPOT
          </Link>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--gray-600)', marginTop: 10, textAlign: 'center',
          }}>
            account gratuito · approvazione manuale
          </div>
        </div>

        {/* ── Divisore ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          margin: '32px 0 24px',
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--gray-800)' }} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--gray-600)', letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            oppure dona
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--gray-800)' }} />
        </div>

        {/* ── Revolut ── */}
        <a
          href={DONATE.revolut}
          target="_blank"
          rel="noopener noreferrer"
          className="rev-card"
          style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '20px', marginBottom: 10,
            background: 'rgba(99,91,255,0.04)',
            border: '1px solid rgba(99,91,255,0.28)',
            borderRadius: 12, textDecoration: 'none',
          }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: '#1a1d2e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, border: '1px solid rgba(99,91,255,0.4)',
            fontFamily: 'var(--font-mono)', fontWeight: 900,
            fontSize: 20, color: '#fff', letterSpacing: '-0.02em',
          }}>
            R
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 15,
              color: 'var(--bone)', fontWeight: 700, marginBottom: 4,
            }}>
              Revolut
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: 'var(--gray-500)',
            }}>
              @chrispybmx · zero commissioni
            </div>
          </div>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 13,
            color: '#635bff', fontWeight: 700, flexShrink: 0,
          }}>
            →
          </span>
        </a>

        {/* ── Bitcoin ── */}
        <div
          className="btc-card"
          style={{
            background: 'rgba(247,147,26,0.03)',
            border: '1px solid rgba(247,147,26,0.22)',
            borderRadius: 12, padding: '20px',
            marginBottom: 40,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: '#1a1200',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, border: '1px solid rgba(247,147,26,0.35)',
              fontSize: 24,
            }}>
              ₿
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 15,
                color: 'var(--bone)', fontWeight: 700, marginBottom: 4,
              }}>
                Bitcoin
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 12,
                color: 'var(--gray-500)',
              }}>
                Scansiona il QR o copia l&apos;indirizzo
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex', gap: 20, alignItems: 'center',
            background: 'rgba(0,0,0,0.25)', borderRadius: 10,
            padding: '16px',
          }}>
            {btcQr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={btcQr}
                alt="QR code Bitcoin"
                width={96} height={96}
                style={{
                  borderRadius: 8, flexShrink: 0,
                  border: '1px solid rgba(247,147,26,0.2)',
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 9,
                color: 'var(--gray-500)', marginBottom: 8,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Indirizzo BTC
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: '#f7931a', wordBreak: 'break-all',
                lineHeight: 1.6, userSelect: 'all' as const,
              }}>
                {DONATE.btc}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: 'var(--gray-700)', marginTop: 8,
              }}>
                tocca per selezionare tutto
              </div>
            </div>
          </div>
        </div>

        {/* ── Manifesto ── */}
        <div style={{
          borderTop: '1px solid var(--gray-800)',
          paddingTop: 32, marginBottom: 32,
        }}>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: 13,
            color: 'var(--gray-500)', lineHeight: 1.8,
            margin: '0 0 16px', fontStyle: 'italic',
          }}>
            &ldquo;Ci sono mille app di mappe. Nessuna è fatta da chi fa BMX,
            per chi fa BMX. ChrispyMPS esiste perché la scena italiana
            merita uno strumento suo.&rdquo;
          </p>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 12,
            color: 'var(--gray-600)', display: 'flex',
            alignItems: 'center', gap: 8,
          }}>
            <span>— Chrispy</span>
            <span style={{ color: 'var(--gray-700)' }}>·</span>
            <a
              href={LINKS.instagram}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--orange)', textDecoration: 'none' }}
            >
              @chrispy_bmx
            </a>
          </div>
        </div>

      </div>
    </main>
  );
}
