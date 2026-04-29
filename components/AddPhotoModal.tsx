'use client';

import { useState, useCallback } from 'react';
import { useUser } from '@/hooks/useUser';
import { useToast } from './Toast';
import PhotoUpload from './PhotoUpload';

interface AddPhotoModalProps {
  open: boolean;
  onClose: () => void;
  spotId: string;
  spotName: string;
}

export default function AddPhotoModal({ open, onClose, spotId, spotName }: AddPhotoModalProps) {
  const user = useUser();
  const { toast } = useToast();
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!user || photos.length === 0) return;
    setSubmitting(true);

    try {
      const fd = new FormData();
      fd.append('spot_id', spotId);
      fd.append('access_token', user.accessToken);
      photos.forEach((p, i) => fd.append(`photo_${i}`, p));

      const res = await fetch('/api/spot-photos', { method: 'POST', body: fd });
      const json = await res.json();

      if (json.ok) {
        setDone(true);
        toast(json.message || 'Foto caricate!', 'success');
        setTimeout(() => {
          setDone(false);
          setPhotos([]);
          onClose();
        }, 2000);
      } else {
        toast(json.error || 'Errore upload', 'error');
      }
    } catch {
      toast('Errore di rete. Riprova.', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [user, photos, spotId, toast, onClose]);

  const handleClose = () => {
    setPhotos([]);
    setDone(false);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div onClick={handleClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 69, backdropFilter: 'blur(4px)' }}
      />

      <div role="dialog" aria-modal aria-label="Aggiungi foto allo spot" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--gray-800)', borderTop: '2px solid var(--orange)',
        borderRadius: '16px 16px 0 0', zIndex: 70,
        maxHeight: '85dvh', overflowY: 'auto', overscrollBehavior: 'contain',
        animation: 'slideUp 0.3s ease-out',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
      }}>
        <div className="bottom-sheet-handle" />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px 14px',
          borderBottom: '1px solid var(--gray-700)',
        }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--orange)', margin: 0 }}>
              📸 AGGIUNGI FOTO
            </h2>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
              {spotName}
            </div>
          </div>
          <button onClick={handleClose} className="btn-ghost" aria-label="Chiudi" style={{ fontSize: 20 }}>✕</button>
        </div>

        <div style={{ padding: '20px' }}>

          {done ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: '#00c851', marginBottom: 8 }}>
                FOTO IN REVISIONE
              </div>
              <p style={{ color: 'var(--gray-400)', fontSize: 14, lineHeight: 1.6 }}>
                Le tue foto appariranno dopo l'approvazione.
              </p>
            </div>
          ) : !user ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔑</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)' }}>
                Accedi per aggiungere foto
              </div>
            </div>
          ) : (
            <>
              <p style={{
                color: 'var(--gray-400)', fontSize: 13, lineHeight: 1.6,
                margin: '0 0 16px', fontFamily: 'var(--font-mono)',
              }}>
                Carica foto dello spot. Max 3 per volta.
                Foto utili: angolazioni chiare, condizione attuale, ostacoli.
              </p>

              <PhotoUpload photos={photos} onChange={setPhotos} />

              <div style={{ marginTop: 16 }}>
                <button
                  onClick={handleSubmit}
                  disabled={photos.length === 0 || submitting}
                  className="btn-primary"
                  style={{
                    width: '100%', justifyContent: 'center',
                    opacity: (photos.length === 0 || submitting) ? 0.4 : 1,
                  }}
                >
                  {submitting ? '⏳ CARICAMENTO...' : `📸 CARICA ${photos.length || ''} FOTO`}
                </button>
              </div>

              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: 'var(--gray-500)', marginTop: 10, textAlign: 'center',
              }}>
                Le foto saranno visibili dopo l'approvazione
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
