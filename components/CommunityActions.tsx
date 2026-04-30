'use client';

import { useState } from 'react';
import SubmitEventModal from './SubmitEventModal';
import SubmitNewsModal from './SubmitNewsModal';
import SubmitRequestModal from './SubmitRequestModal';

export function ProponiEventoBtn() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          fontFamily: 'var(--font-mono)', fontSize: 13,
          padding: '10px 18px',
          background: 'rgba(255,106,0,0.1)',
          border: '1px solid rgba(255,106,0,0.4)',
          borderRadius: 8,
          color: 'var(--orange)',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          letterSpacing: '0.04em',
        }}
      >
        📅 PROPONI EVENTO
      </button>
      <SubmitEventModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function ScriviPostBtn() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          fontFamily: 'var(--font-mono)', fontSize: 13,
          padding: '10px 18px',
          background: 'rgba(255,106,0,0.1)',
          border: '1px solid rgba(255,106,0,0.4)',
          borderRadius: 8,
          color: 'var(--orange)',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          letterSpacing: '0.04em',
        }}
      >
        📝 SCRIVI UN POST
      </button>
      <SubmitNewsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function CercaSpotBtn() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          fontFamily: 'var(--font-mono)', fontSize: 13,
          padding: '10px 18px',
          background: 'rgba(255,106,0,0.1)',
          border: '1px solid rgba(255,106,0,0.4)',
          borderRadius: 8,
          color: 'var(--orange)',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          letterSpacing: '0.04em',
        }}
      >
        📍 CERCA UNO SPOT
      </button>
      <SubmitRequestModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
