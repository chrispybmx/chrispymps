# Sessioni personali: prima implementazione locale

Stato 2026-10-07: questa versione e le migrazioni dei totali/Live sono state
pubblicate con autorizzazione del titolare. Vedere
[resoconto del rilascio](deployment/rider-release-2026-10-07.md).
Le diciture "non pubblicato" nei resoconti sotto descrivono lo stato storico.
La presenza Community resta disattivata; notifiche push non implementate.

## Aggiornamento locale 2026-10-05: scheda azioni e timer

- Il tasto + apre una scheda dal basso, a larghezza piena, con Vai in sessione
  e Aggiungi spot. Focus confinato, Escape, chiusura sullo sfondo, ritorno al
  pulsante e preferenza movimento ridotto. Il tasto si abilita dopo hydration.
- Selezionare lo spot mantiene aperto il timer nel pannello della mappa,
  lasciando visibile la mappa. Riaprire una sessione non richiede di nuovo GPS.
  Una sessione scaduta mostra Fine da confermare, non un nuovo avvio.
- Anche il profilo del proprietario mostra soltanto Tempo di sessione e Sessioni.
  Nomi degli spot, date, faccine e correzioni rimangono nella gestione privata
  /sessioni. La pubblicazione dei soli totali resta una scelta separata.
- In Live i pin indicano il numero di rider segnalati e i cluster sommano i
  rider degli spot raggruppati. Nessuna posizione GPS personale viene mostrata.
- Non sono state aggiunte migrazioni o notifiche push. Dopo due ore il timer
  si ferma secondo le scadenze server esistenti e richiede conferma nell'app.
  Per notificare il telefono ad app chiusa servono ancora consenso, subscription,
  invio backend e schedulazione. Nessun deploy o modifica al DB di produzione.

Collaudo aggiunto: scripts/check-map-session-flow.mjs, esclusivamente sulla
preview locale in memoria; copre primo tocco, avvio, timer, refresh, riapertura,
chiusura, profilo pulito e scadenza. Le note piu' vecchie sotto sono storiche.

Risultati del 5 ottobre: 705 test in 65 file passati, inclusa la sequenza di
1000 operazioni. Build finale passata (187 pagine). Playwright Chrome e WebKit:
scheda azioni a 320/390/430 px, profilo/opt-in/revoca a 390/1440 px, Live a
320/390/1440 px, flusso completo sessione a 390 px con fine da confermare e
nessuna richiesta GPS alla riapertura. Screenshot controllati. Non e' un test
su iPhone fisico ne' un test di upload verso Supabase. Con npm start locale:
/map 200, API rider-sessions-preview e rider-stats-preview 404, pagina
/anteprima-sessioni 404 anche mantenendo il flag preview nell'ambiente.

## Aggiornamento locale 2026-10-03: profilo e Live

- Il profilo pubblico mostra i totali delle sessioni solo dopo l'opt-in separato.
  Non legge piu' `spot_riders`, non mostra luoghi girati o citta' visitate.
  Gli spot contribuiti alla community restano in una sezione chiusa "Spot pubblicati".
  Lo storico personale e le correzioni restano accessibili solo al proprietario.
  La vecchia API user-stats non consulta piu' point_events e restituisce recentXP
  vuoto: niente dettagli di spot/date/reason nel payload pubblico del profilo.
- Live filtra la mappa originale sugli spot con presenze condivise valide.
  Pin verdi, conteggio aggregato in lista e freschezza nella scheda dello spot.
  Non identifica i rider, non aggiunge GPS o tracking, non modifica il consenso.
- Un'unica query aggregata `cm_rider_live_map(actor)` verifica flag, pilot,
  blocchi bidirezionali, spot approvato, visibilita', stato e scadenze server.
  RPC solo service_role; l'API risolve l'actor dal bearer verificato.
- Il client aggiorna ogni 20 secondi, su focus/ritorno online e dopo azioni proprie;
  rimuove dati scaduti, in errore/offline, al cambio identita' o scheda nascosta.
  Una risposta vecchia non resta visibile oltre 30 secondi senza aggiornamenti.
- Il timer nella mappa segue l'altezza del pannello mobile e non copre la sua
  maniglia. Lo zoom e' in alto a sinistra, separato da Live e Vicino a me.

Nuova migrazione necessaria: `20261003120000_rider_live_map.sql`, dopo la
migrazione Sessioni originale. Per i totali pubblici serve inoltre
`20261002190000_rider_profile_stats.sql`. Nessuna di queste due nuove migrazioni
e' stata applicata alla produzione durante questo lavoro, nessun deploy eseguito.
La condivisione Community resta limitata agli account autorizzati dal backend.

Collaudo ripetibile: `npm test`, `npm run build`,
`node scripts/check-live-map-browser.mjs` e
`node scripts/check-rider-stats-browser.mjs` (Playwright Chrome/WebKit, solo locale).

Risultati di questo aggiornamento: 705 test in 65 file passati, inclusa una
sequenza di 1000 operazioni Sessioni e i nuovi casi di aggregazione Live.
Passati anche 95 controlli SQL isolati. Browser Live: Chrome e WebKit a
320/390/1440 px (on/off, ripristino mappa, nascondi, scadenza, errore/riprova,
tile caricati, overflow e accessibilita' del tasto). Profilo: entrambi i motori
a 390/1440 px (opt-in, revoca, refresh, solo contatori). Non e' una prova su
un iPhone fisico e non e' stato utilizzato il database di produzione.
Build finale `npm run build` passata. Sul relativo `npm start` locale:
Live senza autenticazione 401; API demo Sessioni, API demo statistiche e
pagina anteprima 404, anche senza applicare migrazioni alla produzione.

Aggiornamento 2026-10-02: il prototipo e' stato collaudato e le sessioni private
sono state pubblicate sul progetto reale, con autorizzazione del proprietario.
Il perimetro locale e i limiti di esecuzione descritti sotto sono lo storico
del prototipo. Per lo stato corrente vedere `deployment/rider-release-2026-10-02.md`.

## Perimetro

Solo `crock-lab`. Il sito originale, il database remoto, storage, email e deploy
non sono stati modificati. La preview usa PostgreSQL in memoria (PGlite), non
Supabase. Account, autorizzazione pilot e spot della preview sono sintetici.

## Flusso

- Dalla mappa: + -> Vai in sessione. Posizione richiesta una sola volta,
  solo lo spot piu' vicino entro 500 metri; Non e' questo? apre la ricerca manuale.
  Selezionare uno spot avvia il timer con la visibilita' scelta, privata di default.
- Aggiungi spot riusa il modulo foto/moderazione reale; uno spot pending puo'
  ospitare solo una sessione privata del suo autore. Nella preview l'aggiunta
  rapida crea invece una bozza locale, mai pubblicata nell'indice della mappa.
- Profilo demo: `/u/rider_demo`, raggiungibile dalla navigazione inferiore.
  Timer HH:MM:SS, Tempo in sessione, storico e tre faccine private.

- Scheda nella mappa e pagina spot: Inizio sessione, scelta Solo io / Community,
  una sola conferma per iniziare il timer e, se consentito, segnalare la presenza.
- Solo io e' sempre il valore iniziale. Nessuna amicizia approvata disponibile,
  quindi nessuna opzione Amici. Il pilot Community richiede autorizzazione server.
- Barra persistente per la sessione attiva; gestione completa in `/sessioni`.
- Profilo: storico privato. Nella nuova versione locale i totali possono essere
  condivisi separatamente dal proprietario, con scelta iniziale disattivata.
  Richiede 20261002190000_rider_profile_stats.sql (non ancora applicata online).
- Il rinnovo esplicito estende di due ore. Nascondi presenza non chiude il timer
  e un successivo rinnovo non ripubblica la presenza nascosta.
- Alla scadenza la durata si ferma alla deadline; lo storico propone la fine
  da confermare. Nessuna ora non confermata entra nei totali.
- Correzione della fine con fuso orario del dispositivo, conferma ed eliminazione.
- Si misura il tempo della sessione. Non movimento, riding stimato o calorie.

## Dati e permessi

Migrazione necessaria: `supabase/migrations/20261002_rider_sessions.sql`.
Prerequisiti: schema esistente e `20260925_private_session_invites.sql` per i blocchi.
La migrazione e' stata eseguita solo nei database locali temporanei dei test/demo.

- `cm_rider_sessions`: storia privata, timestamp server, stato, visibilita',
  spot, versione e fonte `manual`. Una futura fonte CROK richiedera' una
  migrazione esplicita. Il tempo stimato di riding non e' implementato.
- `cm_rider_presences`: autorizzazione temporanea separata, senza coordinate personali.
- `cm_rider_settings`: kill switch DB, inizialmente falso.
- `cm_rider_pilot`: account autorizzati manualmente; non e' una verifica dell'eta'.
- `cm_rider_commands`: idempotenza persistente, solo ID e fingerprint. I tombstone
  impediscono che il retry di un avvio cancellato ricrei lo storico; eliminati
  in cascata con l'account. Definire una retention prima del rilascio generale.
- RLS attiva e nessun accesso diretto anon/authenticated alle tabelle o RPC.
  Il backend verifica il token con Supabase e passa esclusivamente quell'identita'.
- RPC server-only: snapshot privato, comando atomico, conteggio presenze.
  Lock per utente e indice univoco impediscono due sessioni attive.
- Le query presenza escludono immediatamente deadline/scadenze trascorse anche
  senza app, cron o richiesta del proprietario. Lo snapshot materializza lo stato
  da confermare al prossimo accesso. Il timer client e' limitato alla deadline.
- Il pilot limita anche chi legge. Conteggi senza nickname, coordinate o storico;
  filtro dei blocchi in entrambe le direzioni. Revoca del pilot efficace nelle query.
- API no-store; service worker esclude sessioni e preview; nessuna integrazione
  di queste informazioni in advertising, AI o notifiche commerciali.

La migrazione revoca anche la lettura pubblica dei vecchi `sessions` senza
cancellarne i record; l'API GPS legacy non accetta piu' scritture. Non trasforma
i vecchi check-in in ore confermate. Non riattivare quella API con nuovi client.

## Attivazione in staging (non eseguita)

1. Backup separato del DB e verifica migrazioni prerequisito.
2. Applicare la migrazione al progetto di staging, non a produzione.
3. Configurare credenziali staging e `RIDER_SESSIONS_ENABLED=true`,
   `NEXT_PUBLIC_RIDER_SESSIONS_ENABLED=true`; rebuild per il flag pubblico.
4. Provare almeno due account reali di test con login, logout, refresh token,
   permessi e dispositivi diversi. Nessun utente reale durante il collaudo.
5. Condivisione DB ancora spenta. Prima del pilot: autorizzare account adulti
   attraverso un processo definito dal titolare, revisione informative,
   gestione abusi/segnalazioni, cancellazione e conservazione; poi abilitare
   il kill switch DB. Non e' una dichiarazione di conformita' GDPR.

Rollback operativo: spegnere flag server/client e kill switch DB. Conservare
le sessioni private; non ripristinare la vecchia policy pubblica automaticamente.

## Preview locale

Aggiornamento: la preview ora vive anche nella mappa originale, su
`http://127.0.0.1:3200/?spot=jungle-merano-17fe5a`. La scheda sulla mappa usa
lo stesso MapClient, con 126 spot e foto pubblici letti il 2026-10-02 e salvati
in `.preview-data/` (esclusa da Git). Le API mappa leggono questi snapshot solo
con flag development e host loopback. Nessuna presenza pubblica reale viene
importata: sessioni e account demo rimangono locali. Il collegamento
Sessioni / account demo porta allo storico. Le altre funzionalita' che
richiedono Supabase, incluse le pagine complete dei profili, non ricevono
credenziali di produzione e non sono parte del percorso demo.

Avvio dalla cartella crock-lab:

```sh
WATCHPACK_POLLING=true NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-preview-only RIDER_SESSIONS_PREVIEW=true npm run dev -- --hostname 127.0.0.1 --port 3200
```

Aprire `http://127.0.0.1:3200/anteprima-sessioni`.
Spot -> Inizio sessione -> Solo io/Community -> Conferma e inizia.
Profilo rider mostra durata, storico, correzione ed eliminazione. Nei controlli
di collaudo e' disponibile Simula scadenza con app chiusa. La simulazione muove
i timestamp nel passato solo nel database demo. Il refresh conserva i dati;
riavviare il server li azzera. Le pagine reali che richiedono Supabase non sono
alimentate da questo DB demo.

Preview/API ammesse solo in development con flag e host loopback. Verificato
che in `next start`, anche con il flag acceso, entrambe rispondono 404.

## Verifica

- Le suite includono regressioni sulla cancellazione spot/account, conservazione
  delle ore, stop delle sessioni aperte, pulizia foto e scelta del solo spot vicino.
- Test reali PostgreSQL e route handler: avvio, retry, concorrenza, refresh,
  fine, scadenza, conferma, correzione, eliminazione, totali, revoca e blocchi,
  permessi anon/authenticated/service_role, token invalido, input manipolati.
- Build locale passata con endpoint loopback e chiavi fittizie. Non valida
  la disponibilita' dei dati o servizi Supabase reali.
- `node scripts/check-rider-preview.mjs`: collaudo HTTP locale ripetibile;
  cancella soltanto le fixture demo, mai sessioni Supabase.
- `scripts/check-rider-browser.mjs`: collaudo Playwright predisposto per
  390x844 e 1440x1000. Richiede Playwright nel toolchain o PLAYWRIGHT_MODULE;
  CHROME_PATH facoltativo. Il browser non si avvia in questo ambiente
  (SIGABRT/EPERM, sia Chrome sia Chromium). Nessuno screenshot verificato.

## Limiti aperti

- Correzione nella migrazione Sessioni ancora NON applicata in produzione:
  spot_id nullable con ON DELETE SET NULL; trigger di fine da confermare;
  storico preservato tramite LEFT JOIN e dicitura Spot eliminato.
  Non riapplicare la migrazione iniziale su database dove esiste gia': in quel
  caso serve una migrazione incrementale. La preview in memoria va riavviata.
- La cancellazione admin elimina prima la riga DB, poi i file. Un errore storage
  viene segnalato nell'interfaccia; la pulizia dei file residui e' manuale,
  non esiste ancora una coda durevole di retry.

- Collaudo visuale/interattivo mobile e desktop non completato: non rilasciare
  basandosi soltanto sui test HTTP/SQL. Verificare anche barra sessione vs
  pannello mappa, bottom nav e banner cookie, tastiera e lettore di schermo.
- Test Supabase staging end-to-end non eseguiti (nessuna credenziale staging).
- Storico restituito interamente: aggiungere paginazione prima di grandi volumi.
- Correggibile l'orario di fine; l'inizio rimane il timestamp server originale.
- Nessuna chat/amicizia nuova, nessun GPS continuo, BLE, firmware o AI Coach.
  Non viene rilevato il cambio spot durante gli spostamenti.
- Nessun caricamento foto reale di collaudo: codice upload invariato e test
  automatici esistenti inclusi nella suite passata.
