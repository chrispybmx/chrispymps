'use client';
import Link from 'next/link';

import { useLanguage } from '@/components/LanguageProvider';

/**
 * Strip ambient donazioni — persistente in fondo ad ogni pagina.
 * Non è mai invasiva, non fa popup, non è legata ad azioni utente.
 */
export default function SupportStrip() {
  const { text } = useLanguage();
  return (
    <div className="support-strip">
      <span aria-hidden="true">🏴</span>
      <span>{text('Questo progetto è gratuito.', 'This project is free to use.')}</span>
      <Link
        href="/map/support"
        aria-label={text('Supporta Chrispy Maps', 'Support Chrispy Maps')}
       prefetch={false}>
        {text('Supportalo', 'Support it')} →
      </Link>
    </div>
  );
}
