import { LINKS } from '@/lib/constants';

/**
 * Strip ambient donazioni — persistente in fondo ad ogni pagina.
 * Non è mai invasiva, non fa popup, non è legata ad azioni utente.
 */
export default function SupportStrip() {
  return (
    <div className="support-strip">
      <span aria-hidden="true">☕</span>
      <span>Questo progetto è gratuito.</span>
      <a
        href={LINKS.kofi}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Supporta ChrispyMPS su Ko-fi"
      >
        Supportalo →
      </a>
    </div>
  );
}
