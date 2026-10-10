# Rilascio del 2026-10-02

Questo documento e' storico. Il deployment corrente e le due migrazioni
successive sono documentati in [rilascio 2026-10-07](rider-release-2026-10-07.md).

## Collaudo esteso del 2026-10-03

Nessun deploy, push, migrazione remota, account reale o invio email in questo
collaudo. Scritture limitate ai database sintetici locali e alle cache di browser
di prova. Le statistiche pubbliche dei profili restano NON pubblicate.

Risultati finali:

```text
Test Files  64 passed (64)
Tests       701 passed (701)
Stress      1000 operazioni miste, seed 20261003, due utenti isolati
SQL         95 verifiche: 12 spot, 39 inviti, 31 newsletter, 13 metriche
Build       npm run build: compilazione, TypeScript, lint e 187 pagine riusciti
Online CSP  23 pagine HTTP 200, nonce degli script corrispondente
Online SEO  canonical, noindex, veri 404 e sitemap (205 URL, 126 spot) verificati
```

Le 1000 operazioni sono uno stress test aggiuntivo, NON 1000 test unitari
indipendenti. Coprono avvii/richieste ripetute, fine, scadenza ad app chiusa,
correzioni e versioni obsolete, cancellazioni, faccine, condivisione/revoca,
payload contraffatti e mutazioni di sessioni altrui. A ogni passo vengono
ricontrollati unicita' della sessione attiva, separazione utenti e totali.

Browser e HTTP:

- Chrome locale, 390/1440px: avvio, refresh, fine, storico privato, eliminazione.
- Chrome e WebKit locali, 390/1440px: privacy iniziale, opt-in dei totali,
  sola aggregazione pubblica, persistenza dopo refresh e revoca.
- WebKit online, 390/430px: menu touch, blur senza destinazione, riapertura,
  Escape, focus/tocco esterno, Aggiungi spot apre accesso da ospite.
- Chrome e WebKit online, 320/390px: prima visita, cookie sopra la navigazione,
  onboarding, GPS negato, ricerca manuale e apertura accesso per aggiunta spot.
  Nessun overflow/pageerror; Accetta del banner non avvia analytics.
- Chrome e WebKit online: vecchia pagina inserita nella sola cache del browser
  di test viene sostituita online. Ripiego HTML offline verificato su Chrome.
  Il limite dell'emulazione offline WebKit descritto sotto resta aperto.
- API preview locali: retry, presenza autorizzata, revoca, scadenza, correzione,
  cancellazione, bozza pending privata, faccine e assenza dal catalogo pubblico.
- Build locale in modalita' production, credenziali fittizie: /anteprima-sessioni,
  /api/rider-sessions-preview e /api/rider-stats-preview rispondono 404.

Difetto trovato e corretto SOLO IN LOCALE:

- Nella schermata Vai in sessione, "Lo spot manca? Aggiungi spot" era disabled
  durante l'attesa del GPS. Riprodotto sul sito online simulando GPS senza risposta.
- Rimosso il disabled legato a locating in components/NearbySessionStart.tsx:
  nel flusso reale l'aggiunta non richiede coordinate gia' disponibili.
  La bozza demo, se priva di coordinate, restituisce il messaggio previsto.
- Due test di regressione fallivano prima della correzione e passano dopo.
  Apertura dell'accesso da questo pulsante verificata con GPS ancora pendente
  nella build compilata locale, sia Chrome sia WebKit.
- Non prova che fosse la causa del problema sul telefono dell'utente;
  e' un caso distinto dal menu + e non e' stato ancora pubblicato.

Limiti e verifiche manuali:

- /auth/v1/settings di Supabase conferma mailer_autoconfirm=true: la proprieta'
  dell'email non viene verificata tramite conferma. Impostazione non modificata.
- Ricezione reale delle email, recupero password e nuovo caricamento completo
  in produzione NON ripetuti oggi. Upload, EXIF, retry e API di invio sono coperti
  dalla suite automatica; il precedente collaudo live resta documentato sotto.
- Rilettura della configurazione Vercel tramite API ha restituito HTTP 403.
  La copia locale .env.production.local e' precedente alle ultime modifiche dei
  flag: le sue segnalazioni di flag spenti/limiter assente NON sono diagnosi della
  produzione attuale. Non affermare di avere riverificato webhook e scheduler.
- Sono prove browser automatizzate, non su un iPhone fisico del titolare e
  non un load test della produzione o una certificazione di sicurezza/privacy.

Comandi ripetibili aggiunti: scripts/check-map-first-visit.mjs,
scripts/check-map-gps-pending.mjs; regressioni in
__tests__/nearby-session-start-ui.test.ts e __tests__/rider-sessions-integration.test.ts.
Anteprima riavviata su http://127.0.0.1:3200 con Supabase fittizio e database
PGlite locale. Il server di collaudo production sulla 3201 e' stato fermato.

## Sviluppo locale successivo: totali pubblici facoltativi

Non ancora pubblicato, migrazione NON applicata a Supabase:
`supabase/migrations/20261002190000_rider_profile_stats.sql`.

- Preferenza privata `cm_rider_stats_preferences`, false per default, eliminata
  con l'account. RPC solo service_role, identita' verificata via getUser nell'API.
- `/api/rider-stats`: preferenza del proprietario autenticato e lettura dei soli
  totali condivisi. Risposte no-store; nessuna sessione, data, luogo o faccina.
- Condivisione dei totali indipendente dalla presenza Community. Solo sessioni
  confirmed; modifiche ed eliminazioni sono ricalcolate dalla query.
- Blocchi rispettati per visitatori autenticati. I totali esplicitamente pubblici
  restano accessibili da anonimi: il blocco non e' una garanzia di riservatezza.
- Il profilo pubblico controlla la revoca ogni 30 secondi e al ritorno alla pagina;
  il server smette subito di restituire i totali dopo la revoca.
- UI in components/RiderProfileStats.tsx, integrata nel profilo. Storico personale
  e faccine restano privati. Testo della privacy aggiornato nella copia locale.
- 694 test / 62 file passati. Build locale riuscita con credenziali fittizie.
- `scripts/check-rider-stats-browser.mjs`: Chrome e WebKit, 390/1440px;
  opt-in, privacy iniziale, refresh, revoca, nessun overflow o errore browser.
- Anteprima esclusivamente development + flag + host loopback, su database
  PGlite temporaneo: /u/rider_demo e /u/rider_demo?view=public.
- Per il rilascio: backup corrente, applicare SOLO questa migrazione dopo quelle
  gia' registrate, registrare la versione, build/deploy e verifica con account
  di prova. Nessuna attivazione automatica per gli utenti esistenti.

## Stato corrente: pubblicato

- Dominio maps.chrispybmx.com verificato tramite API Vercel: punta a
  dpl_g9XXeokLFjLczf2QAkUHgtwhde8W, build READY e promozione riuscita.
- URL immutabile: https://chrispymps-j9pqb68ct-chrispybmxs-projects.vercel.app.
- Supabase aoiuzmidvbfukemkhajk: applicate via CLI db query in transazione
  20261002_rider_sessions.sql e 20261002170000_geocoding_slot.sql.
- Le due versioni sono state registrate come applied nello storico Supabase
  con migration repair, dopo l'applicazione e il collaudo; storico precedente intatto.
- RLS verificata su cm_rider_sessions, cm_rider_presences e cm_geocoding_slot;
  nessun SELECT diretto per anon o authenticated.
- Sessioni private e geocoding attivi. Community sharing_enabled=false:
  apertura senza inviti e regole per minori/Paesi non implementate in questo rilascio.
- Statistiche Vercel abilitate nel codice ma caricate solo con scelta positiva;
  Accetta del banner informativo non abilita le statistiche.
- Nessun push Git. Non fare un push dalla cartella sito senza riconciliare
  le modifiche del laboratorio: l'autodeploy da main potrebbe annullarle.

## Seconda correzione: aggiornamento della cache

- Il precedente deploy del menu era confermato online alle 17:48 Europe/Rome.
  Test reali con account temporaneo: login e apertura Aggiungi spot riusciti
  su Chrome e WebKit, anche dopo refresh. Account eliminato, nessuno spot inviato.
- Riprodotto un difetto distinto: il service worker restituiva la vecchia mappa
  dalla cache anche quando la nuova pagina era disponibile online. Non e' una
  conferma della causa specifica sul telefono del titolare, non ispezionato.
- public/sw.js passa a cache v8 e rete-prima per le pagine mappa/spot. Ripiego
  offline conservato, un vero 404 non viene sostituito dal vecchio 200.
  Cache piena non impedisce la risposta online. Nessuna modifica a IndexedDB,
  bozze, account, foto caricate o sessioni. Nessuna migrazione applicata.
- Rilascio isolato in /private/tmp/chrispy-menu-hotfix-20261002, ricostruito
  dai 533 file del deployment precedente verificando ogni SHA-1. Unico file
  applicativo differente: public/sw.js; aggiunto il test di regressione.
  Le nuove statistiche profilo NON sono comprese.
- 690 test / 62 file sul pacchetto isolato, build Vercel riuscita; alias e
  contenuto esatto di /sw.js verificati dopo la promozione.
- Browser: cache vecchia inserita solo nel browser di test, sostituita online;
  apertura Aggiungi spot verificata. Ripiego HTML offline verificato su Chrome.
  La prova fetch con emulazione offline WebKit ha restituito Load failed:
  quel controllo offline non e' considerato superato.
- Rollback di questa correzione: dpl_9uC4bFjCuPmZQEtQTRuFhTdEsrrb.
  Una scheda aperta puo' richiedere Aggiorna per sostituire il JavaScript in memoria.

## Correzione menu mobile dopo il rilascio

- Segnalazione: toccando Vai in sessione non si apriva nulla sul telefono.
- Riprodotto un caso di focus perso con relatedTarget null: il vecchio onBlur
  smontava il menu prima del click. Sostituito con focusin esterno; restano
  chiusura con tocco esterno, Escape e spostamento del focus fuori dal menu.
- File applicativo modificato: components/BottomNav.tsx. Nessuna migrazione,
  modifica ai dati o alle regole di condivisione.
- Script ripetibile: scripts/check-map-actions-browser.mjs, solo lettura UI.
  Prima della correzione falliva su "Null blur must not remove the action".
- Dopo la correzione: Chrome e WebKit locali a 390/430px, apertura e riapertura,
  perdita di focus, Escape, focus/tocco esterno, accesso richiesto per aggiungere
  spot da guest, nessun overflow o pageerror. Non equivale a una prova fisica
  sul telefono dell'utente.
- 686 test / 61 file passati, lint senza errori, npm run build su Vercel riuscito.
- Dopo la promozione, Chrome e WebKit sul dominio pubblico: entrambi i viewport PASS.
- Rollback della sola correzione: dpl_BPV12HjMRSFgt6BmxnhjEyiXgHem
  (https://chrispymps-gxkp8ctzs-chrispybmxs-projects.vercel.app).
- Una scheda gia' aperta mantiene il vecchio JavaScript fino al ricaricamento;
  la cache del service worker puo' servire la pagina precedente una prima volta.

## Backup e rollback

Backup privato prima delle migrazioni:
`/Users/christianceresato/Documents/Chrispy Maps/backups/supabase-pre-sessioni-20261002.dump`.
Formato custom pg_dump 17, 672954 byte, 76 TABLE DATA per gli schemi public,
auth, storage e supabase_migrations. Archivio leggibile da pg_restore --list.
SHA256: d2365a071c040c33a5664e6b032bd3f3004da2142d74e0d5ae4d1613d4ebae3b.
Include dati account e metadati storage: proteggere il file, non caricarlo su Git.
Non include i file binari delle foto ne' la configurazione esterna dei provider;
non e' stata effettuata una prova completa di ripristino in un secondo progetto.
Il backup remoto automatico non aveva copie elencate nel controllo iniziale.

Gli strumenti client libpq@17 sono stati installati tramite Homebrew per
esportare il database senza Docker. Nessun server PostgreSQL locale avviato.

Rollback applicativo: promuovere il deployment precedente
dpl_9hBQGxdfimp9zMdXf29tQhXDdvrE. Conservare le nuove tabelle e i dati utente.
La migrazione ha revocato la lettura pubblica dei vecchi check-in: non ripristinare
quella policy automaticamente. Non usare db reset o db push indiscriminati.

## Collaudo reale completato

- 686 test locali / 61 file passati; build Vercel completa con TypeScript e lint.
- Due account Auth temporanei con password casuali e profili di test: login
  reale riuscito, senza invio email di registrazione.
- API del deploy: avvio, retry con stesso ID e doppia richiesta, rilettura,
  stop, correzione, cancellazione, faccine, ricalcolo dei totali.
- Sessione scaduta simulata modificando solo la fixture: fine da confermare,
  zero ore confermate prima della conferma, 7200 secondi dopo.
- Altro account: storico vuoto, cancellazione altrui 404; SELECT diretto negato.
- Condivisione Community da account non autorizzato: 403, senza pubblicazione.
- Foto sintetica caricata: HTTP 200, file recuperabile, EXIF assente.
- Invio spot con foto: HTTP 201, pending, una foto collegata; sessione privata
  sul proprio pending riuscita, altro utente respinto con 409.
- Notifica di moderazione invocata da submit-spot tramite Resend. Ricezione
  nella casella del titolare non verificata; SMTP signup/reset non collaudato.
- Cleanup riuscito: due account, uno spot pending, una foto eliminati;
  query finale: zero account e spot di test residui.
- Chrome sul dominio pubblico: 390x900 e 1440x900, rispettivamente 6 e 29
  tessere caricate, nessun overflow orizzontale o pageerror.

Output reale dei curl dopo la promozione (robots riportati dove presenti):

```text
200 /                                      index, follow, max-image-preview:large
404 /map/citta-inesistente-xyz              noindex; noindex, nofollow
404 /map/spot/questo-non-esiste             noindex; noindex, nofollow
404 /news/non-esiste                       noindex; noindex, nofollow
404 /map/Verona                            noindex; noindex, nofollow
200 /map/verona                            index, follow
200 /map/spot/jungle-merano-17fe5a           index, follow, max-image-preview:large
200 /news/bmxnews-9                        index, follow, max-image-preview:large
200 /preferiti                             noindex, nofollow
200 /u/chrispy                             noindex, follow
401 /api/rider-sessions                    senza autenticazione
404 /api/rider-sessions-preview
200 /api/geocoding?mode=search&q=Verona
```

## Configurazione e limiti

Persistiti su Vercel Production: RIDER_SESSIONS_ENABLED=true,
NEXT_PUBLIC_RIDER_SESSIONS_ENABLED=true, GEOCODING_DATABASE_LIMITER_ENABLED=true,
NEXT_PUBLIC_WEB_ANALYTICS_ENABLED=true, RIDER_SESSIONS_PREVIEW=false,
CHRISPY_LOCAL_PREVIEW=false, NEXT_PUBLIC_SITE_URL=https://maps.chrispybmx.com.
Le stesse impostazioni rilevanti sono state passate al build/deploy pubblicato.

Restano: apertura Community senza pilot e relativa valutazione per minori,
amicizie approvate, collaudo consegna email signup/reset, riconciliazione Git.
Le altre funzioni preesistenti opzionali (inviti, metriche aggregate, scheduler
newsletter) non sono state abilitate o certificate da questo rilascio.
L'autoconferma email Supabase preesistente non e' stata modificata.
Nessuna dichiarazione di conformita' GDPR sulla sola base di questi test.

---

## Storico della preparazione (prima del rilascio)

Il proprietario ha autorizzato deploy della versione reale e migrazioni sul
progetto Supabase esistente. Questa decisione supera il precedente vincolo
di staging del laboratorio, ma non costituisce un collaudo completato.

## Stato remoto verificato, nessuna modifica dati

- Vercel: chrispybmxs-projects/chrispymps, Node 24.x, dominio maps.chrispybmx.com.
- Ultimo deploy di produzione READY prima del lavoro:
  dpl_9hBQGxdfimp9zMdXf29tQhXDdvrE.
- Web Analytics Vercel attivo sul progetto; caricamento SDK del nuovo codice
  subordinato a NEXT_PUBLIC_WEB_ANALYTICS_ENABLED e scelta facoltativa positiva.
- MailerLite configurato su Vercel: i valori sensibili non sono scaricabili
  via env pull. I placeholder locali non sono credenziali mancanti sul server.
- REST cm_session_blocks disponibile; cm_rider_sessions e cm_rider_settings
  restituiscono 404 con il client amministrativo. Nuova migrazione non applicata.
- Conferma email automatica attualmente attiva in Supabase; SMTP e recupero
  password richiedono collaudo. Nessuna impostazione auth cambiata.
- Nessun deploy, push Git, modifica environment remoto o SQL remoto eseguito.

## Modifiche di preparazione

- Cast di spots.status a text nella snapshot sessioni; test SQL ora con enum
  senza valore deleted, inclusa conservazione storico dopo cancellazione spot.
- .vercelignore esclude credenziali, snapshot, cache e configurazioni locali.
- Alternativa al limiter Redis: cm_claim_geocoding_slot, servizio server-only
  senza dati personali, intervallo globale di 1100 ms per ricerca e reverse.

## Verifiche locali completate

- npm test: 686 test passati, 61 file.
- npm run build: successo, controlli TypeScript e lint inclusi. Credenziali
  Supabase fittizie e loopback: non dimostra il funzionamento del database reale.
- next start: /anteprima-sessioni e /api/rider-sessions-preview 404 anche
  con flag demo true; /api/rider-sessions senza autenticazione 401;
  /map/Verona 404; /privacy 200.
- Chrome headless installato sul Mac, con autorizzazione fuori sandbox:
  pagina demo a 390x844 e 1440x1000, avvio, refresh, stop, storico e cancellazione.
- Mappa originale a 390x900 e 1440x900: posizione simulata allo spot Jungle,
  un solo candidato vicino, avvio, refresh, stop, profilo e cancellazione.
  Sessioni sintetiche locali: nessun dato inserito sul progetto Supabase.
- Controllo separato mappa caricata: 6 tessere mobile e 29 desktop.
- Screenshot mobile primo ingresso: banner privacy non copre + e bottom nav.
- Nessun collaudo upload, login o email reali eseguito in questo passaggio.

## Sequenza ancora da completare

1. Completare login amministrativo Supabase; verificare schema e backup remoto.
2. Verificare prerequisiti e applicare solo le nuove migrazioni in transazione:
   20261002_rider_sessions.sql e 20261002170000_geocoding_slot.sql.
   Non eseguire indiscriminatamente db push: lo storico precedente comprende
   migrazioni applicate manualmente, da riconciliare prima.
3. Verificare RLS, grant e RPC reali. Collaudare due identita' di test autorizzate.
4. Configurare RIDER_SESSIONS_ENABLED, NEXT_PUBLIC_RIDER_SESSIONS_ENABLED,
   GEOCODING_DATABASE_LIMITER_ENABLED e NEXT_PUBLIC_WEB_ANALYTICS_ENABLED true.
   RIDER_SESSIONS_PREVIEW e CHRISPY_LOCAL_PREVIEW devono rimanere false/assenti.
   Condivisione Community separata: pilot adulti autorizzati e consenso esplicito.
5. Build con configurazione reale e collaudo login, upload, mappa, sessione,
   refresh, fine, modifica e permessi; verifica mobile prima della promozione.
6. Pubblicare e verificare il dominio; conservare il deployment precedente
   per rollback del codice. Non eliminare tabelle o sessioni in caso di rollback.

Il backup della cartella locale non e' un backup Supabase. Non applicare SQL
con l'idea di poter ripristinare il database dal tar del sito.

Il laboratorio non e' un checkout Git: un deploy CLI non aggiorna GitHub.
Prima del prossimo push riconciliare con sito, preservando tutte le modifiche
preesistenti, altrimenti l'autodeploy da main puo' sostituire questa versione.
