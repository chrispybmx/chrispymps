'use client';

import { useState } from 'react';
import type { SpotCondition } from '@/lib/types';
import AddPhotoModal from './AddPhotoModal';
import MapIcon from './MapIcon';
import { useLanguage } from './LanguageProvider';
import StatusConfirmModal from './StatusConfirmModal';

interface Props {
  spotId: string;
  spotName: string;
  currentCondition: SpotCondition;
  photoCount: number;
  streetViewCover?: boolean;
  lastConfirmedAt?: string;
}

export default function SpotContributeCTA({ spotId, spotName, currentCondition, photoCount, streetViewCover = false, lastConfirmedAt }: Props) {
  const { text, locale } = useLanguage();
  const [photoOpen, setPhotoOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const confirmedDate = lastConfirmedAt
    ? new Date(lastConfirmedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <>
      <div style={{
        display: 'flex', gap: 10, marginBottom: 24,
        flexWrap: 'wrap',
      }}>
        {/* ADD PHOTOS — primary CTA */}
        <button
          onClick={() => setPhotoOpen(true)}
          style={{
            flex: 1, minWidth: 150,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 16px',
            background: 'var(--gray-800)',
            color: 'var(--bone)',
            border: '1px solid var(--gray-600)', borderRadius: 6,
            fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
            letterSpacing: '0.04em', cursor: 'pointer',
            boxShadow: 'none',
            transition: 'transform 0.1s',
          }}
        >
          <MapIcon name="photo" /> {photoCount === 0 ? text('Aggiungi prima foto', 'Add the first photo') : streetViewCover ? text('Foto dal posto', 'Photos from the spot') : text('Aggiungi foto', 'Add photos')}
        </button>

        {/* CONFIRM STATUS — secondary CTA */}
        <button
          onClick={() => setStatusOpen(true)}
          style={{
            flex: 1, minWidth: 150,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '12px 16px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            fontFamily: 'var(--font-mono)', fontSize: 13,
            color: 'var(--bone)',
            cursor: 'pointer',
            transition: 'border-color 0.2s, background 0.2s',
          }}
        >
          <span>{text('Conferma stato','Confirm status')}</span>
          {confirmedDate && (
            <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
              {text('ultimo','latest')}: {confirmedDate}
            </span>
          )}
        </button>
      </div>

      {/* Hint for empty spots */}
      {(photoCount === 0 || streetViewCover) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', marginBottom: 20,
          background: 'rgba(255,106,0,0.06)',
          border: '1px solid rgba(255,106,0,0.2)',
          borderRadius: 8,
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}><MapIcon name="photo" /></span>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--bone)', lineHeight: 1.5 }}>
            {streetViewCover ? text('La copertina arriva da Street View.', 'The cover is from Street View.') : text('Questo spot non ha ancora foto.', 'This spot has no photos yet.')}
            <br />
            <strong style={{ color: 'var(--orange)' }}>{streetViewCover ? text('Ci sei stato? Aggiungi una foto dal posto.', 'Been there? Add a photo from the spot.') : text('Sii il primo a documentarlo!', 'Add the first photo from the spot.')}</strong>
          </div>
        </div>
      )}

      <AddPhotoModal
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        spotId={spotId}
        spotName={spotName}
      />

      <StatusConfirmModal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        spotId={spotId}
        spotName={spotName}
        currentCondition={currentCondition}
      />
    </>
  );
}
