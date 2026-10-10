# Registrazione e verifica email: preparazione locale

## Stato

Implementazione locale nella cartella `crock-lab`. Nessun deploy, modifica Auth,
migrazione sul database pubblico o invio di email reali effettuato per questo lavoro.
Questa nota aggiorna il flusso di signup descritto nel documento del 26 settembre:
il nuovo modulo NON accetta piu una sessione immediata da autoconfirm.

## Modifiche

- Signup: data dichiarata, Paese privato obbligatorio, sport multipli facoltativi
  (BMX, skate, scooter, MTB, altro), regione italiana facoltativa.
- Dati nel comparto privato `rider_details`, non nelle colonne pubbliche di
  `profiles`. Nessun nuovo consenso marketing, vendita dati o condivisione Live.
- Preflight `/api/auth/registration-check`: valida input e richiede che Supabase
  abbia il provider email acceso e `mailer_autoconfirm=false`. Non e una barriera
  contro chiamate dirette all'SDK: la barriera e l'Auth hook da configurare.
- Migrazione `20261010120000_registration_policy.sql`: Paese, MTB, restrizione
  della vecchia vista aggregata al service role, funzione Before User Created.
- Hook: rifiuta nuova creazione senza data valida, sotto i 14 anni dichiarati,
  senza Paese valido o con sport non ammessi. Non scrive i tentativi nel database.
  I log infrastrutturali del provider vanno comunque valutati separatamente.
- Nuova creazione OAuth bloccata dall'hook: manca un flusso pre-OAuth per la
  dichiarazione richiesta. Il login di account esistenti non crea un nuovo utente.
- Prova email in `app_metadata.cm_email_proof`, scritta dal server solo dopo
  `verifyOtp` riuscito per email/signup/email_change. I GET degli scanner non
  consumano il link. Un parametro `flow=email`, un callback PKCE o dati forniti
  dal browser non producono questa attestazione.
- Gli account storici autoconfermati non sono considerati provati dal solo
  `email_confirmed_at`. Nessun logout forzato o blocco retroattivo introdotto.
- Impostazioni profilo: modifica Paese/sport e stato verifica email. Il pulsante
  invio richiede `EMAIL_VERIFICATION_ENABLED=true`. Invio solo all'indirizzo del
  token autenticato, `shouldCreateUser:false`, limite un tentativo al minuto.
- La presenza Community resta indipendente e non viene abilitata dalla data
  dichiarata, dalla scelta degli sport o dalla conferma email.

## Rilascio coordinato ancora da fare

1. Prima di modificare il progetto pubblico, backup verificabile e prova di
   migrazione e Auth su un progetto Supabase separato. Non usare l'anteprima
   fittizia come prova che il provider invia davvero le email.
2. Applicare la migrazione dopo aver verificato le precedenti tabelle e viste.
   E additiva, non cancella utenti o sessioni. La revoca della vista aggregata
   puo interrompere vecchi client che la interrogavano direttamente: usare
   solo gli endpoint amministrativi autorizzati, non ripristinare letture pubbliche.
3. Configurare Auth > Hooks > Before User Created sulla funzione
   `public.cm_before_user_created`. Il solo SQL NON attiva il controllo.
   Provare anche una chiamata signup diretta senza metadata: deve essere negata.
4. Verificare SMTP, mittente, Site URL HTTPS, redirect allowlist e limiti di invio.
   Caricare `docs/email-templates/confirm-account.html` in Confirm Signup e
   `docs/email-templates/verify-existing-account.html` in Magic Link. Sono link
   con token hash alla pagina di conferma intenzionale, destinazione fissa `/map`.
   Il template di recupero password non viene modificato.
5. Coordinare Confirm Email, template e release frontend/backend. Con
   autoconfirm ancora acceso il nuovo modulo si ferma prima della creazione;
   non pubblicarlo aspettandosi che il signup rimanga operativo invariato.
6. Collaudare nuova iscrizione, email ricevuta, apertura in altro browser,
   conferma intenzionale, token scaduto, reinvio e successivo login. Verificare
   salvataggio dei dati privati e mancata iscrizione newsletter senza scelta.
7. Collaudare un account storico: accesso invariato, invio esplicito verifica,
   prova registrata solo dopo il click, cambio email che invalida la vecchia
   prova. Solo dopo abilitare `EMAIL_VERIFICATION_ENABLED=true` sull'hosting.
8. Verificare il rate limiter distribuito e i limiti Supabase: il fallback
   locale in memoria non e un limite globale tra tutte le istanze serverless.
9. Ricontrollare privacy, gestione richieste di accesso/cancellazione e termini
   con un professionista prima di estendere il servizio internazionale o Live.

## Limiti espliciti

- Quattordici anni e la soglia gia presente nel progetto, non una conclusione
  legale valida per ogni Paese. La lista dei Paesi non risolve differenze locali
  su consenso dei minori, basi giuridiche o servizi rivolti ai minori.
- Data e Paese sono autodichiarati e modificabili: non verificano identita,
  residenza o maggiore eta. Non usarli per autorizzare automaticamente il pilot.
- Le nuove preferenze non devono diventare pubbliche o essere esportate per
  marketing per il solo fatto di aver creato l'account. Le statistiche di piccoli
  gruppi non sono automaticamente anonime.
- Nessuna funzionalita di vendita dati, GPS continuo, avatar pubblici negli spot
  o estensione dell'accesso Community aggiunta.
- I test con provider simulato non verificano recapito SMTP, dashboard Auth,
  consegna allo spam o comportamento del provider durante un vero cambio email.
- Template con destinazione fissa: dopo conferma si torna alla mappa, non allo
  spot eventualmente aperto prima. I vecchi callback PKCE restano supportati ma
  non attestano la nuova prova email; l'utente puo usare la verifica esplicita.

## Riferimenti tecnici

- https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
- https://supabase.com/docs/guides/auth/general-configuration
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://www.edpb.europa.eu/documents/statement/statement-12025-on-age-assurance_en

## Verifiche eseguite il 10 ottobre

```text
npm test
Test Files  70 passed (70)
Tests       772 passed (772)

npm run build
Compiled successfully
Generating static pages (187/187)
Exit code 0
```

Build con URL e chiavi Supabase fittizi, nessuna scrittura nel database pubblico.
Avvisi non bloccanti: dataset Browserslist da aggiornare e pagina Edge dinamica.

- PGlite: applicate in memoria la migrazione originale dei dati rider e quella
  nuova; test delle date, 249 codici Paese, sport, accesso all'hook, proprietario,
  altro utente, anonimo e vista aggregata. Database chiuso e scartato a fine test.
- Test API/SDK: autenticazione, input invalidi, autoconfirm non ammesso,
  prova email non falsificabile tramite user metadata, callback, limiti invio,
  nessuna iscrizione newsletter automatica, salvataggio dei soli campi richiesti.
- `scripts/check-registration-browser.mjs`: Chrome e WebKit, 320/390/1440 px,
  modulo nella mappa reale con risposte Supabase simulate. Eta rifiutata, sport
  multipli, newsletter spenta, doppio tocco con una sola richiesta, conferma
  email richiesta, nessun overflow o errore JavaScript.
- `scripts/check-account-preferences-browser.mjs`: stessi browser e larghezze,
  componenti reali montati in un harness isolato, non login al profilo pubblico.
  Retry dopo errore, salvataggio, doppio tocco, cooldown email, stato aggiornato
  al ritorno della finestra e nessun overflow.
- Screenshot ispezionati in `/private/tmp/crock-registration-*.png` e
  `/private/tmp/crock-preferences-*.png`.

Nel test signup la CSP viene aggirata SOLO nel contesto Playwright per consentire
il provider fittizio `127.0.0.1:54321`; la CSP dell'app non e stata indebolita.
Le chiamate esterne sono bloccate nei test browser. Nessun account reale creato.
Le prove browser non sostituiscono il collaudo SMTP/Auth reale descritto sopra.
Nessuna dichiarazione di conformita GDPR deriva dal solo codice.

## Aggiornamento: privacy e dati

Implementato nella stessa copia locale, senza modifiche a Supabase o deploy:

- `/impostazioni/privacy`: preferenza analytics del dispositivo anche da ospite;
  per l'account, presenza corrente con Nascondi, consenso separato ai soli totali
  pubblici, newsletter, download e collegamento alla cancellazione.
- Riusa API, provider Sessioni e consensi esistenti. Non abilita Community,
  avatar pubblici, marketing o statistiche in automatico.
- Banner tecnico: Ho capito chiude solo l'avviso. La pagina privacy lascia
  libera la barra mobile e non mostra il dock della sessione sovrapposto.
- `/api/user/export`: solo identita verificata dal token; colonne ammesse
  esplicitamente; pagine da 500 righe, limite 10.000 righe per categoria e
  8 MiB dei dati letti. Nessun risultato parziale in caso di errore o limite.
  Tre richieste per ora per account con il rate limiter esistente (la sua
  garanzia distribuita richiede il backend Redis gia previsto).
- Esporta account, profilo, dettagli rider, sessioni e preferenza totali,
  preferiti. NON e un export completo: foto, contributi, messaggi, newsletter,
  log e dati del browser restano nel percorso di richiesta al titolare.
  Le sessioni scadute vengono rappresentate come da confermare, senza scrivere
  sul database. Le letture paginate non sono uno snapshot transazionale.
- Download e pagina esclusi dalla cache del service worker; API no-store;
  pagina noindex. Nessun token o metadato Auth nel file scaricato.
- Cancellazione: comando leggibile e raggiungibile, conferma mantenuta.
  Testi espliciti sulla permanenza dei contributi e contatto per rimuovere dati
  personali dentro foto/testi. Nessuna falsa promessa di anonimizzazione.
  La procedura distruttiva esistente NON e stata cambiata o eseguita.

Dipendenza di rilascio: l'export legge anche `rider_details.country_code`,
quindi richiede la migrazione di registrazione sopra e le tabelle Sessioni
esistenti. Se lo schema manca, restituisce errore e non un archivio incompleto.
Questo intervento non introduce ulteriori migrazioni e non applica quelle pendenti.
Prima del rilascio restano il collaudo Auth/SMTP e la prova export con utenti
separati in ambiente isolato. Non testare cancellazioni su account reali.

Verifiche aggiuntive: 784 test in 71 file; Chrome e WebKit su 320/390/1440 px,
con API simulate, accesso ospite, nessun consenso implicito, nascondi presenza,
salvataggio/revoca dei totali e errore di rete, download riuscito/fallito,
nessun overflow o errore JavaScript. Script della prova:
`/private/tmp/crock-check-privacy.cjs`; screenshot `privacy-*-account-*.png`.
Il build viene eseguito nella copia temporanea `/private/tmp/crock-privacy-build.pb3Ikf`
senza file `.env` o credenziali reali, per non interrompere il dev server.

Restano decisioni separate: minimizzazione di Paese/data di nascita, metodo di
age assurance, pubblico del Live e relativa valutazione dei rischi; processo
operativo di rimozione dei dati presenti nei contributi e retention dei fornitori.
Non sono risolte da una schermata o da un testo di informativa.
