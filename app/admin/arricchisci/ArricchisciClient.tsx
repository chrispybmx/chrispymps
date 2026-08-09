'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { TIPI_SPOT } from '@/lib/constants';
import type { SpotType } from '@/lib/types';

export interface SpotRow {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  type: SpotType;
  description: string;
  youtube_url: string;
  cover: string | null;
}

type Filtro = 'da-fare' | 'senza-descrizione' | 'senza-video' | 'tutti';

const MIN_DESC = 80; // sotto questa soglia la pagina resta troppo sottile per la SEO

const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--gray-700)', border: '1px solid var(--gray-600)',
  borderRadius: 4, color: 'var(--bone)', fontFamily: 'var(--font-mono)',
  fontSize: 14, padding: '8px 10px', outline: 'none',
};

export default function ArricchisciClient({ initialSpots }: { initialSpots: SpotRow[] }) {
  const [spots, setSpots] = useState(initialSpots);
  const [filtro, setFiltro] = useState<Filtro>('da-fare');
  const [saving, setSaving] = useState<string | null>(null);
  const [saved,  setSaved]  = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const descOk  = (s: SpotRow) => s.description.trim().length >= MIN_DESC;
  const videoOk = (s: SpotRow) => s.youtube_url.trim().length > 0;

  const lista = useMemo(() => {
    switch (filtro) {
      case 'senza-descrizione': return spots.filter(s => !descOk(s));
      case 'senza-video':       return spots.filter(s => !videoOk(s));
      case 'tutti':             return spots;
      default:                  return spots.filter(s => !descOk(s) || !videoOk(s));
    }
  }, [spots, filtro]);

  const stats = useMemo(() => ({
    tot:       spots.length,
    senzaDesc: spots.filter(s => !descOk(s)).length,
    senzaVid:  spots.filter(s => !videoOk(s)).length,
    completi:  spots.filter(s => descOk(s) && videoOk(s)).length,
  }), [spots]);

  const update = (id: string, patch: Partial<SpotRow>) => {
    setSpots(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
    setSaved(prev => ({ ...prev, [id]: false }));
  };

  const save = async (s: SpotRow) => {
    setSaving(s.id);
    setErrors(prev => ({ ...prev, [s.id]: '' }));
    try {
      const yt = s.youtube_url.trim();
      // youtube_url passa da z.string().url(): stringa vuota non e' valida, va null
      const res = await fetch('/api/admin/edit-spot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: s.id,
          description: s.description.trim() || null,
          youtube_url: yt || null,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? 'Errore salvataggio');
      setSaved(prev => ({ ...prev, [s.id]: true }));
    } catch (e) {
      setErrors(prev => ({ ...prev, [s.id]: e instanceof Error ? e.message : 'Errore' }));
    } finally {
      setSaving(null);
    }
  };

  return (
    <main style={{ background: 'var(--black)', minHeight: '100dvh', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(10,10,10,0.96)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--gray-700)', padding: '14px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--orange)', margin: 0 }}>
              ✍️ ARRICCHISCI SPOT
            </h1>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)', marginTop: 3 }}>
              descrizione + video = pagine che si posizionano su Google
            </div>
          </div>
          <Link href="/admin" style={{ color: 'var(--gray-400)', fontFamily: 'var(--font-mono)', fontSize: 13, textDecoration: 'none' }}>
            ← Admin
          </Link>
        </div>

        {/* Progresso */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 12 }}>
          <span style={{ color: '#00c851' }}>✓ completi {stats.completi}/{stats.tot}</span>
          <span style={{ color: '#ffce4d' }}>senza descrizione {stats.senzaDesc}</span>
          <span style={{ color: '#ff6b6b' }}>senza video {stats.senzaVid}</span>
        </div>
        <div style={{ height: 3, background: 'var(--gray-700)', borderRadius: 2, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{
            height: '100%', width: `${stats.tot ? (stats.completi / stats.tot) * 100 : 0}%`,
            background: 'var(--orange)', transition: 'width 0.3s ease-out',
          }} />
        </div>

        {/* Filtri */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([
            ['da-fare',           `Da fare (${spots.filter(s => !descOk(s) || !videoOk(s)).length})`],
            ['senza-descrizione', `Senza descrizione (${stats.senzaDesc})`],
            ['senza-video',       `Senza video (${stats.senzaVid})`],
            ['tutti',             `Tutti (${stats.tot})`],
          ] as [Filtro, string][]).map(([f, label]) => (
            <button key={f} onClick={() => setFiltro(f)} style={{
              padding: '6px 12px', borderRadius: 4,
              border: `1px solid ${filtro === f ? 'var(--orange)' : 'var(--gray-600)'}`,
              background: filtro === f ? 'rgba(255,106,0,0.15)' : 'transparent',
              color: filtro === f ? 'var(--orange)' : 'var(--gray-400)',
              fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer',
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '18px 16px', display: 'grid', gap: 14 }}>
        {lista.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', fontFamily: 'var(--font-mono)', color: 'var(--gray-500)' }}>
            🏴 Niente da fare qui. Bel lavoro.
          </div>
        )}

        {lista.map(s => {
          const tipo = TIPI_SPOT[s.type];
          const len  = s.description.trim().length;
          const isSaving = saving === s.id;
          return (
            <div key={s.id} style={{
              background: 'var(--gray-800)', border: '1px solid var(--gray-700)',
              borderRadius: 10, padding: 14,
            }}>
              {/* Testata spot */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
                  background: 'var(--gray-700)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {s.cover
                    ? <img src={s.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 22 }}>{tipo?.emoji ?? '🏴'}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--bone)' }}>{s.name}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>
                    {tipo?.emoji} {tipo?.label} · {s.city ?? 'senza città'}
                  </div>
                  <a href={`/map/spot/${s.slug}`} target="_blank" rel="noopener noreferrer"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--orange)' }}>
                    vedi pagina →
                  </a>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                  <span style={{ color: descOk(s) ? '#00c851' : '#ffce4d' }}>{descOk(s) ? '✓ testo' : '○ testo'}</span>
                  <span style={{ color: videoOk(s) ? '#00c851' : 'var(--gray-600)' }}>{videoOk(s) ? '✓ video' : '○ video'}</span>
                </div>
              </div>

              {/* Descrizione */}
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Descrizione — com&apos;è lo spot, il fondo, cosa ci puoi fare
              </label>
              <textarea
                value={s.description}
                onChange={e => update(s.id, { description: e.target.value.slice(0, 500) })}
                rows={2}
                placeholder="Es. Gradoni in marmo lisci, 4 scalini con rincorsa lunga. Fondo perfetto, security assente la domenica."
                style={{ ...inp, resize: 'vertical', marginTop: 4 }}
              />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: len >= MIN_DESC ? '#00c851' : '#ffce4d', marginTop: 2, marginBottom: 10 }}>
                {len}/500 {len < MIN_DESC && `— servono almeno ${MIN_DESC} caratteri perché la pagina abbia peso`}
              </div>

              {/* Video */}
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Video YouTube girato qui
              </label>
              <input
                type="url"
                value={s.youtube_url}
                onChange={e => update(s.id, { youtube_url: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
                style={{ ...inp, marginTop: 4, marginBottom: 10 }}
              />

              {errors[s.id] && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff4444', marginBottom: 8 }}>⚠ {errors[s.id]}</div>
              )}

              <button
                onClick={() => save(s)}
                disabled={isSaving}
                style={{
                  width: '100%', padding: '10px', borderRadius: 6, border: 'none',
                  background: saved[s.id] ? 'rgba(0,200,81,0.2)' : 'var(--orange)',
                  color: saved[s.id] ? '#00c851' : '#000',
                  fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                  cursor: isSaving ? 'default' : 'pointer', opacity: isSaving ? 0.6 : 1,
                }}>
                {isSaving ? '⏳ Salvo...' : saved[s.id] ? '✓ Salvato' : '💾 Salva'}
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
