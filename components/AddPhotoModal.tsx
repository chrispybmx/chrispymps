'use client';

import { useState, useCallback, useRef } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import AuthModal from '@/components/AuthModal';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/components/Toast';
import PhotoUpload from '@/components/PhotoUpload';

interface AddPhotoModalProps {
  open: boolean;
  onClose: () => void;
  spotId: string;
  spotName: string;
}

export default function AddPhotoModal({ open, onClose, spotId, spotName }: AddPhotoModalProps) {
  const user = useUser();
  const { language, text } = useLanguage();
  const [authOpen, setAuthOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
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
        setPhotos([]);
        toast(text('Foto inviate alla revisione.', 'Photos sent for review.'), 'success');
      } else {
        toast(language === 'it' ? json.error || 'Errore durante il caricamento.' : 'Photo upload failed. Please try again.', 'error');
      }
    } catch {
      toast(text('Errore di rete. Riprova.', 'Network error. Please try again.'), 'error');
    } finally {
      setSubmitting(false);
    }
  }, [user, photos, spotId, toast, language, text]);

  const handleClose = () => {
    setAuthOpen(false);
    setPhotos([]);
    setDone(false);
    onClose();
  };

  useDialogFocus(open && !authOpen, dialogRef, handleClose);

  if (!open) return null;

  return (
    <>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onSuccess={() => setAuthOpen(false)} />
      <div onClick={handleClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 69, backdropFilter: 'none' }}
      />

      <div ref={dialogRef} role="dialog" aria-modal aria-label={text("Aggiungi foto allo spot", "Add spot photos")} style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--gray-800)', borderTop: '2px solid var(--orange)',
        borderRadius: '8px 8px 0 0', zIndex: 70,
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
              {text('Aggiungi foto', 'Add photos')}
            </h2>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)', marginTop: 2 }}>
              {spotName}
            </div>
          </div>
          <button onClick={handleClose} className="btn-ghost" aria-label={text("Chiudi", "Close")} style={{ fontSize: 20 }}>✕</button>
        </div>

        <div style={{ padding: '20px' }}>

          {done ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: '#00c851', marginBottom: 8 }}>
                {text('Foto in revisione', 'Photos under review')}
              </div>
              <p style={{ color: 'var(--gray-400)', fontSize: 14, lineHeight: 1.6 }}>
                {text('Le foto appariranno dopo l’approvazione.', 'Your photos will appear after approval.')}
              </p>
              <button className="btn-primary" onClick={handleClose}>{text('Torna allo spot', 'Back to the spot')}</button>
            </div>
          ) : !user ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--bone)' }}>
                {text('Accedi per aggiungere foto', 'Sign in to add photos')}
              </div>
              <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setAuthOpen(true)}>{text('Accedi', 'Sign in')}</button>
            </div>
          ) : (
            <>
              <p style={{
                color: 'var(--gray-400)', fontSize: 14, lineHeight: 1.6,
                margin: '0 0 16px', fontFamily: 'var(--font-mono)',
              }}>
                {text('Aggiungi fino a 3 foto. Mostra gli ostacoli, le condizioni attuali e una vista d’insieme.', 'Add up to 3 photos. Show the features, current conditions and an overview of the spot.')}
              </p>

              <PhotoUpload photos={photos} onChange={setPhotos} maxPhotos={3} />

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
                  {submitting ? text('Caricamento…', 'Uploading…') : photos.length ? text(`Invia ${photos.length} foto`, `Upload ${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`) : text('Seleziona le foto', 'Select photos')}
                </button>
              </div>

              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 14,
                color: 'var(--gray-500)', marginTop: 10, textAlign: 'center',
              }}>
                {text('Le foto saranno visibili dopo l’approvazione.', 'Photos become visible after approval.')}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
