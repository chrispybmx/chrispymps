'use client';

import { useState } from 'react';
import type { SpotCondition } from '@/lib/types';
import AddPhotoModal from './AddPhotoModal';
import StatusConfirmModal from './StatusConfirmModal';

interface Props {
  spotId: string;
  spotName: string;
  currentCondition: SpotCondition;
  photoCount: number;
  lastConfirmedAt?: string;
}

export default function SpotContributeCTA({ spotId, spotName, currentCondition, photoCount, lastConfirmedAt }: Props) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const confirmedDate = lastConfirmedAt
    ? new Date(lastConfirmedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
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
            background: 'var(--orange)',
            color: '#000',
            border: 'none', borderRadius: 10,
            fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
            letterSpacing: '0.04em', cursor: 'pointer',
            boxShadow: '0 2px 16px rgba(255,106,0,0.3)',
            transition: 'transform 0.1s',
          }}
        >
          📸 {photoCount === 0 ? 'AGGIUNGI PRIMA FOTO' : 'AGGIUNGI FOTO'}
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
          <span>✓ CONFERMA STATO</span>
          {confirmedDate && (
            <span style={{ fontSize: 10, color: 'var(--gray-500)' }}>
              ultimo: {confirmedDate}
            </span>
          )}
        </button>
      </div>

      {/* Hint for empty spots */}
      {photoCount === 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', marginBottom: 20,
          background: 'rgba(255,106,0,0.06)',
          border: '1px solid rgba(255,106,0,0.2)',
          borderRadius: 8,
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>📷</span>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--bone)', lineHeight: 1.5 }}>
            Questo spot non ha ancora foto.
            <br />
            <strong style={{ color: 'var(--orange)' }}>Sii il primo a documentarlo!</strong>
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
