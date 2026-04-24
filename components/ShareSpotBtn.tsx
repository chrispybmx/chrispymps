'use client';

import { useState } from 'react';
import { APP_CONFIG } from '@/lib/constants';

interface Props {
  spotName: string;
  spotSlug: string;
  city?: string | null;
}

export default function ShareSpotBtn({ spotName, spotSlug, city }: Props) {
  const [copied, setCopied] = useState(false);

  const url   = `${APP_CONFIG.url}/map/spot/${spotSlug}`;
  const text  = `Guarda questo spot: ${spotName}${city ? ` a ${city}` : ''} 🛹`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;

  const handleShare = async () => {
    // Web Share API — funziona su mobile (iOS/Android)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: spotName, text, url });
        return;
      } catch {
        // utente ha annullato — non fare nulla
        return;
      }
    }
    // Fallback desktop: copia link
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard non disponibile — mostriamo comunque l'url
    }
  };

  return (
    <div style={{ padding: '0 20px', marginBottom: 24 }}>
      {/* Titolo sezione */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'var(--gray-400)', textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 10,
      }}>
        📤 Condividi questo spot
      </div>

      <div style={{ display: 'flex', gap: 10 }}>

        {/* Bottone principale Share / Copia link */}
        <button
          onClick={handleShare}
          style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: copied ? 'rgba(0,200,81,0.12)' : 'var(--gray-800)',
            border: `1px solid ${copied ? '#00c851' : 'var(--gray-600)'}`,
            borderRadius: 8,
            color: copied ? '#00c851' : 'var(--bone)',
            fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
            padding: '12px 16px',
            cursor: 'pointer',
            transition: 'all 0.15s',
            letterSpacing: '0.04em',
          }}
        >
          {copied ? '✓ LINK COPIATO!' : '🔗 CONDIVIDI'}
        </button>

        {/* WhatsApp */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'rgba(37,211,102,0.10)',
            border: '1px solid rgba(37,211,102,0.3)',
            borderRadius: 8,
            color: '#25D366',
            fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
            padding: '12px 16px',
            textDecoration: 'none',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
          WA
        </a>
      </div>

      {/* URL visibile su desktop come fallback */}
      <div style={{
        marginTop: 10,
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'var(--gray-500)',
        wordBreak: 'break-all',
      }}>
        {url}
      </div>
    </div>
  );
}
