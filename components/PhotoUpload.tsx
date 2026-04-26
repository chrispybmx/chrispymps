'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { APP_CONFIG } from '@/lib/constants';

interface PhotoUploadProps {
  photos:     File[];
  onChange:   (photos: File[]) => void;
  maxPhotos?: number;
}

const MAX_SIZE_MB = 5;
const ACCEPTED    = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

export default function PhotoUpload({ photos, onChange, maxPhotos = APP_CONFIG.maxPhotos }: PhotoUploadProps) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef  = useRef<HTMLInputElement>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // BUG-FIX: cache degli object URL per evitare memory leak.
  // URL.createObjectURL inline nel JSX crea un nuovo blob URL ad ogni render
  // e quei blob non vengono mai revocati. Con questo ref li creiamo una volta
  // sola per File e li revochiamo quando la foto viene rimossa.
  const objectUrlsRef = useRef<Map<File, string>>(new Map());

  const getObjectUrl = useCallback((file: File): string => {
    if (!objectUrlsRef.current.has(file)) {
      objectUrlsRef.current.set(file, URL.createObjectURL(file));
    }
    return objectUrlsRef.current.get(file)!;
  }, []);

  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    setError(null);
    const arr = Array.from(files);
    const valid: File[] = [];
    for (const f of arr) {
      if (!ACCEPTED.includes(f.type)) {
        setError(`Formato non supportato: ${f.name}. Usa JPG, PNG, WebP o HEIC.`);
        continue;
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`${f.name} supera ${MAX_SIZE_MB}MB.`);
        continue;
      }
      valid.push(f);
    }
    const updated = [...photos, ...valid].slice(0, maxPhotos);
    onChange(updated);
  }, [photos, onChange, maxPhotos]);

  const removePhoto = useCallback((idx: number) => {
    const removed = photos[idx];
    if (removed) {
      const url = objectUrlsRef.current.get(removed);
      if (url) {
        URL.revokeObjectURL(url);
        objectUrlsRef.current.delete(removed);
      }
    }
    onChange(photos.filter((_, i) => i !== idx));
  }, [photos, onChange]);

  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop      = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); };

  const remaining = maxPhotos - photos.length;

  return (
    <div>
      {/* Preview foto selezionate */}
      {photos.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {photos.map((file, idx) => (
            <div key={idx} style={{
              position: 'relative', width: 80, height: 80, borderRadius: 4, overflow: 'hidden',
              border: idx === 0 ? '2px solid var(--orange)' : '1px solid var(--gray-600)',
            }}>
              <img src={getObjectUrl(file)} alt={`Foto ${idx + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {idx === 0 && (
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'rgba(255,106,0,0.85)', fontFamily: 'var(--font-mono)',
                  fontSize: 10, textAlign: 'center', color: '#000', padding: '2px 0',
                }}>COVER</div>
              )}
              <button onClick={() => removePhoto(idx)} style={{
                position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)',
                border: 'none', color: '#fff', width: 20, height: 20, borderRadius: '50%',
                cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }} aria-label={`Rimuovi foto ${idx + 1}`}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Slot disponibili */}
      {remaining > 0 && (
        isMobile ? (
          /* ── MOBILE: due bottoni separati ── */
          <div style={{ display: 'flex', gap: 10 }}>
            {/* Scatta foto */}
            <button
              onClick={() => cameraRef.current?.click()}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 6, padding: '18px 10px',
                background: 'var(--gray-700)', border: '2px solid var(--gray-600)',
                borderRadius: 8, cursor: 'pointer', transition: 'border-color 0.15s',
              }}
              onTouchStart={e => (e.currentTarget.style.borderColor = 'var(--orange)')}
              onTouchEnd={e => (e.currentTarget.style.borderColor = 'var(--gray-600)')}
            >
              <span style={{ fontSize: 30 }}>📸</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)', textAlign: 'center' }}>
                Scatta foto
              </span>
            </button>

            {/* Scegli dalla galleria */}
            <button
              onClick={() => galleryRef.current?.click()}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 6, padding: '18px 10px',
                background: 'var(--gray-700)', border: '2px solid var(--gray-600)',
                borderRadius: 8, cursor: 'pointer', transition: 'border-color 0.15s',
              }}
              onTouchStart={e => (e.currentTarget.style.borderColor = 'var(--orange)')}
              onTouchEnd={e => (e.currentTarget.style.borderColor = 'var(--gray-600)')}
            >
              <span style={{ fontSize: 30 }}>🖼️</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)', textAlign: 'center' }}>
                Galleria
              </span>
            </button>
          </div>
        ) : (
          /* ── DESKTOP: drag & drop zone ── */
          <div
            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            onClick={() => galleryRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--orange)' : 'var(--gray-600)'}`,
              borderRadius: 4, padding: '20px 16px', textAlign: 'center', cursor: 'pointer',
              background: dragging ? 'rgba(255,106,0,0.05)' : 'var(--gray-800)',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') galleryRef.current?.click(); }}
          >
            <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)' }}>
              Clicca o trascina una foto
            </div>
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>
              {photos.length === 0 ? 'Prima foto = cover' : `${remaining} slot rimasti`}
              {' · '}JPG/PNG/WebP/HEIC · max {MAX_SIZE_MB}MB
            </div>
          </div>
        )
      )}

      {/* Info slot rimasti su mobile (dopo la prima foto) */}
      {isMobile && remaining > 0 && photos.length > 0 && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', textAlign: 'center', marginTop: 6 }}>
          {remaining} slot rimasti · max {maxPhotos} foto
        </div>
      )}

      {remaining === 0 && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', textAlign: 'center' }}>
          Massimo {maxPhotos} foto raggiunto
        </div>
      )}

      {/* Input galleria (senza capture → apre la libreria foto) */}
      <input ref={galleryRef} type="file" accept={ACCEPTED.join(',')} multiple
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
        aria-hidden="true" />

      {/* Input camera (capture=environment → apre direttamente la fotocamera) */}
      <input ref={cameraRef} type="file" accept={ACCEPTED.join(',')}
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
        aria-hidden="true" />

      {error && (
        <p style={{ color: 'var(--orange)', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 6 }}>
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
