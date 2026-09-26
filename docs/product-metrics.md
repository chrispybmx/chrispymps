# Contatori di utilizzo — 26 settembre 2026

Implementazione predisposta, raccolta disattivata. Non è stata eseguita alcuna migrazione remota. Il sistema non certifica la conformità legale del sito.

## Cosa misuriamo

| Evento | Quando si conta | Provenienza |
| --- | --- | --- |
| search_used | Scelta di una città, un luogo o uno spot dalla ricerca della mappa; invio di una ricerca non vuota in Scopri | map / discover |
| spot_view | Montaggio della pagina di uno spot esistente, dopo il caricamento nel browser | detail |
| directions_open | Click normale, da tastiera o centrale sul collegamento indicazioni contrassegnato | map / detail |
| contribution_open | Apertura del modulo aggiungi spot | add |
| contribution_sent | Risposta positiva ricevuta dal browser dopo l'invio dello spot | add |

Non sono persone uniche, sessioni, tassi di conversione individuali, ricerche digitate, visite fisiche o contributi approvati. I caricamenti ripetuti si contano nuovamente. Non si misurano clic su copia link o apertura dal menu contestuale. Una ricerca digitata senza conferma in Scopri non viene contata. Le due modalità di ricerca hanno semantiche diverse; il database le distingue per provenienza.

Il payload ha esattamente due campi enumerati: event e source. Non invia query, nome dello spot, slug, URL, coordinate, email, ID utente o tentativo. Nessun cookie o localStorage analitico. Fetch omette credenziali e referrer, rispetta DNT/GPC, scade senza bloccare l'azione. Nessuna coda offline, nessun retry automatico.

Il server e i fornitori di hosting ricevono comunque una normale richiesta HTTP: IP e intestazioni possono comparire nei loro log. Occorre verificare separatamente impostazioni, accessi e conservazione dei log. Il progetto non afferma che tutta la catena sia anonima solo perché la tabella è aggregata.

## Architettura e limiti

- Una riga per giorno UTC, evento e provenienza; incremento atomico SQL. Massimo 7 combinazioni al giorno.
- RLS senza policy pubbliche; solo service_role legge/scrive ed esegue le funzioni. Il rapporto HTTP richiede autenticazione admin.
- Endpoint pubblico con verifica origine, vocabolario chiuso, massimo 160 byte e limite globale di 300 richieste/minuto. Nessuna chiave individuale o IP nel rate limiter. Senza Upstash il limite è per istanza; configurarlo per un limite condiviso. Non è una misura antifrode: bot capaci di imitare richieste possono alterare i contatori. Non usarli per premi o fatturazione.
- Conservazione scelta per questa prima versione: 90 giorni UTC (oggi e gli 89 precedenti). È una scelta di prodotto, non un termine imposto dalla legge. Pulizia ad ogni incremento e funzione separata per la pulizia quotidiana anche in assenza di traffico.
- Dashboard: Admin → Numeri, ultimi 30 giorni UTC. Stato disattivato e errori espliciti, nessuna finta statistica in caso di errore.
- Vecchio funnel di registrazione ritirato: client compatibile senza invii, endpoint HTTP 410 anche per vecchi browser. I dati storici non sono stati cancellati. La relativa sezione admin è etichettata come storico.

## Attivazione controllata

1. Completare la verifica privacy descritta nel rapporto di audit: finalità e base giuridica, eventuali condizioni di esenzione dal consenso, fornitori e log. “Senza cookie” non significa automaticamente “senza consenso”. Il banner “Ho capito” non costituisce consenso agli analytics.
2. Integrare l'informativa pubblica con descrizione dei contatori, dati, destinatari, tempi e diritti coerenti con la valutazione. Se risulta necessario il consenso, aggiungere una vera gestione delle preferenze che blocchi gli invii prima dell'adesione; non attivare i flag attuali come sostituto del consenso. La bozza qui sotto non è un'informativa completa.
3. Su staging con dati di test applicare soltanto `supabase/migrations/20260926_product_metrics.sql`, attraverso il normale sistema di migrazione Supabase. Nessun SQL riguarda spot, utenti o chat. La migrazione è transazionale e versionata, non va ripetuta manualmente dopo il successo.
4. Verificare permessi, incremento concorrente e cancellazione. Il file `scripts/check-product-metrics-sql.mjs` esegue controlli PostgreSQL isolati tramite PGlite; non prova lo stato del database remoto.
5. Configurare un CRON_SECRET forte e un job giornaliero che chiami `GET /api/internal/product-metrics-retention` con `Authorization: Bearer <CRON_SECRET>`. In alternativa schedulare direttamente `SELECT public.cm_purge_product_metrics()` nel database con un ruolo autorizzato. Non creare due job. Allertare sui fallimenti; mantenere la pulizia attiva anche quando la raccolta è spenta. Nessun job di produzione è stato configurato da questa modifica.
6. Impostare `NEXT_PUBLIC_PRODUCT_METRICS_ENABLED=true` e `PRODUCT_METRICS_ENABLED=true` nell'ambiente di staging, ricostruire e verificare gli eventi end-to-end. Poi applicare lo stesso rilascio alla produzione dopo revisione. Non inviare eventi di test al database reale.
7. Emergenza: `PRODUCT_METRICS_ENABLED=false` ferma le scritture sul server (riavvio/rilascio secondo hosting); il flag pubblico false e un nuovo build fermano anche le richieste dei nuovi client. Non cancellare tabelle per fare rollback applicativo.

## Bozza descrittiva da completare nell'informativa prima dell'attivazione

«Per capire se la mappa aiuta a trovare uno spot, contiamo in forma aggregata le ricerche confermate, le aperture delle schede, i clic sulle indicazioni e le aperture e gli invii del modulo aggiungi spot. I contatori sono raggruppati per giorno e sezione del sito. Non conserviamo nei contatori il testo cercato, il luogo consultato, coordinate, email o identificatori dei rider. Non colleghiamo le azioni tra loro. I contatori sono conservati per 90 giorni. Le richieste tecniche e i relativi log sono trattati secondo quanto descritto nella sezione hosting e sicurezza.»

Completare con la base giuridica valutata, il ruolo effettivo di Supabase/hosting, i trasferimenti pertinenti e i tempi dei log. Non aggiungere dichiarazioni di anonimato assoluto o certificazioni GDPR.
