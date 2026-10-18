# Hosting e prerequisiti del prossimo rilascio

Verifica di Vercel e dello schema Supabase del 26 settembre 2026, seguita dall’applicazione autorizzata della migrazione session. Nessun segreto è stato rivelato o copiato dalla dashboard, nessun deploy o cambio di piano eseguito.

## Vercel

Team `chrispybmxs-projects`, piano **Hobby**, progetto `chrispymps`. Production segue `main` sul dominio maps.chrispybmx.com. Preview segue gli altri branch. Questi ambienti Vercel non costituiscono un database di staging: il progetto ha un’unica configurazione Supabase applicata a tutti gli ambienti e nessun secondo progetto Supabase risulta presente.

Variabili del progetto osservate (solo nomi): RESEND_API_KEY, MAILERLITE_GROUP_ID, MAILERLITE_API_KEY, NEXT_PUBLIC_GOOGLE_MAPS_KEY, ADMIN_PASSWORD, ADMIN_SECRET, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SITE_URL. Nessuna variabile condivisa collegata. Non sono presenti flag session/newsletter/metriche, variabili Redis o CRON_SECRET. La presenza di una variabile non dimostra che il suo valore sia valido.

La pagina Cron Jobs mostra la funzione globale abilitata ma la schermata iniziale di configurazione, senza job elencati. Non è prova di un cron attivo. Sul piano Hobby non usare l’esempio minuto/5 minuti presente nel repository senza risolvere prima la scelta dello scheduler.

Vercel segnala alcune credenziali storiche come variabili Config invece di Secret. Non sono state aperte, ruotate o convertite durante questa verifica; valutare la corretta classificazione separatamente, preservando i valori.

## Migrazione session

La lettura del catalogo SQL conferma:

- `auth.users.id`: uuid.
- `profiles`: id uuid, username text, avatar_url text.
- `spots`: id uuid; name, slug e city text; status di tipo enum `spot_status`.
- Prima della migrazione: nessuna relazione o funzione con prefisso `cm_session_` in `public`.
- Le estensioni `pg_cron` e `pg_net` non risultano installate.

Il test SQL locale è stato aggiornato per usare un enum per lo stato degli spot, come il database reale. Le 39 verifiche passano. Dopo conferma specifica del proprietario, la migrazione `20260925_private_session_invites.sql` è stata **applicata al database pubblico**. Il testo nell’editor corrispondeva esattamente al file locale collaudato; Supabase ha restituito successo. Verificati sei tabelle vuote con RLS, quattro policy SELECT per proprietario/partecipanti, nessuna lettura anonima né scrittura browser, dieci funzioni non eseguibili da anon/authenticated e accessibili a service_role. Esecuzione manuale, non registrata automaticamente nella migration history: non rilanciare la migrazione. Non abilita automaticamente la UI o le email. Rimangono necessari configurazione, deploy e prova con due account.

## Dipendenze per il rilascio

1. Preparare un ambiente di prova separato per il collaudo completo; la migrazione session sul pubblico è già applicata. La mappa pubblica ha caricato 116 spot nella vista iniziale e il percorso lista → anteprima → pagina spot ha funzionato dopo la migrazione.
2. Configurare un limite Redis condiviso per la ricerca geografica prima del deploy del nuovo proxy.
3. Preparare flag, segreti e scheduler per le funzioni che si intende attivare. Non accendere tutte le funzioni con configurazione parziale.
4. Pubblicare i callback prima dei template TokenHash. La versione italiana pubblicata oggi mantiene invece ConfirmationURL ed è compatibile con il sito attuale.
5. Collaudare conferma e recupero completi, inviti/accettazione/chat/blocco, opt-in e code. Attivare poi una funzione alla volta.
