'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TIPI_SPOT, CITTA_ITALIANE, SUPERFICI, DIFFICOLTA, CONDIZIONI } from '@/lib/constants';
import type { Spot, SpotType, SpotCondition } from '@/lib/types';

interface Props { spot: Spot }

export default function AdminEditClient({ spot: initial }: Props) {
  const router = useRouter();
  const [spot,    setSpot]    = useState(initial);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');
  const [newCond, setNewCond] = useState<SpotCondition>(initial.condition);

  const update = <K extends keyof Spot>(k: K, v: Spot[K]) => setSpot((s) => ({ ...s, [k]: v }));

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/edit-spot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: spot.id,
          name: spot.name, type: spot.type, city: spot.city,
          description: spot.description, surface: spot.surface,
          wax_needed: spot.wax_needed, guardians: spot.guardians,
          difficulty: spot.difficulty, youtube_url: spot.youtube_url,
        }),
      });
      const json = await res.json();
      if (json.ok) { setMsg('✅ Salvato!'); }
      else setMsg('❌ Errore: ' + json.error);
    } catch { setMsg('❌ Errore di rete'); }
    finally { setSaving(false); }
  }, [spot]);

  const handleUpdateCondition = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spot_id: spot.id, condition: newCond }),
      });
      const json = await res.json();
      if (json.ok) { setMsg('✅ Condizione aggiornata!'); update('condition', newCond); }
      else setMsg('❌ ' + json.error);
    } catch { setMsg('❌ Errore'); }
    finally { setSaving(false); }
  }, [spot.id, newCond]);

  const input = (label: string, key: keyof Spot, type: string = 'text', placeholder: string = '') => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        {label}
      </label>
      <input
        type={type}
        className="input-vhs"
        value={(spot[key] as string) ?? ''}
        onChange={(e) => update(key, e.target.value as Spot[typeof key])}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div style={{ background: 'var(--black)', minHeight: '100dvh', padding: '0 0 60px' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0,
        background: 'rgba(10,10,10,0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--gray-700)',
        padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
        zIndex: 30,
      }}>
        <button onClick={() => router.back()} className="btn-ghost" style={{ fontSize: 18 }}>←</button>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--orange)', flex: 1 }}>
          EDIT: {spot.name}
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ padding: '8px 16px', fontSize: 14 }}>
          {saving ? '...' : 'SALVA'}
        </button>
      </div>

      <div style={{ padding: '20px 20px 0' }}>
        {msg && (
          <div style={{ padding: '10px 14px', background: 'var(--gray-800)', border: '1px solid var(--gray-600)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)', marginBottom: 20 }}>
            {msg}
          </div>
        )}

        {input('Nome spot', 'name')}

        {/* Tipo */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Tipo</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(Object.entries(TIPI_SPOT) as [SpotType, typeof TIPI_SPOT[SpotType]][]).map(([type, info]) => (
              <button key={type} onClick={() => update('type', type)}
                style={{ padding: '5px 10px', border: `1px solid ${spot.type === type ? info.color : 'var(--gray-600)'}`, borderRadius: 2, background: spot.type === type ? info.color : 'transparent', color: spot.type === type ? '#000' : 'var(--bone)', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer' }}>
                {info.emoji} {info.label}
              </button>
            ))}
          </div>
        </div>

        {/* Città */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Città</label>
          <select className="input-vhs" value={spot.city ?? ''} onChange={(e) => update('city', e.target.value)}>
            <option value="">—</option>
            {CITTA_ITALIANE.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {/* Descrizione */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Descrizione</label>
          <textarea className="input-vhs" value={spot.description ?? ''} onChange={(e) => update('description', e.target.value)} rows={3} style={{ resize: 'vertical' }} />
        </div>

        {input('Superficie', 'surface', 'text', 'asfalto, marmo...')}
        {input('Note accesso', 'guardians', 'text', 'guardiani, orari...')}
        {input('YouTube URL', 'youtube_url', 'url', 'https://youtube.com/...')}

        {/* Difficoltà */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Difficoltà</label>
          <select className="input-vhs" value={spot.difficulty ?? ''} onChange={(e) => update('difficulty', e.target.value)}>
            <option value="">—</option>
            {DIFFICOLTA.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>

        {/* Cera */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 24 }}>
          <input type="checkbox" checked={spot.wax_needed} onChange={(e) => update('wax_needed', e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--orange)' }} />
          <span style={{ color: 'var(--bone)', fontSize: 15 }}>🕯️ Necessita cera</span>
        </label>

        {/* Aggiorna condizione */}
        <div style={{ background: 'var(--gray-800)', border: '1px solid var(--gray-700)', borderRadius: 4, padding: 16, marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Aggiorna condizione</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {(Object.entries(CONDIZIONI) as [SpotCondition, typeof CONDIZIONI[SpotCondition]][]).map(([cond, info]) => (
              <button key={cond} onClick={() => setNewCond(cond)}
                style={{ flex: 1, padding: '10px 4px', border: `1px solid ${newCond === cond ? info.bg : 'var(--gray-600)'}`, borderRadius: 2, background: newCond === cond ? info.bg : 'transparent', color: newCond === cond ? info.color : 'var(--bone)', fontFamily: 'var(--font-mono)', fontSize: 13, cursor: 'pointer', textTransform: 'uppercase' }}>
                {info.label}
              </button>
            ))}
          </div>
          <button onClick={handleUpdateCondition} disabled={saving || newCond === spot.condition} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', opacity: newCond === spot.condition ? 0.4 : 1 }}>
            Aggiorna condizione
          </button>
        </div>

        {/* GPS */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', marginBottom: 8 }}>
          GPS: {spot.lat.toFixed(6)}, {spot.lon.toFixed(6)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginBottom: 4 }}>LAT</label>
            <input type="number" step="0.000001" className="input-vhs" value={spot.lat} onChange={(e) => update('lat', parseFloat(e.target.value))} />
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginBottom: 4 }}>LON</label>
            <input type="number" step="0.000001" className="input-vhs" value={spot.lon} onChange={(e) => update('lon', parseFloat(e.target.value))} />
          </div>
        </div>
      </div>
    </div>
  );
}
