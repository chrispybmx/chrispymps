'use client';

import { useEffect, useState } from 'react';
import { TIPI_SPOT, APP_CONFIG } from '@/lib/constants';
import type { SpotType } from '@/lib/types';
import { miniatura } from '@/lib/immagini';

interface SpotApprovato {
  id: string;
  name: string;
  slug: string;
  type: SpotType;
  city: string | null;
  approved_at: string | null;
  created_at: string;
  autore: string | null;
  cover: string | null;
  nFoto: number;
}

const mono = 'var(--font-mono)';

/** «oggi», «ieri», «3 giorni fa» — più leggibile di una data piena. */
function quando(iso: string | null): string {
  if (!iso) return '—';
  const giorni = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (giorni <= 0) return 'oggi';
  if (giorni === 1) return 'ieri';
  if (giorni < 30) return `${giorni} giorni fa`;
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Sezione «Approvati» della dashboard.
 *
 * Gli spot entrati sulla mappa, dal più recente, con il tasto per condividerli
 * subito. Un canale vive di pubblicazione: uno spot appena approvato è
 * materiale da mandare in giro finché è fresco, e prima di questa sezione non
 * c'era nessun posto dove vederli in ordine di ingresso.
 */
export default function AdminApprovati() {
  const [spot,    setSpot]    = useState<SpotApprovato[]>([]);
  const [caricando, setCaricando] = useState(true);
  const [copiato, setCopiato] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/approvati')
      .then(r => r.json())
      .then(j => { if (j.ok) setSpot(j.data ?? []); })
      .catch(() => {})
      .finally(() => setCaricando(false));
  }, []);

  const link = (s: SpotApprovato) => `${APP_CONFIG.url}/map/spot/${s.slug}`;

  const messaggio = (s: SpotApprovato) => {
    const tipo = TIPI_SPOT[s.type];
    const dove = s.city ? ` a ${s.city}` : '';
    const chi  = s.autore ? ` — grazie @${s.autore}` : '';
    return `Nuovo spot sulla mappa: ${s.name}${dove} ${tipo?.emoji ?? ''}${chi}\n${link(s)}`;
  };

  /* Condivisione nativa dove c'è (telefono), copia negli appunti altrove. */
  const condividi = async (s: SpotApprovato) => {
    const testo = messaggio(s);
    if (navigator.share) {
      try { await navigator.share({ title: s.name, text: testo, url: link(s) }); return; }
      catch { /* annullata: si ripiega sulla copia */ }
    }
    try {
      await navigator.clipboard.writeText(testo);
      setCopiato(s.id);
      setTimeout(() => setCopiato(null), 2000);
    } catch { /* niente appunti */ }
  };

  if (caricando) {
    return <div style={{ padding: 40, textAlign: 'center', fontFamily: mono, color: 'var(--gray-500)' }}>Caricamento...</div>;
  }

  if (spot.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', fontFamily: mono, color: 'var(--gray-500)' }}>Nessuno spot approvato.</div>;
  }

  return (
    <div style={{ padding: '16px 20px 0' }}>
      <div style={{ fontFamily: mono, fontSize: 13, color: 'var(--gray-400)', marginBottom: 16 }}>
        {spot.length} spot approvati, dal più recente
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {spot.map(s => {
          const tipo = TIPI_SPOT[s.type];
          return (
            <div key={s.id} style={{
              display: 'flex', gap: 12, alignItems: 'center',
              background: 'var(--gray-800)', border: '1px solid var(--gray-700)',
              borderRadius: 10, padding: 10,
            }}>
              {/* Copertina */}
              <div style={{
                width: 68, height: 68, flexShrink: 0, borderRadius: 8, overflow: 'hidden',
                background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {s.cover
                  ? <img src={miniatura(s.cover, 160)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  : <span style={{ fontSize: 24, opacity: 0.3 }}>{tipo?.emoji ?? '📍'}</span>}
              </div>

              {/* Dati */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <a
                  href={`/map/spot/${s.slug}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    fontFamily: mono, fontSize: 14, color: 'var(--bone)', textDecoration: 'none',
                    display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {s.name}
                </a>
                <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--gray-500)', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span>{tipo?.emoji} {tipo?.label ?? s.type}</span>
                  {s.city && <span>📍 {s.city}</span>}
                  <span>{s.nFoto} foto</span>
                </div>
                <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--gray-600)', marginTop: 2 }}>
                  {quando(s.approved_at)}{s.autore ? ` · @${s.autore}` : ''}
                </div>
              </div>

              {/* Condividi */}
              <button
                onClick={() => condividi(s)}
                style={{
                  flexShrink: 0, padding: '9px 13px', borderRadius: 8,
                  border: `1px solid ${copiato === s.id ? 'var(--orange)' : 'rgba(255,255,255,0.15)'}`,
                  background: copiato === s.id ? 'rgba(255,106,0,0.15)' : 'transparent',
                  color: copiato === s.id ? 'var(--orange)' : 'var(--bone)',
                  fontFamily: mono, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'all .15s',
                }}
              >
                {copiato === s.id ? '✓ copiato' : 'Condividi'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
