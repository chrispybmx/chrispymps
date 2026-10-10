# Account, email e rilascio — 26 settembre 2026

## Stato realmente verificato

Controlli sul progetto Supabase indicato dalla configurazione locale e sull’account MailerLite già collegato. Successivamente è stata letta anche la configurazione Vercel; dettagli in `hosting-verification-2026-09-26.md`.

- Supabase `/auth/v1/settings`: registrazioni email e Google abilitate; **`mailer_autoconfirm=true`**. Attualmente il click di conferma account non è richiesto. Attivare Confirm Email riguarda i nuovi account; non dimostra retroattivamente la proprietà degli indirizzi già autoconfermati.
- MailerLite: automazioni “Welcome — Account Chrispy Maps” e “Welcome — Newsletter Settimanale” abilitate. Questo prova lo stato dell’automazione, non la consegna nella casella del destinatario, l’HTML effettivamente pubblicato o la correttezza di ogni trigger.
- `profiles`, `rider_details`, `cm_product_metrics_daily`, `cm_newsletter_preferences`, `cm_newsletter_confirmations`: risposte HTTP 200 a letture HEAD senza dati.
- Session: migrazione `20260925_private_session_invites.sql` applicata dopo approvazione specifica del proprietario. Catalogo verificato: sei tabelle vuote con RLS, quattro policy di lettura limitate ai partecipanti/proprietario e dieci funzioni non accessibili ai ruoli browser. Dettagli in `session-migration-production-2026-09-26.md`.
- Flag locali di session private, metriche e newsletter disattivati. Limite Redis e cron non configurati localmente. Nessuna deduzione sui flag del deploy pubblico.
- Supabase Dashboard: SMTP personalizzato attivo, host `smtp.resend.com`, porta 465, intervallo minimo 60 secondi, nome mittente `ChrispyMPS`. La password salvata non è stata letta. L’elenco domini Resend via API aveva restituito HTTP 400; questo non invalida la configurazione SMTP osservata.
- Site URL: `https://maps.chrispybmx.com`. Allowlist: `https://maps.chrispybmx.com/**`, `https://chrispymps.vercel.app/**`, `http://localhost:3000/**`. Le anteprime locali sulla porta 3100 non sono autorizzate. Nessuna modifica all’allowlist effettuata.
- Il proprietario ha confermato la ricezione della prima email di recupero nello spam e riportato SPF PASS, DKIM PASS sul dominio chrispybmx.com e DMARC PASS. Nessuna password cambiata; completamento del recupero non verificato.
- Pubblicati nome mittente **Chrispy Maps**, oggetto italiano e `email-templates/reset-password-current.html`, conservando `{{ .ConfirmationURL }}`. Verificata persistenza dopo ricaricamento. Una seconda richiesta autorizzata sul sito pubblico ha prodotto conferma di invio: ricezione di questa versione ancora da confermare.
- Applicata anche la correzione dei permessi della vista pubblica descritta in `production-verification-2026-09-26.md`. Migrazione session ora applicata; funzioni session non attivate e Confirm Email disattivato. I template con TokenHash non sono stati pubblicati.

## Percorsi applicativi

1. Registrazione: salva username e dati iniziali del rider nei metadati privati dell’account; usa un ritorno esplicito `/auth/callback?flow=email&next=...`.
2. Con conferma richiesta: email → pagina di conferma → pressione del pulsante → verifica token → completamento profilo → ritorno alla pagina originale.
3. Con autoconferma attuale: sessione immediata → `/api/auth/complete` → completamento profilo. La UI non deve promettere un’email di verifica che Supabase non emette.
4. Link PKCE precedenti: supportati dal callback; normalmente richiedono lo stesso browser che ha iniziato il flusso. I nuovi template con TokenHash consentono il passaggio fra browser/dispositivi.
5. Recupero password: email → conferma intenzionale → pagina nuova password. Questo percorso non avvia il benvenuto né il consenso marketing.
6. OAuth Google: scambio codice → profilo esistente o scelta username → ritorno alla destinazione locale originale.
7. Benvenuto: gruppo di servizio MailerLite già usato dal progetto; non modifica il registro di consenso newsletter. Se non sincronizzato, il completamento resta pendente e viene ritentato al prossimo accesso.
8. Newsletter: checkbox esplicita → conferma separata con token e scadenza → registro consensi → sincronizzazione provider. Resta governata da `NEWSLETTER_CONSENT_ENABLED` e dalle procedure in `newsletter-release.md`.

Il reinvio della conferma è disponibile dopo la registrazione e dalla schermata di accesso. Le risposte non devono rivelare se un indirizzo appartiene a un altro utente. Commenti e voti aprono l’accesso sullo stesso spot, senza pubblicare automaticamente l’azione dopo il login.

## Configurazione da completare prima di pubblicare

1. Dashboard Supabase: verificare SMTP, mittente e dominio; configurare Site URL corretto e allowlist di redirect con origini esplicite di produzione/staging. Non aggiungere wildcard globali.
2. Pubblicare il callback e le pagine `/auth/confirm`, `/auth/problem`, `/auth/reset-password` prima di cambiare i template.
3. In Auth → Email Templates usare `email-templates/confirm-account.html` e `email-templates/reset-password.html`. Questi template richiedono il nuovo codice: `.RedirectTo` contiene già `?flow=...`, e il template aggiunge `&token_hash=...&type=...`. Le due operazioni vanno coordinate. Per link precedenti il codice mantiene il supporto PKCE.
4. Eseguire il collaudo con una casella di prova autorizzata, poi attivare **Confirm Email** se si vuole realmente richiedere la verifica dell’indirizzo. Non attivarlo prima di aver verificato che le email possano arrivare.
5. Verificare trigger e contenuto del gruppo MailerLite di servizio: solo benvenuto operativo. La newsletter resta separata e opt-in. Nessun cambio di provider viene effettuato.
6. Configurare `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` per il limite geografico globale. In produzione, senza limite condiviso, la ricerca esterna risponde con errore recuperabile: la ricerca degli spot del catalogo funziona. L’autocomplete esterno Nominatim è stato rimosso.
7. Solo per un processo locale: `CHRISPY_LOCAL_PREVIEW=true npm run start -- --hostname 127.0.0.1 --port 3100`. Non abilitare questa eccezione su un deploy pubblico. Il flag esiste anche perché l’env locale contiene variabili Vercel importate.
8. Session: database predisposto con `supabase/migrations/20260925_private_session_invites.sql`; non riapplicarla. Restano configurazione dei flag pubblici/server, worker email, deploy e collaudo con due account prima dell’attivazione.
9. Metriche e consenso: le tabelle esistono, ma questo non prova tutte le funzioni/policy della migrazione. Confrontare lo schema e la cronologia; seguire `product-metrics.md` e `newsletter-release.md`.

## Lavori in background

- Mantengono la sospensione del polling quando la pagina è nascosta e i caricamenti incrementali dei messaggi. Il timeout Redis è ora limitato a tre secondi.
- Newsletter: `/api/internal/newsletter-maintenance`, con `CRON_SECRET`, secondo `newsletter-release.md`.
- Metriche: `/api/internal/product-metrics-retention`, ogni giorno con `CRON_SECRET`.
- Email inviti: `GET /api/internal/session-invite-email` con `CRON_SECRET` per Vercel, oppure POST con `SESSION_INVITES_CRON_SECRET` (fallback `CRON_SECRET`), `SESSION_INVITES_ENABLED=true`, `SESSION_INVITES_EMAIL_ENABLED=true` e provider verificato. Il worker usa la coda persistente; frequenza e monitoraggio vanno configurati sull’hosting effettivo.
- Nessun cron remoto viene dichiarato attivo. Segnalare errori 503 e code che non si svuotano prima di ampliare il traffico.

## Collaudo da concludere con email reale

- Nuovo indirizzo: niente accesso prima della conferma se Confirm Email è attivo.
- Apertura preliminare del link senza click: nessun consumo del token con i nuovi template.
- Conferma su altro dispositivo, link scaduto, link già usato e reinvio.
- Rientro sullo spot originale; accesso per commentare; bozza contributo recuperabile.
- Recupero password con un account di prova; non cambiare la password dell’account personale durante i test.
- Nessuna newsletter senza checkbox e conferma dedicata; benvenuto senza duplicazioni; revoca newsletter indipendente dall’account.
- Documentare ricezione, mittente, link finale e tempi senza salvare token o password nei log.

Riferimenti: [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates), [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp), [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/).

Aggiornamento: per lo stato consolidato, l’esempio scheduler, i controlli RPC e il collaudo SQL session vedere `release-runbook.md`. Il template italiano di recupero con ConfirmationURL è pubblicato; i nuovi template TokenHash e gli scheduler non sono attivati.
