# Verifica diretta del progetto pubblico — 26 settembre 2026

Progetto verificato: `chrispymps`, ref `aoiuzmidvbfukemkhajk`. Controlli attraverso Supabase Dashboard e query del catalogo; nessuna esportazione degli utenti. Il progetto pubblico è l’unico ambiente cloud disponibile.

## Correzione applicata: vista pubblica degli spot

La vista `public.public_spots_geojson` era automaticamente modificabile (`is_updatable=YES`), senza `security_invoker`, con permessi INSERT/UPDATE/DELETE anche per `anon` e `authenticated`. Espone una selezione di campi degli spot approvati. Sono stati verificati PostgreSQL 17, RLS attivo sulla tabella `spots`, policy SELECT sugli approvati e permessi di lettura dei ruoli. Non sono state tentate scritture sui dati reali per dimostrare il problema.

Applicata la migrazione `supabase/migrations/20260926153000_public_spots_read_only.sql`: la vista rispetta ora i permessi/RLS del chiamante e non concede scritture a PUBLIC, anon e authenticated. Colonne, filtri, dati e permessi di servizio restano invariati.

L’applicazione remota è stata racchiusa in una transazione che confrontava il numero di righe prima e dopo, impersonando separatamente anon, authenticated e service_role. Una differenza o un errore di accesso avrebbe annullato la transazione. Esito finale osservato:

| Controllo | Esito |
|---|---|
| `security_invoker` | true |
| SELECT anon | true |
| INSERT/UPDATE/DELETE anon | false |
| INSERT/UPDATE/DELETE authenticated | false |
| Conteggio leggibile dei tre ruoli | invariato |

Il test `scripts/check-public-spots-view-sql.mjs` passa 12 verifiche su dati sintetici: lettura approvati, negazione delle tre scritture per entrambi i ruoli, rispetto delle RLS, accesso servizio, conservazione dati e riapplicazione della migrazione. Lo schema iniziale è stato aggiornato per prevenire la ricomparsa dei permessi nei nuovi ambienti.

La migrazione è stata eseguita manualmente; non è stata inserita una voce artificiale nella cronologia Supabase. Alla futura sincronizzazione CLI va contabilizzata questa applicazione. La migrazione è idempotente. Non ripristinare i precedenti permessi di scrittura per fare rollback applicativo.

Riferimento tecnico: [PostgreSQL CREATE VIEW](https://www.postgresql.org/docs/17/sql-createview.html).

## Email e configurazione

- SMTP Supabase personalizzato attivo su Resend, porta 465, intervallo 60 secondi. Nessuna credenziale letta o sostituita.
- Confirm Email disattivato, email e Google abilitati. Le iscrizioni attuali non richiedono un click di verifica.
- Site URL corretto sul dominio pubblico. Allowlist per dominio pubblico, dominio Vercel e localhost:3000; manca la porta 3100 dell’anteprima locale.
- Una richiesta di recupero autorizzata sul sito pubblico ha prodotto il messaggio di invio riuscito. L’account indicato dal proprietario esiste già. Ricezione, apertura del link e cambio password non ancora verificati. Nessun nuovo account creato.
- Nessun template, flag di conferma o credenziale SMTP cambiato. I nuovi template vanno coordinati con il deploy del codice.

## Database e limiti

- Le quattro tabelle newsletter/metriche sono presenti con RLS attivo. Questo non certifica da solo tutte le policy o i processi di sincronizzazione.
- Nessuna tabella `cm_session_%`: la migrazione per inviti e chat private è ancora necessaria.
- Nove migrazioni registrate, ultima `20260430200 add_sessions`; il catalogo contiene anche oggetti successivi. La cronologia non è sufficiente per stabilire cosa manca.
- Nessuna attivazione di cron, migrazione session, nuovo ambiente, deploy applicativo o piano a pagamento effettuata in questa verifica.

Dopo l’applicazione, ricaricato il sito pubblico: marker e lista vengono nuovamente caricati, con 116 spot nell’inquadratura iniziale osservata prima e dopo. Il controllo sul numero di righe della vista è stato eseguito separatamente nel database; il numero nell’interfaccia dipende dall’inquadratura.

## Aggiornamento successivo: email e session

Il primo recupero è stato ricevuto nello spam; il proprietario ha riportato SPF, DKIM e DMARC PASS. Successivamente pubblicati mittente Chrispy Maps e template italiano con ConfirmationURL. La ricezione del secondo messaggio e il recupero completo restano da verificare.

Dopo approvazione specifica è stata applicata anche la migrazione session. I punti precedenti descrivono lo stato prima di questa applicazione; per esito e limiti aggiornati vedere `session-migration-production-2026-09-26.md`. Nessun deploy o cron attivato.
