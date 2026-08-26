'use client';

import { useState } from 'react';
import type { SpotStatus } from '@/lib/types';

interface Props {
  spotId: string;
  nome: string;
  slug: string;
  citta: string | null;
  tipo: string;
  emoji: string;
  descrizione: string | null;
  autore: string | null;
  stato: SpotStatus;
  foto: string[];
  lat: number;
  lon: number;
  tokenApprova: string | null;
  tokenRifiuta: string | null;
  /** Presente solo quando si sta moderando un evento invece di uno spot. */
  evento?: { token: string; azione: 'approve' | 'reject'; quando: string | null };
}

type Esito = { ok: boolean; testo: string } | null;

const mono = 'var(--font-mono)';

export default function ConfermaClient(p: Props) {
  const [inCorso, setInCorso] = useState<'approva' | 'rifiuta' | null>(null);
  const [esito,   setEsito]   = useState<Esito>(null);
  const [foto,    setFoto]    = useState(0);

  /* Se lo spot è già stato deciso, non si rifà: si dice com'è andata. */
  const giaDeciso = p.stato !== 'pending';

  const decidi = async (azione: 'approva' | 'rifiuta') => {
    setInCorso(azione);
    setEsito(null);
    try {
      /* Gli eventi hanno una rotta sola, con l'azione nel corpo. */
      if (p.evento) {
        const res = await fetch(`/api/admin/events/moderate?token=${encodeURIComponent(p.evento.token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: p.evento.token, azione: azione === 'approva' ? 'approve' : 'reject' }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || j.ok === false) throw new Error(j.error ?? 'Non è andata.');
        setEsito({ ok: true, testo: j.messaggio ?? 'Fatto.' });
        return;
      }

      const rotta = azione === 'approva' ? '/api/admin/approve' : '/api/admin/reject';
      /* Il token viaggia nel corpo di una POST, non nell'indirizzo: è la
         differenza che impedisce a uno scanner di posta di decidere al posto
         tuo semplicemente aprendo il link. */
      const token = azione === 'approva' ? p.tokenApprova : p.tokenRifiuta;
      /* Il token va anche nell'indirizzo: il middleware guarda li' per capire
         che questa e' una moderazione da email e non richiedere la sessione
         admin. La firma la verifica comunque la rotta, leggendolo dal corpo. */
      const url = token ? `${rotta}?token=${encodeURIComponent(token)}` : rotta;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(token ? { token } : { spot_id: p.spotId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.ok === false) {
        throw new Error(j.error ?? 'Non è andata. Riprova dalla dashboard.');
      }
      setEsito({
        ok: true,
        testo: azione === 'approva'
          ? 'Approvato. È sulla mappa.'
          : 'Rifiutato. Il rider riceve una mail.',
      });
    } catch (e) {
      setEsito({ ok: false, testo: e instanceof Error ? e.message : 'Errore.' });
    } finally {
      setInCorso(null);
    }
  };

  return (
    <main style={{
      background: 'var(--black)', minHeight: '100dvh',
      maxWidth: 560, margin: '0 auto', padding: '0 0 40px',
    }}>
      <div style={{
        padding: '18px 20px 14px', borderBottom: '1px solid var(--gray-700)',
        fontFamily: mono, fontSize: 11, color: 'var(--gray-500)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
      }}>
        Moderazione {p.evento ? 'evento' : 'spot'}
      </div>

      {/* ── FOTO ── */}
      {p.foto.length > 0 && (
        <div style={{ position: 'relative', background: '#000' }}>
          <img
            src={p.foto[foto]}
            alt={p.nome}
            style={{ width: '100%', height: 'clamp(220px, 45vh, 380px)', objectFit: 'cover', display: 'block' }}
          />
          {p.foto.length > 1 && (
            <>
              <div style={{
                position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', gap: 5,
              }}>
                {p.foto.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setFoto(i)}
                    aria-label={`Foto ${i + 1}`}
                    style={{
                      width: i === foto ? 20 : 7, height: 7, borderRadius: 4, border: 'none',
                      background: i === foto ? 'var(--orange)' : 'rgba(255,255,255,0.45)',
                      cursor: 'pointer', padding: 0, transition: 'all .2s',
                    }}
                  />
                ))}
              </div>
              <div style={{
                position: 'absolute', top: 10, right: 12,
                fontFamily: mono, fontSize: 11, color: '#fff',
                background: 'rgba(0,0,0,0.6)', padding: '3px 9px', borderRadius: 10,
              }}>
                {foto + 1}/{p.foto.length}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── DATI ── */}
      <div style={{ padding: '18px 20px 0' }}>
        <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--gray-400)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {p.emoji} {p.tipo}{p.citta ? ` · ${p.citta}` : ''}
        </div>
        <h1 style={{ fontFamily: mono, fontSize: 24, color: 'var(--orange)', margin: '0 0 10px', lineHeight: 1.2 }}>
          {p.nome}
        </h1>
        {p.descrizione && (
          <p style={{ fontFamily: mono, fontSize: 13, color: 'var(--bone)', lineHeight: 1.6, margin: '0 0 12px' }}>
            {p.descrizione}
          </p>
        )}
        <div style={{ fontFamily: mono, fontSize: 12, color: 'var(--gray-500)', marginBottom: 4 }}>
          {p.autore ? <>Inviato da <span style={{ color: 'var(--bone)' }}>@{p.autore}</span></> : 'Autore sconosciuto'}
        </div>
        {!p.evento && <a
          href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`}
          target="_blank" rel="noopener noreferrer"
          style={{ fontFamily: mono, fontSize: 12, color: 'var(--orange)' }}
        >
          Vedi la posizione su Google Maps →
        </a>}
        {p.evento?.quando && (
          <div style={{ fontFamily: mono, fontSize: 12, color: 'var(--gray-400)' }}>
            📅 {new Date(p.evento.quando).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        )}
      </div>

      {/* ── ESITO / AZIONI ── */}
      <div style={{ padding: '22px 20px 0' }}>
        {esito ? (
          <div style={{
            padding: '16px 18px', borderRadius: 10,
            border: `1px solid ${esito.ok ? 'rgba(0,200,81,0.45)' : 'rgba(217,106,90,0.5)'}`,
            background: esito.ok ? 'rgba(0,200,81,0.08)' : 'rgba(217,106,90,0.08)',
            fontFamily: mono, fontSize: 14, color: esito.ok ? '#7fd18f' : '#e08c7e',
            textAlign: 'center',
          }}>
            {esito.testo}
            <div style={{ marginTop: 14 }}>
              <a href="/admin" style={{ fontSize: 12, color: 'var(--orange)' }}>
                Vai alla dashboard →
              </a>
            </div>
          </div>
        ) : giaDeciso ? (
          <div style={{
            padding: '16px 18px', borderRadius: 10,
            border: '1px solid var(--gray-700)', background: 'var(--gray-800)',
            fontFamily: mono, fontSize: 13, color: 'var(--gray-400)', textAlign: 'center',
          }}>
            Questo {p.evento ? 'evento' : 'spot'} è già stato {p.stato === 'approved' ? 'approvato' : 'deciso'}.
            {p.slug && (
              <div style={{ marginTop: 12 }}>
                <a href={`/map/spot/${p.slug}`} style={{ fontSize: 12, color: 'var(--orange)' }}>
                  Vedi lo spot →
                </a>
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => decidi('rifiuta')}
                disabled={inCorso !== null}
                style={{
                  flex: 1, padding: '15px', borderRadius: 10,
                  border: '1px solid var(--gray-600)', background: 'transparent',
                  color: 'var(--gray-400)', fontFamily: mono, fontSize: 14,
                  cursor: inCorso ? 'default' : 'pointer', opacity: inCorso ? 0.5 : 1,
                }}
              >
                {inCorso === 'rifiuta' ? '...' : 'Rifiuta'}
              </button>
              <button
                onClick={() => decidi('approva')}
                disabled={inCorso !== null}
                style={{
                  flex: 2, padding: '15px', borderRadius: 10, border: 'none',
                  background: 'var(--orange)', color: '#000',
                  fontFamily: mono, fontSize: 15, fontWeight: 700, letterSpacing: '0.04em',
                  cursor: inCorso ? 'default' : 'pointer', opacity: inCorso ? 0.6 : 1,
                }}
              >
                {inCorso === 'approva' ? 'ATTENDI...' : 'APPROVA'}
              </button>
            </div>
            <p style={{
              fontFamily: mono, fontSize: 11, color: 'var(--gray-600)',
              textAlign: 'center', lineHeight: 1.6, margin: '16px 0 0',
            }}>
              Niente viene deciso finché non tocchi un bottone.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
