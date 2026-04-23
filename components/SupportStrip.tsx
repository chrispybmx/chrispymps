/**
 * Strip ambient donazioni — persistente in fondo ad ogni pagina.
 * Non è mai invasiva, non fa popup, non è legata ad azioni utente.
 */
export default function SupportStrip() {
  return (
    <div className="support-strip">
      <span aria-hidden="true">🏴</span>
      <span>Questo progetto è gratuito.</span>
      <a
        href="/map/support"
        aria-label="Supporta ChrispyMPS"
      >
        Supportalo →
      </a>
    </div>
  );
}
