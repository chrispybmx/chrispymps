# Rilascio verificabile di Chrispy Maps

26 settembre 2026. Il proprietario conferma che esiste soltanto il sito pubblico. Questo documento e l’esempio cron sono preparati nel repository; non rappresentano impostazioni già attivate sull’hosting.

## Stato e responsabilità dei servizi

| Percorso | Chi invia / gestisce | Cosa manca prima dell’attivazione |
|---|---|---|
| Conferma account e recupero password | Supabase Auth → SMTP Resend, configurazione verificata | Primo recupero ricevuto nello spam; versione italiana ConfirmationURL pubblicata, ricezione da confermare; autoconferma attiva, nuovi template TokenHash non pubblicati |
| Benvenuto operativo | Gruppo di servizio MailerLite | Revisionare contenuto/trigger e provarne la consegna |
| Conferma newsletter | Resend + registro consensi Supabase | Verificare mittente e casella; attivare raccolta solo dopo collaudo |
| Newsletter | MailerLite | Verificare webhook di revoca, gruppo, contenuti e sincronizzazione |
| Email invito session | Resend + coda persistente Supabase | Database predisposto; restano mittente, consenso notifiche, pianificazione e collaudo |
| Ricerca geografica | Proxy server + Nominatim + limite Redis | Configurare Redis condiviso prima del deploy |

Una chiave MailerLite non configura l’SMTP di Supabase. La sola presenza della chiave Resend non certifica mittente o consegna. Il controllo in sola lettura dei domini Resend ha restituito HTTP 400 `validation_error`; non è una prova che gli invii funzionino o che falliscano.

## 1. Preparare un ambiente isolato

Per collaudare l’intera registrazione senza cambiare il comportamento degli account pubblici occorre un progetto Supabase separato, collegato a una preview con origine stabile. Non basta una preview Vercel se punta ancora al database pubblico.

Non attivare un piano a pagamento implicitamente. Confermare disponibilità e limiti dell’account prima di creare nuove risorse. Nell’ambiente di prova usare dati sintetici, account/caselle controllati dal proprietario e gruppi MailerLite di prova. Non importare profili, messaggi o consensi reali.

Le verifiche SQL locali già incluse nel repository non richiedono alcuna risorsa cloud. Il database temporaneo non legge `.env.local` e non invia email.

## 2. Database: applicare soltanto ciò che manca

In produzione le tabelle newsletter/metriche e i relativi RPC risultano esposti via REST/OpenAPI. Il catalogo SQL conferma RLS sulle quattro tabelle newsletter/metriche e, dopo la migrazione autorizzata del 26 settembre, sulle sei tabelle vuote `cm_session_%`. La cronologia registrata ha nove voci e si ferma ad `add_sessions` (aprile): non descrive tutti gli oggetti presenti. Non riapplicare tutte le migrazioni in base alla sola cronologia.

La correzione `20260926153000_public_spots_read_only.sql` è stata applicata direttamente al database pubblico il 26 settembre, con verifica transazionale della lettura per anon/authenticated/service_role. È idempotente; l’esecuzione manuale non aggiunge automaticamente la voce nella migration history. Dettagli e limiti in `production-verification-2026-09-26.md`.

1. Leggere la cronologia migrazioni del progetto corretto e verificare lo schema effettivo/cache REST.
2. Applicare in staging `supabase/migrations/20260925_private_session_invites.sql`, dopo i prerequisiti utenti/profili/spot. La migrazione crea tabelle e funzioni, non è da rilanciare alla cieca.
3. Confrontare lo stato di `20260926_newsletter_consent.sql` e `20260926_product_metrics.sql`; non riapplicarle soltanto perché sono presenti nel repository.
4. Ripetere i controlli di accesso con due account e un terzo estraneo.
5. Sul pubblico `20260925_private_session_invites.sql` è già applicata manualmente dopo approvazione specifica del proprietario; non riapplicarla. Contabilizzare l’esecuzione nella futura riconciliazione della migration history. Restano da completare il collaudo applicativo e l’attivazione dei flag. Vedere `session-migration-production-2026-09-26.md`.

Comandi locali ripetibili dopo `npm ci` (PGlite è una dipendenza di sviluppo):

```sh
npm run verifica:sql
npm run verifica:session
```

Le verifiche SQL comprendono 12 controlli della vista pubblica, 39 session, 31 newsletter e 13 metriche. La suite session include cinque scenari integrati con handler reali e PostgreSQL PGlite, identità e trasporto sostituiti: invito/accettazione/chat/blocco, opt-in/coda/revoca, identità invalida/flag server, paginazione inbox e messaggi. Nessuna email viene inviata; non è una prova browser, Supabase Auth/PostgREST o uno stress test distribuito. Dettagli in `integration-verification-2026-09-26.md`.

## 3. Email: pubblicazione coordinata

Seguire `account-email-release.md` per callback, template e allowlist. In staging impostare Confirm Email, verificare le email di conferma e recupero, aprire il link anche da un secondo dispositivo. Non attivare la conferma obbligatoria pubblica prima di avere una consegna funzionante.

Configurare `NEWSLETTER_SITE_URL` e `SESSION_INVITES_SITE_URL` sull’origine di prova: gli inviti ora rispettano esplicitamente l’ambiente, senza rimandare per forza al sito pubblico. Verificare separatamente la Site URL e i redirect di Supabase.

Per Auth va verificato un SMTP adatto al pubblico: il servizio predefinito Supabase è limitato agli indirizzi autorizzati del team, quindi una prova riuscita sulla casella del proprietario da sola non certifica la consegna a un nuovo rider. Fonte: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## 4. Pianificazione: nessun falso successo

| Job | Metodo / autenticazione | Frequenza proposta | Segnale da controllare |
|---|---|---|---|
| `/api/internal/session-invite-email` | GET con `CRON_SECRET` (Vercel); POST con `SESSION_INVITES_CRON_SECRET` o, se assente, `CRON_SECRET` | Ogni minuto | HTTP 503, `pending > 0`, `requiresReview > 0` |
| `/api/internal/newsletter-maintenance` | GET con `CRON_SECRET` | Ogni 5 minuti | HTTP 503, `pending > 0`, `requiresReview > 0` |
| `/api/internal/product-metrics-retention` | GET con `CRON_SECRET` | Quotidiana | HTTP 503 |

Il worker session distingue invii riusciti, errori ritentabili e lavori che hanno esaurito gli otto tentativi. Errori di acquisizione, cancellazione o salvataggio della coda non vengono dichiarati risolti. Restituisce solo conteggi; i log di monitoraggio non devono contenere destinatari o testo delle conversazioni.

`deployment/vercel-crons.example.json` è un esempio da integrare nella configurazione solo dopo aver verificato il piano e i prerequisiti. Non è un `vercel.json` attivo. Vercel invia GET autenticati tramite CRON_SECRET; Hobby limita ogni job a una esecuzione al giorno e non è adatto a questi avvisi rapidi. Prima di scegliere un piano diverso valutare lo scheduler già disponibile nell’account. Fonti: [Vercel Cron](https://vercel.com/docs/cron-jobs), [limiti e frequenze](https://vercel.com/docs/cron-jobs/usage-and-pricing), [autenticazione](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## 5. Controllo prima del deploy

```sh
npm test
npx tsc --noEmit
npm run build
npm run verifica:rilascio -- --remote --all-features
npm run verifica:rilascio -- --remote --all-features --json
```

Il controllo legge la configurazione del processo e `.env.local`, non scarica automaticamente quella di Vercel. Esegue soltanto GET/HEAD, non chiama RPC mutanti. Non stampa segreti né dati degli utenti. `--strict` restituisce un errore se ci sono blocchi o verifiche manuali aperte; non costituisce una certificazione completa del rilascio.

Pubblicare inizialmente con le funzioni nuove disattivate; mantenere però disponibili le pagine necessarie ai nuovi template. Abilitare una funzione alla volta dopo migrazione, configurazione e prova. I flag NEXT_PUBLIC richiedono una nuova build. Per fermare le session usare il flag server; non eliminare conversazioni o consensi per fare rollback.

## 6. Collaudo con persone e telefoni reali

Con due caselle di prova: registrazione → conferma → ritorno allo spot; recupero password; spot con foto e bozza; preferiti; commento; invito → accettazione → chat; rifiuto, blocco, notifica disattivata; newsletter senza spunta, conferma e revoca. Cambiare soltanto la password di un account di prova.

Poi far provare il prodotto a 3–5 rider, senza suggerire dove premere:

1. Trova uno spot in una città scelta da te e spiega cosa ci puoi girare.
2. Apri le indicazioni e salva lo spot per tornarci.
3. Inizia ad aggiungere uno spot, chiudi e recupera la bozza.
4. Condividi due spot con un altro rider.
5. Con account predisposti, proponi una session e rispondi all’invito.

Annotare esito, errori, richieste di aiuto e punti in cui il rider esita. Nessun contatto con rider è stato inviato automaticamente. Su telefono reale provare rete mobile e cache vuota, misurando tempi e fluidità; bundle e test locali non equivalgono ai Core Web Vitals sul campo.
