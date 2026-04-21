'use client';

import { useState, useCallback } from 'react';
import { TIPI_SPOT } from '@/lib/constants';
import type { SpotType } from '@/lib/types';

interface ParsedSpot {
  name:        string;
  lat:         number;
  lon:         number;
  description: string;
  folder:      string;
  type:        SpotType;
  enabled:     boolean;
}

interface Props {
  onImportDone: (count: number) => void;
}

const SPOT_TYPES = Object.entries(TIPI_SPOT) as [SpotType, typeof TIPI_SPOT[SpotType]][];

// Mappa automatica folder-name → tipo spot (best guess)
function guessType(folder: string, name: string): SpotType {
  const t = (folder + ' ' + name).toLowerCase();
  if (t.includes('park') || t.includes('skate'))    return 'park';
  if (t.includes('bowl'))                            return 'bowl';
  if (t.includes('rail') || t.includes('ledge'))    return 'ledge';
  if (t.includes('diy'))                             return 'diy';
  if (t.includes('trail') || t.includes('dirt'))    return 'trail';
  if (t.includes('plaza'))                           return 'plaza';
  if (t.includes('gap'))                             return 'gap';
  return 'street';
}

function parseKML(xml: string): ParsedSpot[] {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(xml, 'text/xml');
  const spots: ParsedSpot[] = [];

  const getFolderName = (el: Element): string => {
    let parent = el.parentElement;
    while (parent) {
      if (parent.tagName === 'Folder') {
        const nameEl = parent.querySelector(':scope > name');
        if (nameEl) return nameEl.textContent?.trim() ?? '';
      }
      parent = parent.parentElement;
    }
    return '';
  };

  doc.querySelectorAll('Placemark').forEach(pm => {
    const name   = pm.querySelector('name')?.textContent?.trim() ?? 'Spot senza nome';
    const desc   = pm.querySelector('description')?.textContent?.trim() ?? '';
    const coords = pm.querySelector('Point > coordinates')?.textContent?.trim();
    const folder = getFolderName(pm);

    if (!coords) return;

    const [lonStr, latStr] = coords.split(',');
    const lon = parseFloat(lonStr);
    const lat = parseFloat(latStr);

    if (isNaN(lat) || isNaN(lon)) return;
    // Filtra punti fuori dall'Italia (bbox approssimativa)
    if (lat < 35 || lat > 48 || lon < 6 || lon > 19) return;

    spots.push({
      name, description: desc, lat, lon, folder,
      type: guessType(folder, name),
      enabled: true,
    });
  });

  return spots;
}

export default function AdminImportKML({ onImportDone }: Props) {
  const [spots,      setSpots]     = useState<ParsedSpot[]>([]);
  const [importing,  setImporting] = useState(false);
  const [dragOver,   setDragOver]  = useState(false);
  const [msg,        setMsg]       = useState('');
  const [step,       setStep]      = useState<'upload' | 'preview' | 'done'>('upload');

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseKML(text);
      if (parsed.length === 0) {
        setMsg('⚠ Nessun Placemark trovato nel file. Assicurati di esportare correttamente da Google My Maps.');
        return;
      }
      setSpots(parsed);
      setStep('preview');
      setMsg('');
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.kml') || file.name.endsWith('.kmz'))) handleFile(file);
    else setMsg('⚠ Carica un file .kml esportato da Google My Maps');
  }, [handleFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const toggleSpot = (i: number) => {
    setSpots(prev => prev.map((s, idx) => idx === i ? { ...s, enabled: !s.enabled } : s));
  };

  const updateType = (i: number, type: SpotType) => {
    setSpots(prev => prev.map((s, idx) => idx === i ? { ...s, type } : s));
  };

  const handleImport = async () => {
    const toImport = spots.filter(s => s.enabled);
    if (toImport.length === 0) { setMsg('⚠ Seleziona almeno uno spot da importare'); return; }

    setImporting(true);
    setMsg('');

    try {
      const res  = await fetch('/api/admin/import-spots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spots: toImport.map(s => ({
          name: s.name, lat: s.lat, lon: s.lon,
          description: s.description, type: s.type,
        })) }),
      });
      const json = await res.json();
      if (json.ok) {
        setStep('done');
        onImportDone(json.imported);
      } else {
        setMsg('❌ Errore: ' + json.error);
      }
    } catch {
      setMsg('❌ Errore di rete');
    } finally {
      setImporting(false);
    }
  };

  const enabledCount = spots.filter(s => s.enabled).length;

  /* ── STEP: UPLOAD ── */
  if (step === 'upload') return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--orange)', marginBottom: 8 }}>
        📥 Importa da Google My Maps
      </div>
      <p style={{ color: 'var(--gray-400)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
        Hai già una mappa Google con i tuoi spot? Esportala e importa tutto in un colpo.
      </p>

      {/* Guida passo-passo */}
      <div style={{ background: 'var(--gray-800)', border: '1px solid var(--gray-700)', borderRadius: 8, padding: '16px', marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          Come esportare da Google My Maps
        </div>
        {[
          'Vai su maps.google.com/maps/d',
          'Apri la tua mappa con gli spot',
          'Menu (⋮) → Esporta in KML/KMZ',
          'Seleziona "Tutta la mappa"',
          'Scarica il file .kml',
          'Caricalo qui sotto',
        ].map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--orange)', minWidth: 20 }}>{i + 1}.</span>
            <span style={{ color: 'var(--bone)', fontSize: 14 }}>{step}</span>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragOver ? 'var(--orange)' : 'var(--gray-600)'}`,
          borderRadius: 10,
          padding: '40px 20px',
          textAlign: 'center',
          background: dragOver ? 'rgba(255,106,0,0.06)' : 'var(--gray-800)',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 10 }}>📂</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--bone)', marginBottom: 6 }}>
          {dragOver ? 'Rilascia il file!' : 'Trascina il file .kml qui'}
        </div>
        <div style={{ color: 'var(--gray-400)', fontSize: 13, marginBottom: 16 }}>oppure</div>
        <label style={{ cursor: 'pointer' }}>
          <span className="btn-primary" style={{ display: 'inline-flex' }}>Scegli file .kml</span>
          <input type="file" accept=".kml,.kmz" onChange={onFileChange} style={{ display: 'none' }} />
        </label>
      </div>

      {msg && <div style={{ marginTop: 12, color: 'var(--orange)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{msg}</div>}
    </div>
  );

  /* ── STEP: PREVIEW ── */
  if (step === 'preview') return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--orange)' }}>
            {spots.length} spot trovati
          </div>
          <div style={{ color: 'var(--gray-400)', fontSize: 13, marginTop: 2 }}>
            {enabledCount} selezionati da importare
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setSpots(p => p.map(s => ({ ...s, enabled: true })))} className="btn-ghost" style={{ fontSize: 13 }}>
            Tutti
          </button>
          <button onClick={() => setSpots(p => p.map(s => ({ ...s, enabled: false })))} className="btn-ghost" style={{ fontSize: 13 }}>
            Nessuno
          </button>
        </div>
      </div>

      {/* Lista spot */}
      <div style={{ maxHeight: '55vh', overflowY: 'auto', marginBottom: 16 }}>
        {spots.map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', marginBottom: 4,
            background: s.enabled ? 'var(--gray-800)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${s.enabled ? 'var(--gray-600)' : 'var(--gray-700)'}`,
            borderRadius: 6, opacity: s.enabled ? 1 : 0.5,
          }}>
            <input type="checkbox" checked={s.enabled} onChange={() => toggleSpot(i)}
              style={{ width: 18, height: 18, accentColor: 'var(--orange)', flexShrink: 0 }} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.name}
              </div>
              {s.folder && (
                <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>📁 {s.folder}</div>
              )}
              <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                {s.lat.toFixed(5)}, {s.lon.toFixed(5)}
              </div>
            </div>

            {/* Tipo selector */}
            <select
              value={s.type}
              onChange={e => updateType(i, e.target.value as SpotType)}
              style={{
                background: 'var(--gray-700)', border: '1px solid var(--gray-600)',
                borderRadius: 4, color: 'var(--bone)', fontSize: 12,
                padding: '4px 6px', fontFamily: 'var(--font-mono)', cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {SPOT_TYPES.map(([type, info]) => (
                <option key={type} value={type}>{info.emoji} {info.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {msg && <div style={{ marginBottom: 10, color: 'var(--orange)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => { setStep('upload'); setSpots([]); }} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
          ← Ricarica file
        </button>
        <button
          onClick={handleImport}
          disabled={importing || enabledCount === 0}
          className="btn-primary"
          style={{ flex: 2, justifyContent: 'center', opacity: (importing || enabledCount === 0) ? 0.5 : 1 }}
        >
          {importing ? '⏳ Importo...' : `🏴 IMPORTA ${enabledCount} SPOT`}
        </button>
      </div>
    </div>
  );

  /* ── STEP: DONE ── */
  return (
    <div style={{ textAlign: 'center', paddingTop: 40 }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--orange)', marginBottom: 8 }}>
        Import completato!
      </div>
      <p style={{ color: 'var(--bone)', fontSize: 15, lineHeight: 1.5 }}>
        Tutti gli spot sono stati importati come approvati<br />e sono già visibili sulla mappa.
      </p>
    </div>
  );
}
