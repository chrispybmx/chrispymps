# Migrazione session applicata — 26 settembre 2026

Progetto pubblico Supabase `chrispymps` (`aoiuzmidvbfukemkhajk`). Il proprietario ha approvato specificamente l’applicazione della migrazione dopo essere stato informato dell’assenza di staging e dei nuovi permessi per inviti e chat privati.

## Esecuzione

- File: `supabase/migrations/20260925_private_session_invites.sql`.
- SHA-256: `547f60072af363752fa7aa0d0e427cab693cae4651a4bdee0d32f95883717cbf`.
- Prima di Run, copia integrale del contenuto dell’editor confrontata con il file locale: identici, 22.480 caratteri.
- Esecuzione transazionale BEGIN/COMMIT tramite SQL Editor; risultato: “Success. No rows returned”.
- Nessun dato applicativo di prova inserito, nessun account creato, nessun invito o email inviato in questa fase.
- Esecuzione manuale: non è stata aggiunta una voce artificiale in `supabase_migrations.schema_migrations`. Riconciliare lo storico prima di un futuro db push; questo script non è idempotente e non va rilanciato.

## Verifiche remote dopo COMMIT

| Tabella | RLS | Lettura anonima | Lettura authenticated | Scrittura browser | Righe |
|---|---|---|---|---|---|
| cm_session_invites | sì | no | solo partecipanti | no | 0 |
| cm_session_messages | sì | no | partecipanti, invito accepted/blocked | no | 0 |
| cm_session_blocks | sì | no | solo proprietario | no | 0 |
| cm_session_preferences | sì | no | solo proprietario | no | 0 |
| cm_session_reports | sì | no | no | no | 0 |
| cm_session_email_outbox | sì | no | no | no | 0 |

Le dieci funzioni `cm_session_*` non sono eseguibili da anon/authenticated; service_role può eseguirle. Le tabelle consentono le scritture a service_role. I controlli hanno usato pg_class, pg_proc, pg_policies, has_table_privilege, has_function_privilege e conteggi aggregati: nessun dato personale letto.

Mappa pubblica ricaricata: 116 spot nella vista iniziale. Percorso lista → anteprima Skatepark Assemini → pagina spot completato; presenti fotografia, categoria, caratteristiche e link indicazioni. Questo è un controllo di navigazione e caricamento, non un collaudo di tutte le funzionalità.

## Test e limiti

Le 39 verifiche SQL locali passavano prima dell’applicazione, con stato spot di tipo enum come in produzione. La verifica remota conferma schema e ACL/RLS, ma non sostituisce una prova applicativa con due account e un terzo estraneo.

Nessun deploy, modifica ai flag, cron o piano a pagamento effettuato. Inviti/chat restano disattivati. Prima dell’attivazione: ambiente isolato, configurazione server, limiti condivisi, scheduler email e collaudo invito → accettazione → messaggi → blocco/segnalazione. Non eliminare le tabelle per annullare un rilascio applicativo: usare i flag server.
