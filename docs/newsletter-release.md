# Newsletter: implementazione e rilascio

26 settembre 2026. Modifiche locali; nessun deploy, email di prova a indirizzi reali o migrazione remota eseguiti. MailerLite è stato consultato in sola lettura.

## Flussi implementati

- I moduli newsletter mostrano un consenso facoltativo non preselezionato, dichiarazione di almeno 16 anni (regola del progetto) e link alla stessa informativa locale. Inviare email/flag generici senza il testo/versione corrente non iscrive più.
- L'iscrizione pubblica crea un token casuale da 256 bit, memorizzato solo come SHA-256. Resend invia la conferma. Il token viaggia nel frammento del link, non nella query HTTP. Scade in 24 ore. La pagina GET non attiva nulla: occorre premere Conferma. Una revoca successiva invalida i vecchi link.
- La preferenza del profilo usa esclusivamente l'indirizzo restituito da Supabase dopo verifica del Bearer token e della conferma email. La registrazione del consenso usa un RPC transazionale; senza prova salvata non segue alcuna scrittura al provider. Il vincolo già presente sui minori viene mantenuto; un compleanno noto sotto i 16 anni blocca la nuova iscrizione.
- L'aggiornamento del profilo salva solo i campi ricevuti. La personalizzazione non azzera più data di nascita o flag newsletter omessi e non iscrive/disiscrive implicitamente. Il vecchio booleano rider_details rimane un dato storico, non l'autorità per inviare newsletter.
- La revoca rimuove il solo gruppo Newsletter BMX Settimanale; non tocca gruppi account, coaching o altri servizi. I fallimenti sono mostrati come pendenti, con lavoro persistente, lease, revisioni, otto tentativi e segnalazione dei casi che richiedono intervento. I contatti globalmente disiscritti/bloccati non sono riattivati automaticamente, neppure da una registrazione account.
- L'email di benvenuto conserva il gruppo di servizio esistente, ma il relativo endpoint accetta solo l'identità autenticata, non un indirizzo arbitrario inviato dal browser. La conferma newsletter è separata da quella dell'account; il mancato invio della newsletter non viene presentato come un fallimento della creazione account.
- La cancellazione account verifica revoca e rimozione da MailerLite prima di iniziare a modificare i dati. Un errore del provider non viene più ignorato. Gli altri passaggi della cancellazione non sono una singola transazione e richiedono ancora una verifica completa separata.
- Webhook HMAC SHA-256 per `subscriber.unsubscribed`, non batch. Date e stato locale impediscono a duplicati/eventi precedenti di sovrascrivere scelte successive. Gli indirizzi presenti in MailerLite per altri servizi, ma assenti dal nuovo registro Maps, sono ignorati. La schermata preferenze legge anche lo stato reale del provider, quindi una disiscrizione preesistente non viene mostrata come attiva.
- Prova: indirizzo, azione, versione, testo, provenienza e momento, senza IP o user agent. Conferme scadute eliminate dalla manutenzione; preferenze revocate e sincronizzate eliminate dopo 24 mesi insieme allo storico. La durata è una scelta del progetto, da validare nel bilanciamento per la conservazione della prova, non un obbligo di legge universale.

## Riscontri reali su MailerLite

L'API ha confermato:

- gruppo account/benvenuto: `185532080718873760`, automazione `Welcome — Account Chrispy Maps` attiva;
- gruppo newsletter: `186569732865918849`, automazione `Welcome — Newsletter Settimanale` attiva;
- nessun webhook configurato;
- tracciamento aperture attivo in entrambi i benvenuti;
- il campo plain_text del benvenuto newsletter contiene una stringa tecnica di test, anziché il messaggio per il lettore;
- il testo semplice del benvenuto account è un fallback inglese generico da newsletter.

Le automazioni e i relativi HTML non sono stati modificati. Il contenuto completo della versione HTML non è stato revisionato: non dedurre la natura esclusivamente transazionale dal solo oggetto o gruppo. Prima del rilascio:

1. Sostituire il plain_text newsletter con `docs/email-review/welcome-newsletter.txt`, verificando che `{$unsubscribe}` resti una variabile valida nell'editor MailerLite e collaudando l'anteprima/test su un indirizzo autorizzato.
2. Revisionare HTML e plain_text del benvenuto account per eliminare eventuali promozioni e renderli coerenti con la funzione di servizio.
3. Disattivare il tracking aperture/clic sulle comunicazioni di servizio; decidere consapevolmente quello newsletter, coerentemente con informativa e consenso. L'informativa locale ora espone l'attuale rilevazione delle aperture: dopo modifiche effettive aggiornare il testo, senza dichiarare prima che sia spenta.
4. Verificare DPA applicabile, account titolare, regione e fornitori effettivi. Una modifica software non sostituisce questi riscontri.

## Ordine di rilascio

Non eseguire tutte le vecchie migrazioni del repository alla cieca. Questa release usa soltanto due nuove migrazioni additive:

1. `supabase/migrations/20260926_newsletter_consent.sql`
2. `supabase/migrations/20260926_product_metrics.sql`

Entrambe sono transazionali, server-only e non modificano tabelle spot o account esistenti. Le migrazioni session/chat sono un'altra release: non sono necessarie alla newsletter o ai contatori.

Al momento il progetto locale non contiene una connessione SQL `SUPABASE_DB_URL` né un token di gestione Supabase; il service-role REST non è un accesso SQL generico. Non ho cercato di aggirare questo limite tramite endpoint admin o RPC arbitrari.

### Staging

1. Scegliere un Supabase di staging e collegare l'anteprima alle sue credenziali tramite gestione sicura dell'ambiente, senza incollarle in chat. In alternativa applicare inizialmente solo a un PostgreSQL temporaneo, come già collaudato.
2. Applicare le due migrazioni attraverso CLI/Supabase SQL Editor del progetto corretto. Non reinserirle se sono già state applicate. Non importano automaticamente gli iscritti storici né attribuiscono retroattivamente consensi mai registrati.
3. Configurare `NEWSLETTER_CONSENT_ENABLED=true`, `NEWSLETTER_PROVIDER=mailerlite`, `NEWSLETTER_SITE_URL` sull'origine staging. Usare un account/gruppo di prova separato da quello reale per gli end-to-end del provider. Impostare MAILERLITE_NEWSLETTER_GROUP_ID e MAILERLITE_SERVICE_GROUP_ID sugli ID dei gruppi di prova; se vuoti vengono usati gli ID storici Maps. In alternativa mantenere il provider mockato. Non spedire richieste finte ai gruppi reali.
4. Configurare un CRON_SECRET forte e un job GET `/api/internal/newsletter-maintenance` ogni 5 minuti, con header `Authorization: Bearer <CRON_SECRET>`. Elaborazione massima tre indirizzi per passaggio, lease 60 secondi; se il volume cresce adeguare frequenza/capacità. Allertare su HTTP 503 e `requiresReview > 0`. La pulizia continua anche a raccolta disattivata.
5. Registrare su MailerLite il webhook non-batch `subscriber.unsubscribed` diretto a `/api/newsletter/mailerlite-webhook`; salvare il segreto restituito come `MAILERLITE_WEBHOOK_SECRET`. Il nuovo endpoint dev'essere raggiungibile prima della registrazione. Non attivare hook verso localhost.
6. Verificare con account e indirizzi di test autorizzati: nessuna spunta → nessuna newsletter; conferma scaduta; doppio click; revoca sito; revoca dal messaggio; modifica profilo dopo consenso; provider irraggiungibile; cron retry; cancellazione account. I test automatici non inviano messaggi reali.
7. Il tracking aggregato resta separato e spento. Prima dell'attivazione completare il criterio giuridico/informativa e seguire `docs/product-metrics.md`, con job di pulizia quotidiano. Non usare la spunta newsletter come consenso agli analytics.

### Produzione

- Coordinare i moduli eventualmente ospitati su `chrispybmx.com` con la nuova API: richiede `consent: true`, `over16: true`, `consentVersion: 2026-09-26-v1`, `source: newsletter`. I moduli nel repository sono aggiornati; eventuali copie esterne non lo sono. Non riconoscere vecchi payload privi di consenso soltanto per compatibilità.
- Pubblicare migrazioni additive prima del codice attivo; rilasciare insieme API e form. Verificare che il gruppo di servizio continui a inviare esclusivamente il benvenuto.
- Verificare i tempi dei log di hosting/Auth e le condizioni contrattuali. La sezione privacy non costituisce attestazione di conformità e non prova da sola l'esistenza di queste impostazioni.
- Per arrestare nuove iscrizioni/sync mettere `NEWSLETTER_CONSENT_ENABLED=false`; continuare la pulizia e gestire revoche dai link MailerLite/contatto del titolare. Non eliminare il registro consensi per fare rollback applicativo.

## Validazione ripetibile

- `npm test`: suite applicativa con API/provider simulati, senza invii.
- `npx tsc --noEmit` e `npm run build`.
- `node scripts/check-newsletter-consent-sql.mjs <entry-point-di-@electric-sql/pglite>`: 31 verifiche PostgreSQL isolate, tra cui ruoli, atomicità, lease, scadenze, replay, revoche e retention.
- `node scripts/check-product-metrics-sql.mjs <entry-point-di-@electric-sql/pglite>`: contatori, permessi e retention.

PGlite è stato installato solo nella cartella temporanea di collaudo; non è una dipendenza del sito né del database remoto.

Fonti tecniche: [MailerLite subscribers](https://developers.mailerlite.com/api/subscribers), [groups](https://developers.mailerlite.com/api/groups), [webhooks](https://developers.mailerlite.com/api/webhooks). Indicazioni privacy: [Garante cookie](https://www.garanteprivacy.it/faq/cookie), [MailerLite DPA](https://www.mailerlite.com/legal/data-processing-agreement).

Esito finale del collaudo locale: 579 test in 46 file, TypeScript e build passati; 31 + 13 verifiche SQL temporanee e 23 pagine con nonce CSP corretti. Verifica browser dei form e della pagina di conferma completata con raccolta spenta. Non collaudata la consegna email reale né applicate migrazioni remote.
