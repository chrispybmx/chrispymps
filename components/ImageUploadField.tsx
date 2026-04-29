'use client';

import { useState, useRef } from 'react';

interface Props {
  label: string;
  value: string; // URL or empty
  onChange: (url: string) => void;
  accessToken: string;
  purpose: 'event' | 'news' | 'general';
}

/**
 * Image upload field: tap to pick file, uploads to /api/upload-image,
 * shows preview. Also supports pasting a URL directly.
 */
export default function ImageUploadField({ label, value, onChange, accessToken, purpose }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'upload' | 'url'>(value && value.startsWith('http') ? 'url' : 'upload');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { setError('Max 5MB'); return; }
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('access_token', accessToken);
      fd.append('purpose', purpose);
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const j = await res.json();
      if (j.ok) { onChange(j.url); }
      else { setError(j.error || 'Errore upload'); }
    } catch { setError('Errore di rete'); }
    finally { setUploading(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <label style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {label}
        </label>
        <button
          type="button"
          onClick={() => setMode(m => m === 'upload' ? 'url' : 'upload')}
          style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--orange)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          {mode === 'upload' ? '🔗 incolla URL' : '📷 carica foto'}
        </button>
      </div>

      {mode === 'upload' ? (
        <>
          {/* Preview */}
          {value && (
            <div style={{ marginBottom: 8, position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
              <img src={value} alt="Preview" style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
              <button
                onClick={() => onChange('')}
                style={{
                  position: 'absolute', top: 6, right: 6,
                  background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%',
                  width: 24, height: 24, color: '#fff', fontSize: 12, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            </div>
          )}

          {/* Upload button */}
          {!value && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              style={{
                width: '100%', padding: '20px', borderRadius: 8,
                border: '2px dashed var(--gray-600)',
                background: 'rgba(255,106,0,0.03)',
                color: uploading ? 'var(--gray-500)' : 'var(--orange)',
                fontFamily: 'var(--font-mono)', fontSize: 13,
                cursor: uploading ? 'default' : 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              }}
            >
              <span style={{ fontSize: 28 }}>{uploading ? '⏳' : '📷'}</span>
              {uploading ? 'Caricamento...' : 'Tocca per caricare foto'}
              <span style={{ fontSize: 10, color: 'var(--gray-500)' }}>JPEG, PNG, WebP · Max 5MB</span>
            </button>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          />
        </>
      ) : (
        /* URL mode */
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="https://..."
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--gray-700)', border: '1px solid var(--gray-600)',
            borderRadius: 6, color: 'var(--bone)', fontFamily: 'var(--font-mono)',
            fontSize: 14, padding: '10px 12px', outline: 'none',
          }}
        />
      )}

      {error && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff4444', marginTop: 4 }}>
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
