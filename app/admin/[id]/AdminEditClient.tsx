'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TIPI_SPOT, CITTA_ITALIANE, CONDIZIONI, DIFFICOLTA, SUPERFICI } from '@/lib/constants';
import type { Spot, SpotType, SpotCondition, SpotPhoto } from '@/lib/types';
import { compressImage } from '@/lib/compress-image';

interface Props { spot: Spot }

export default function AdminEditClient({ spot: initial }: Props) {
  const router = useRouter();
  const [spot,    setSpot]    = useState(initial);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');
  const [newCond, setNewCond] = useState<SpotCondition>(initial.condition);
  const [photos,  setPhotos]  = useState<SpotPhoto[]>(initial.spot_photos ?? []);
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [tags,    setTags]    = useState<string>((initial as Spot & { tags?: string }).tags ?? '');
  const [activeTab, setActiveTab] = useState<'dati' | 'foto' | 'condizione'>('dati');

  const update = <K extends keyof Spot>(k: K, v: Spot[K]) => setSpot((s) => ({ ...s, [k]: v }));
  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/edit-spot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: spot.id,
          name: spot.name, type: spot.type, city: spot.city,
          description: spot.description, guardians: spot.guardians,
          youtube_url: spot.youtube_url, lat: spot.lat, lon: spot.lon,
          difficulty: spot.difficulty || null,
          surface: spot.surface || null,
          tags: tags || null,
        }),
      });
      const json = await res.json();
      if (json.ok) showMsg('✅ Salvato!');
      else         showMsg('❌ ' + json.error);
    } catch { showMsg('❌ Errore di rete'); }
    finally { setSaving(false); }
  }, [spot, tags]);

  const handleUpdateCondition = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spot_id: spot.id, condition: newCond }),
      });
      const json = await res.json();
      if (json.ok) { showMsg('✅ Condizione aggiornata!'); update('condition', newCond); }
      else         { showMsg('❌ ' + json.error); }
    } catch { showMsg('❌ Errore'); }
    finally { setSaving(false); }
  }, [spot.id, newCond]);

  const handleDeletePhoto = useCallback(async (photo: SpotPhoto) => {
    if (!window.confirm(`Eliminare questa foto?`)) return;
    setDeletingPhoto(photo.id);
    try {
      const res = await fetch('/api/admin/delete-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_id: photo.id, url: photo.url }),
      });
      const json = await res.json();
      if (json.ok) { setPhotos(p => p.filter(x => x.id !== photo.id)); showMsg('🗑️ Foto eliminata.'); }
      else         { showMsg('❌ ' + json.error); }
    } catch { showMsg('❌ Errore'); }
    finally { setDeletingPhoto(null); }
  }, []);

  const handleUploadPhotos = useCallback(async (files: FileList) => {
    if (!files.length) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('spot_id', spot.id);
      /* Comprimi ogni foto prima dell'upload (iPhone = ~9MB → ~600KB) */
      const compressed = await Promise.all(
        Array.from(files).slice(0, 5).map(f => compressImage(f))
      );
      compressed.forEach((f, i) => fd.append(`photo_${i}`, f));
      const res  = await fetch('/api/admin/upload-photo', { method: 'POST', body: fd });
      const json = await res.json();
      if (json.ok) {
        // Ricarica le foto aggiornate
        const { data } = await fetch(`/api/spots/${spot.slug}`).then(r => r.json());
        if (data?.spot_photos) setPhotos(data.spot_photos);
        else {
          // fallback: aggiungi le URL alle foto esistenti
          const newPhotos = json.urls.map((url: string, i: number) => ({
            id: `new_${Date.now()}_${i}`, spot_id: spot.id, url,
            position: photos.length + i, created_at: new Date().toISOString(),
          }));
          setPhotos(p => [...p, ...newPhotos]);
        }
        showMsg(`✅ ${json.urls.length} foto caricate!`);
      } else {
        showMsg('❌ ' + json.error);
      }
    } catch { showMsg('❌ Errore upload'); }
    finally { setUploadingPhoto(false); }
  }, [spot.id, spot.slug, photos.length]);

  const handleDelete = async () => {
    if (!window.confirm(`Eliminare definitivamente "${spot.name}"?\nQuesta azione non può essere annullata.`)) return;
    setSaving(true);
    try {
      const res  = await fetch('/api/admin/delete-spot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spot_id: spot.id }) });
      const json = await res.json();
      if (json.ok) router.push('/admin');
      else         showMsg('❌ ' + json.error);
    } catch { showMsg('❌ Errore'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ background: 'var(--black)', minHeight: '100dvh', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0,
        background: 'rgba(10,10,10,0.97)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--gray-700)',
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        zIndex: 30,
      }}>
        <button onClick={() => router.back()} className="btn-ghost" style={{ fontSize: 18, padding: '6px 10px' }}>←</button>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--orange)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          ✏️ {spot.name}
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ padding: '8px 16px', fontSize: 14 }}>
          {saving ? '...' : '💾 SALVA'}
        </button>
      </div>

      {/* Msg */}
      {msg && (
        <div style={{ margin: '10px 16px', padding: '10px 14px', background: 'var(--gray-800)', border: '1px solid var(--gray-600)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)' }}>
          {msg}
        </div>
      )}

      {/* Sub-tabs */}
      <div style={{ display: 'flex', padding: '0 16px', gap: 4, borderBottom: '1px solid var(--gray-700)', background: 'var(--gray-800)' }}>
        {(['dati', 'foto', 'condizione'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            fontFamily: 'var(--font-mono)', fontSize: 13,
            padding: '8px 14px',
            border: 'none', borderBottom: `2px solid ${activeTab === t ? 'var(--orange)' : 'transparent'}`,
            background: 'none', color: activeTab === t ? 'var(--orange)' : 'var(--gray-400)',
            cursor: 'pointer', textTransform: 'uppercase',
          }}>
            {t === 'dati' ? '📝 Dati' : t === 'foto' ? `📸 Foto (${photos.length})` : '🔄 Condizione'}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px' }}>

        {/* ── TAB DATI ── */}
        {activeTab === 'dati' && (
          <>
            <Field label="Nome spot">
              <input type="text" className="input-vhs" value={spot.name ?? ''} onChange={e => update('name', e.target.value)} />
            </Field>

            <Field label="Tipo spot">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(Object.entries(TIPI_SPOT) as [SpotType, typeof TIPI_SPOT[SpotType]][]).map(([type, info]) => (
                  <button key={type} onClick={() => update('type', type)} style={{
                    padding: '5px 10px',
                    border: `1px solid ${spot.type === type ? info.color : 'var(--gray-600)'}`,
                    borderRadius: 2,
                    background: spot.type === type ? info.color : 'transparent',
                    color: spot.type === type ? '#000' : 'var(--bone)',
                    fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer',
                  }}>
                    {info.emoji} {info.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Città">
              <select className="input-vhs" value={spot.city ?? ''} onChange={e => update('city', e.target.value)}>
                <option value="">—</option>
                {CITTA_ITALIANE.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>

            <Field label="Descrizione">
              <textarea className="input-vhs" value={spot.description ?? ''} onChange={e => update('description', e.target.value)} rows={3} style={{ resize: 'vertical' }} />
            </Field>

            <Field label="Note accesso (guardiani, orari)">
              <input type="text" className="input-vhs" value={spot.guardians ?? ''} onChange={e => update('guardians', e.target.value)} placeholder='es. "Libero di notte"' />
            </Field>

            <Field label="Livello difficoltà">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  onClick={() => update('difficulty', null)}
                  style={{
                    padding: '5px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer',
                    border: `1px solid ${!spot.difficulty ? 'var(--orange)' : 'var(--gray-600)'}`,
                    borderRadius: 2,
                    background: !spot.difficulty ? 'rgba(255,106,0,0.15)' : 'transparent',
                    color: !spot.difficulty ? 'var(--orange)' : 'var(--gray-400)',
                  }}
                >
                  —
                </button>
                {DIFFICOLTA.map(d => (
                  <button key={d.value} onClick={() => update('difficulty', d.value)} style={{
                    padding: '5px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer',
                    border: `1px solid ${spot.difficulty === d.value ? 'var(--orange)' : 'var(--gray-600)'}`,
                    borderRadius: 2,
                    background: spot.difficulty === d.value ? 'rgba(255,106,0,0.15)' : 'transparent',
                    color: spot.difficulty === d.value ? 'var(--orange)' : 'var(--bone)',
                    textTransform: 'uppercase',
                  }}>
                    {d.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Superficie">
              <select className="input-vhs" value={spot.surface ?? ''} onChange={e => update('surface', e.target.value || null)}>
                <option value="">—</option>
                {SUPERFICI.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="YouTube URL (video dello spot)">
              <input type="url" className="input-vhs" value={spot.youtube_url ?? ''} onChange={e => update('youtube_url', e.target.value)} placeholder="https://youtube.com/..." />
            </Field>

            <Field label="Hashtag / Tag (separati da virgola, solo admin)">
              <input
                type="text" className="input-vhs"
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="bmx, verona, street, classic..."
              />
              {tags && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                  {tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                    <span key={t} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '2px 8px', border: '1px solid var(--orange)', borderRadius: 10, color: 'var(--orange)' }}>
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </Field>

            {/* GPS */}
            <Field label="Coordinate GPS">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', display: 'block', marginBottom: 3 }}>LAT</label>
                  <input type="number" step="0.000001" className="input-vhs" value={spot.lat} onChange={e => update('lat', parseFloat(e.target.value))} />
                </div>
                <div>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', display: 'block', marginBottom: 3 }}>LON</label>
                  <input type="number" step="0.000001" className="input-vhs" value={spot.lon} onChange={e => update('lon', parseFloat(e.target.value))} />
                </div>
              </div>
              <a href={`https://www.google.com/maps?q=${spot.lat},${spot.lon}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-block', marginTop: 6, color: 'var(--orange)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                Verifica su Google Maps ↗
              </a>
            </Field>

            {/* Elimina spot */}
            <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--gray-700)' }}>
              <button onClick={handleDelete} disabled={saving} style={{
                width: '100%', padding: '12px', background: 'transparent',
                border: '1px solid #ff4444', borderRadius: 4, color: '#ff4444',
                fontFamily: 'var(--font-mono)', fontSize: 14, cursor: 'pointer',
              }}>
                🗑️ ELIMINA SPOT DEFINITIVAMENTE
              </button>
            </div>
          </>
        )}

        {/* ── TAB FOTO ── */}
        {activeTab === 'foto' && (
          <>
            {/* Upload zone */}
            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8, padding: '24px 16px',
              border: `2px dashed ${uploadingPhoto ? 'var(--orange)' : 'var(--gray-600)'}`,
              borderRadius: 8, cursor: uploadingPhoto ? 'wait' : 'pointer',
              background: uploadingPhoto ? 'rgba(255,106,0,0.06)' : 'var(--gray-700)',
              marginBottom: 16, transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: 32 }}>{uploadingPhoto ? '⏳' : '📸'}</span>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)', textAlign: 'center' }}>
                {uploadingPhoto ? 'Caricamento in corso...' : 'Clicca per aggiungere foto'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                JPG, PNG · max 5 foto alla volta
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={uploadingPhoto}
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.length) handleUploadPhotos(e.target.files); }}
              />
            </label>

            {/* Griglia foto esistenti */}
            {photos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--gray-400)', fontSize: 13 }}>
                  Nessuna foto ancora. Caricane una sopra.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {photos
                  .sort((a, b) => a.position - b.position)
                  .map((photo, i) => (
                  <div key={photo.id} style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--gray-700)' }}>
                    <img
                      src={photo.url}
                      alt={`Foto ${i + 1}`}
                      style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }}
                      loading="lazy"
                    />
                    {i === 0 && (
                      <div style={{ position: 'absolute', top: 6, left: 6, background: 'var(--orange)', color: '#000', fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 6px', borderRadius: 2 }}>
                        COVER
                      </div>
                    )}
                    <button
                      onClick={() => handleDeletePhoto(photo)}
                      disabled={deletingPhoto === photo.id}
                      style={{
                        position: 'absolute', top: 6, right: 6,
                        background: 'rgba(255,68,68,0.9)', border: 'none',
                        borderRadius: 4, color: '#fff', fontSize: 16,
                        width: 30, height: 30, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: deletingPhoto === photo.id ? 0.5 : 1,
                      }}
                      aria-label="Elimina foto"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── TAB CONDIZIONE ── */}
        {activeTab === 'condizione' && (
          <>
            <Field label="Condizione attuale">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {(Object.entries(CONDIZIONI) as [SpotCondition, typeof CONDIZIONI[SpotCondition]][]).map(([cond, info]) => (
                  <button key={cond} onClick={() => setNewCond(cond)} style={{
                    padding: '14px 8px', textAlign: 'center',
                    border: `2px solid ${newCond === cond ? info.bg : 'var(--gray-600)'}`,
                    borderRadius: 6,
                    background: newCond === cond ? info.bg : 'transparent',
                    color: newCond === cond ? info.color : 'var(--gray-400)',
                    fontFamily: 'var(--font-mono)', fontSize: 14, cursor: 'pointer',
                    textTransform: 'uppercase', transition: 'all 0.15s',
                  }}>
                    {info.label}
                  </button>
                ))}
              </div>
            </Field>

            <button
              onClick={handleUpdateCondition}
              disabled={saving || newCond === spot.condition}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8, opacity: (saving || newCond === spot.condition) ? 0.4 : 1 }}
            >
              {saving ? '...' : '🔄 Aggiorna condizione'}
            </button>

            <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--gray-800)', border: '1px solid var(--gray-700)', borderRadius: 4 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', marginBottom: 4 }}>Condizione corrente</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: CONDIZIONI[spot.condition].bg }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--bone)' }}>
                  {CONDIZIONI[spot.condition].label}
                </span>
              </div>
              {spot.condition_updated_at && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginTop: 6 }}>
                  Aggiornata: {new Date(spot.condition_updated_at).toLocaleString('it-IT')}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}
