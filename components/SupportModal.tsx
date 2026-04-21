'use client';

import { useEffect } from 'react';
import { LINKS } from '@/lib/constants';

const KO_FI_AMOUNTS = [3, 5, 10];

interface SupportModalProps {
  open:    boolean;
  onClose: () => void;
}

export default function SupportModal({ open, onClose }: SupportModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)',
          zIndex: 79,
          backdropFilter: 'blur(4px)',
        }}
        aria-hidden="true"
      />

      {/* Modale */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Supporta ChrispyMPS"
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          background: 'var(--gray-800)',
          borderTop: '2px solid var(--orange)',
          borderRadius: '16px 16px 0 0',
          zIndex: 80,
          padding: '24px 20px calc(24px + env(safe-area-inset-bottom))',
          animation: 'slideUp 0.3s ease-out',
          maxWidth: 480,
          margin: '0 auto',
        }}
      >
        {/* Handle */}
        <div className="bottom-sheet-handle" style={{ marginTop: 0, marginBottom: 20 }} />

        {/* Intestazione */}
        <div style={{ marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>☕</div>
          <h2 style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 26,
            color: 'var(--orange)',
            margin: 0,
          }}>
            SUPPORTA IL PROGETTO
          </h2>
          <p style={{ color: 'var(--gray-400)', fontSize: 15, marginTop: 8, lineHeight: 1.5 }}>
            ChrispyMPS è gratuito per sempre.<br />
            Se ti è utile, un caffè aiuta a tenerlo vivo.
          </p>
        </div>

        {/* Importi Ko-fi */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {KO_FI_AMOUNTS.map((amount) => (
            <a
              key={amount}
              href={`${LINKS.kofi}?amount=${amount}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                background: 'var(--gray-700)',
                border: '1px solid var(--gray-600)',
                borderRadius: 4,
                padding: '14px 8px',
                textAlign: 'center',
                textDecoration: 'none',
                color: 'var(--bone)',
                fontFamily: 'var(--font-mono)',
                fontSize: 18,
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--orange)';
                (e.currentTarget as HTMLElement).style.color = 'var(--orange)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--gray-600)';
                (e.currentTarget as HTMLElement).style.color = 'var(--bone)';
              }}
            >
              ☕ {amount}€
            </a>
          ))}
        </div>

        {/* CTA principale */}
        <a
          href={LINKS.kofi}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}
        >
          Vai su Ko-fi →
        </a>

        {/* Chiudi */}
        <button
          onClick={onClose}
          className="btn-secondary"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Magari un'altra volta
        </button>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          color: 'var(--gray-400)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          marginTop: 16,
        }}>
          Ko-fi — zero commissioni, Apple/Google Pay disponibili
        </p>
      </div>
    </>
  );
}
