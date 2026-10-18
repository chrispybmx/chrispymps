# Collaudo integrato e prossimi vincoli — 26 settembre 2026

## Eseguito

Aggiunta `__tests__/session-invites-integration.test.ts`: gli handler Next.js reali chiamano le funzioni della migrazione reale in un PostgreSQL PGlite temporaneo. L’adattatore risolve i parametri RPC per nome attraverso PostgreSQL, così cambiamenti incompatibili delle firme fanno fallire il collaudo. Solo il servizio di identità, il trasporto e il limite esterno sono sostituiti; le regole SQL sono quelle del prodotto. Ogni scenario parte da tabelle session vuote.

Scenari verificati:

1. Invito, retry senza duplicazioni, inbox e badge, chat chiusa prima dell’accettazione, rifiuto degli estranei, accettazione del destinatario, messaggi, lettura, segnalazione, blocco, sblocco senza riapertura della vecchia chat.
2. Avvisi email spenti per default, opt-in, accodamento persistente, revoca che rimuove il lavoro, annullamento dell’invito. Nessuna chiamata a un provider email.
3. Identità sconosciuta respinta e flag server che interrompe gli accessi senza interrogare il database.
4. 45 inviti con timestamp identico: cursore con microsecondi/UUID, due pagine senza perdite o duplicazioni.
5. 85 messaggi: pagine precedenti in ordine e aggiornamenti incrementali senza salti o duplicazioni.

Risultati: **642 test in 55 file passati**, TypeScript senza errori; **95 verifiche SQL** passate (12 vista pubblica, 39 session, 31 newsletter, 13 metriche). `git diff --check` pulito. Nessun nuovo build eseguito: le modifiche di questa fase riguardano collaudo, dipendenza di sviluppo e documentazione, non il codice applicativo.

PGlite 0.5.8 è ora fissato nelle devDependencies e nel lockfile. Dopo l’installazione standard bastano `npm run verifica:session` e `npm run verifica:sql`; non serve più indicare una cartella temporanea esterna.

## Controllo remoto in sola lettura

`npm run verifica:rilascio -- --remote --all-features --json` conferma che le sei nuove tabelle session e i sette RPC applicativi sono esposti dal catalogo REST del progetto configurato. Controlli con GET/HEAD, senza record restituiti o mutazioni.

Il report segnala ancora dieci blocchi rispetto all’obiettivo di attivare tutte le funzioni: quattro flag spenti (session, metriche, newsletter, email inviti), segreto webhook MailerLite mancante, CRON_SECRET e segreto worker mancanti, due variabili Redis mancanti, conferma account non richiesta. Questi sono controlli dell’ambiente configurato localmente più le impostazioni Auth lette dal servizio; non certificano i valori di tutti gli ambienti Vercel. Restano tre verifiche manuali: consegna email, scheduler, collaudo delle policy con account reali. Il comando diagnostico non usa exit 1 senza `--strict`.

## Staging: modulo preparato, progetto non ancora creato

Nella dashboard dell’organizzazione Free è stato preparato il modulo per `chrispy-maps-staging`, regione Europe, Data API abilitata, concessione automatica sulle nuove tabelle disabilitata, RLS automatica abilitata. Il campo password è vuoto. Nessun nuovo progetto, credenziale, piano a pagamento o collegamento a Vercel è stato creato.

Il proprietario deve inserire e conservare personalmente la password, poi completare la creazione. Quindi occorrono schema di staging verificato, soli dati sintetici, account di prova e preview collegata esclusivamente a questo progetto. Le impostazioni del modulo sul computer non si trasferiscono automaticamente a un altro browser sul telefono.

## Non ancora dimostrato

- Flusso completo nel browser con autenticazione Supabase reale e due account.
- Consegna della nuova email italiana e cambio password personale.
- Esecuzione periodica dei worker sull’hosting e sincronizzazione/revoca MailerLite reale.
- Attivazione o deploy delle funzioni nuove. I test locali non equivalgono a un rilascio pubblico.
