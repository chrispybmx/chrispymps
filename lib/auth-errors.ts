/**
 * Messaggi per i fallimenti del login sociale.
 *
 * Perché esiste: il callback OAuth scriveva `?auth_error=...` nell'URL e
 * nessuno lo leggeva mai, e la pagina di scelta username, se la sessione non
 * arrivava entro 6 secondi, rimandava alla mappa senza dire niente. In
 * entrambi i casi il rider tornava sulla mappa esattamente com'era partito,
 * senza un messaggio: dal suo punto di vista il bottone Google non faceva
 * proprio nulla.
 *
 * Ogni codice qui è anche una diagnosi: dice QUALE passaggio si è rotto.
 */

export const AUTH_ERROR_PARAM = 'auth_error';

/** Codici che generiamo noi (quelli di Google arrivano come stringhe libere). */
export type AuthErrorCode =
  | 'oauth_failed'      // scambio del codice fallito lato server
  | 'no_code'           // Google è tornato senza codice
  | 'no_session'        // sessione mai arrivata al browser dopo il callback
  | 'profile_failed'    // sessione ok, creazione profilo fallita
  | 'access_denied'      // l'utente ha annullato su Google
  | 'unexpected_failure';// Supabase non è riuscito a scambiare il codice con Google

const MESSAGGI: Record<string, string> = {
  oauth_failed:
    'Accesso con Google non riuscito: il server non è riuscito a completare lo scambio. Riprova, oppure entra con email e password.',
  no_code:
    'Google non ha restituito il codice di accesso. Riprova.',
  no_session:
    'Google ha confermato l\'accesso ma la sessione non è arrivata al browser. Se usi la modalità privata o hai i cookie di terze parti bloccati, prova in una finestra normale.',
  profile_failed:
    'Accesso riuscito, ma non è stato possibile creare il profilo. Riprova: se succede ancora, scrivimi.',
  access_denied:
    'Accesso annullato su Google.',
  server_error:
    'Google ha risposto con un errore. Riprova tra poco.',
  /* "Unable to exchange external code": Google rifiuta lo scambio perché il
     client secret salvato su Supabase non è più valido. Riprovare non serve a
     niente — è una configurazione da sistemare, non un intoppo momentaneo, e
     dirlo evita di far sbattere la gente contro lo stesso muro. */
  unexpected_failure:
    'Accesso con Google non disponibile: è un problema di configurazione dalla nostra parte, non tuo. Entra con email e password — lo stiamo sistemando.',
  temporarily_unavailable:
    'Google non è raggiungibile in questo momento. Riprova tra poco.',
};

/** Messaggio leggibile per un codice di errore; `null` se non c'è errore. */
export function authErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  const noto = MESSAGGI[code];
  if (noto) return noto;
  /* Codice sconosciuto (arriva da Google): lo mostriamo comunque, perché un
     messaggio strano è pur sempre meglio del silenzio — e ci dice cosa indagare. */
  return `Accesso con Google non riuscito (${code}). Riprova, oppure entra con email e password.`;
}
