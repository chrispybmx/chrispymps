---
title: lessons
type: note
permalink: ai/antigravity/tasks/lessons
---

# Lessons — pattern imparati

## 2026-07-22 — `ADD COLUMN IF NOT EXISTS ... REFERENCES` è un no-op se la colonna esiste
**Bug:** l'upload foto su spot esistenti falliva sempre con 500. Causa: `spot_photos.uploaded_by`
aveva una FK verso la tabella legacy `contributors`. La migration `20260429_phase1_contributions.sql`
usava `ALTER TABLE spot_photos ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id)`,
ma la colonna **esisteva già** → con `IF NOT EXISTS` Postgres salta l'intera clausola, `REFERENCES`
compreso. La vecchia FK è rimasta. Ogni insert con `uploaded_by = auth.users.id` violava la FK (23503).
**Fix:** DROP + ADD del constraint corretto in una migration dedicata.
**Pattern:** per aggiungere/cambiare una FK su colonna che potrebbe già esistere, MAI affidarsi a
`ADD COLUMN IF NOT EXISTS ... REFERENCES`. Fare `ALTER TABLE ... DROP CONSTRAINT IF EXISTS x` +
`ADD CONSTRAINT x FOREIGN KEY ...` esplicito.

## 2026-07-22 — Errori di insert vanno SEMPRE loggati
Lo stesso bug è vissuto nascosto perché in `/api/spot-photos` l'`insertErr` veniva scartato
(`return insertErr ? null : url`) senza log. Nessuna traccia in produzione. Loggare sempre
`err.code/message/details` sui path DB, anche quando si degrada in modo soft.

## 2026-07-22 — `spots.status` è un ENUM Postgres, non testo libero
`spot_status` = (pending, approved, rejected). Un PATCH con un valore fuori enum dà `22P02
invalid input value for enum`. Per il soft-delete è servito `ALTER TYPE spot_status ADD VALUE
'deleted'`. Verificare il tipo prima di assumere che una colonna di stato accetti nuovi valori.
Test sicuro del CHECK/enum: PATCH su una riga **non pubblica** (es. status=rejected) e ripristino
immediato — un PATCH su 0 righe non fa scattare il vincolo, quindi non prova nulla.

## 2026-07-23 — `tsc` verde NON garantisce che il build Next passi
Ho creato `app/api/spots/[id]/route.ts` accanto a `[slug]` già esistente. Next.js vieta due
slug dinamici diversi allo stesso livello (`You cannot use different slug names for the same
dynamic path`). `tsc --noEmit` passava, ma `next build` sarebbe fallito → il deploy Vercel si è
rotto e il sito è rimasto al deploy vecchio (405 sull'endpoint nuovo). **Pattern:** prima di
dichiarare fatta una modifica che tocca route/file structure Next, girare `next build`, non solo
`tsc`. Fix: PATCH/DELETE spostati in `[slug]/route.ts`, `params.slug` usato come UUID (UUID_RE
distingue id da slug). Verificato con endpoint live: PATCH/DELETE token fasullo → 401, id non-UUID → 400.

## 2026-07-23 — La clipboard di sistema è inaffidabile per incollare nel browser
Durante l'applicazione SQL via Chrome, `pbcopy` + `Cmd+V` ha incollato testo di un'ALTRA app
(l'utente lavorava in parallelo e la clipboard è stata sovrascritta tra copy e paste). Rischio di
eseguire testo sbagliato su un DB di produzione. **Pattern:** per testo breve ASCII usare `type`
diretto (attenzione all'auto-close delle virgolette di CodeMirror — verificare con screenshot
prima di eseguire). Non premere mai Run senza aver riletto ciò che c'è davvero nell'editor.

## 2026-07-23 — Egress Supabase FREE: comprimere le foto LATO SERVER, non fidarsi del client
Il banner "Grace period is over" era causato dall'egress (5GB/mese FREE) bruciato da foto a piena
risoluzione. I 5 path di upload facevano solo `sharp().rotate()` (strip EXIF) — nessun resize/compress.
Il client (AddSpotModal) comprimeva prima dell'upload, ma i path che NON passano dal client (o path
diversi) salvavano PNG da 1-3.5MB. **Pattern:** la compressione immagini va SEMPRE garantita lato
server (resize entro ~1600px + JPEG q85 via sharp mozjpeg) — il client è un'ottimizzazione, non la
difesa. Utility unica `lib/image.ts optimizeImage()`. Foto identiche su schermo, -85% peso.
Diagnosi: NON assumere che il consumo FREE sia MAU/DB — misurare. Qui 44 utenti, DB piccolo; il
driver era l'egress delle foto. Campionare `curl -o /dev/null -w %{size_download}` su qualche URL
pubblico dà subito il peso reale.

## 2026-07-23 — Sovrascrivere foto in-place mantiene gli URL nel DB
Per ricomprimere le foto esistenti senza toccare `spot_photos.url`: PUT sullo stesso storage path
con `x-upsert: true` + `Content-Type: image/jpeg`. Il path resta `.png` ma il contenuto/He header
è JPEG — il browser usa il content-type, non l'estensione. Attenzione: il CDN Supabase cachea la
versione pubblica (~1h), quindi un ri-listing subito dopo può ancora vedere le dimensioni vecchie;
verificare la validità via storage backend o sharp sul download, non fidarsi della cache CDN.

## 2026-07-24 — Fire-and-forget NON funziona su serverless (Vercel)
`bgUpload().catch(...)` in submit-spot avviava l'upload foto SENZA await, per rispondere veloce.
Su serverless il container viene congelato/terminato subito dopo il `return` della risposta: il
lavoro non-awaited non completa. Risultato: spot creati SENZA foto ("Rail sinigo in salita": 0
righe in spot_photos, 0 file in storage). **Pattern:** su Vercel/Lambda tutto il lavoro critico
va awaited PRIMA di rispondere. Per lavoro davvero async servono queue/cron/waitUntil, non
promise orfane. Inoltre: controllare SEMPRE l'errore degli insert (erano `await x.insert()` senza
check) e non lasciare risorse a metà — se le foto falliscono del tutto, cancellare lo spot appena
creato invece di lasciare un fantasma. Diagnosi: uno spot con 0 foto E 0 file storage sotto la sua
cartella = upload mai completato (non "foto cancellate").

## Ricorrente — questo progetto non ha CLI/psql per il DB
DDL solo via Supabase SQL Editor (browser). Nessun `DATABASE_URL`, nessun Personal Access Token
Management, `supabase` CLI non installato. Il service-role key fa solo PostgREST (no DDL).
Le migration si scrivono in `supabase/migrations/` per storico, ma vanno applicate a mano.

## 2026-08-19 — `git stash pop` può applicare a metà e non dirtelo in faccia
Per capire se certi errori console fossero miei o preesistenti ho fatto `git stash push -u`,
ricaricato, confrontato, poi `git stash pop`. Il pop ha ripristinato **solo i file untracked**:
le modifiche ai file tracked non sono rientrate, perché tre `.md` (README, SECURITY_PRIVACY_AUDIT,
competitor-analysis — riscritti di continuo da basic-memory) avevano modifiche locali che
confliggevano. Git ha abortito il merge, ma il messaggio utile (`error: Your local changes...
would be overwritten`) stava in cima all'output, e leggendo solo `tail` sembrava tutto a posto.
Lo stash per fortuna resta (`The stash entry is kept`), quindi niente è andato perso.
**Pattern:** dopo `git stash pop`/`apply` non fidarsi dell'exit code né della coda dell'output —
leggere l'output **intero** e verificare con `git status --short` che i file attesi siano tornati,
prima di continuare a scrivere. Se il repo ha file rumorosi rigenerati da tool esterni, pulirli
(`git checkout -- <file>`) prima di stashare, non dopo.

## 2026-08-19 — Il parser dei tipi di supabase-js legge la stringa letterale, non un template
Per rendere opzionale una colonna nuova (`spot_photos.source`) avevo fattorizzato la query in
`select(`*, spot_photos(${cols})`)`. `tsc` è esploso con `ParserError<Expected identifier>`:
il tipo di ritorno di `.select()` è dedotto **staticamente dal literal**, quindi un template
interpolato produce un tipo di errore, non uno `Spot`. **Pattern:** per query alternative scrivere
due `.select()` per esteso (uno con la colonna nuova, uno senza) e scegliere in base a `error`,
come già fa `app/api/events/route.ts` per il join opzionale. Costa qualche riga in più, ma i tipi
restano veri e il codice regge il periodo in cui la migration non è ancora applicata in produzione.

## 2026-08-19 — Un errore scritto nell'URL che nessuno legge è un errore che non esiste
Christian segnala: "il login con Google non funziona, non ti fa creare un profilo".
Indagine sistematica su tutti i confini, e il risultato è che **quasi tutto funzionava**:
bottone presente nel bundle di produzione (dal 9 luglio), provider Google `Enabled` su
Supabase con client_id reale, Site URL e Redirect URLs corretti, `/auth/v1/authorize`
risponde 302 verso Google, Google accetta la richiesta (nessun `redirect_uri_mismatch`
né `invalid_client`), route `/auth/callback` e `/auth/setup-username` raggiungibili,
RLS su `profiles` corretta (`profiles_own_insert` con `auth.uid() = id`), e
`setupGoogleUsername` inserisce davvero il profilo.

Il difetto certo era un altro: `/auth/callback` scriveva `?auth_error=...` nell'URL e
**nessun file leggeva quel parametro** (`grep -rn auth_error` → solo le due scritture).
In più `setup-username`, se la sessione non arrivava entro 6 secondi, faceva
`router.replace('/map')` senza dire nulla. Due strade diverse che finivano entrambe
sulla mappa identica a com'era: dal punto di vista del rider il bottone non faceva nulla.

**Pattern:** prima di cercare la causa di "non funziona", verificare se il fallimento è
*osservabile*. Un ramo di errore che non ha un lettore non è gestione dell'errore, è
silenzio con una variabile in più. E un errore mostrato in un toast da 2,5 secondi è
quasi altrettanto silenzioso: se il messaggio contiene istruzioni, serve un avviso che
resta finché l'utente lo chiude.

**Falsa pista utile:** avevo concluso che `/api/auth/set-username` non creasse il profilo
(aggiorna solo `user_metadata`). Vero, ma irrilevante: l'insert sta in `setupGoogleUsername`
lato client. Verificare chi altro fa il lavoro prima di dichiarare la causa radice.

## 2026-08-22 — Il soft-404 era davvero nei loading.tsx, e la prova e' lo status
Da inizio agosto il progetto conviveva con un limite noto: le route inesistenti
restituivano `200` invece di `404`, nonostante `notFound()` in `generateMetadata`,
`cache()` sulle query e `not-found.tsx` con noindex. La diagnosi era gia' scritta
(i `loading.tsx` di segmento flushano lo shell con 200 prima che `notFound()` possa
impostare il codice), ma il fix era rimasto sospeso perche' Christian aveva chiesto
di non toccare quei file.

Rimossi i tre `loading.tsx`, lo status e' diventato corretto. Verificato su build di
produzione servita in locale, non in dev:
`/map/citta-inesistente-xyz`, `/map/spot/questo-non-esiste`, `/news/non-esiste` e
`/map/Verona` (maiuscola) → **404 + noindex**; `/map/verona`, `/news/bmxnews-9`, `/`
→ **200 + index,follow**.

**Pattern:** per lo status HTTP non basta guardare la pagina renderizzata — `noindex`
nei metadata poteva far sembrare il problema risolto mentre il server continuava a
dire 200. La verifica giusta e' `curl -o /dev/null -w "%{http_code}"` su build di
produzione: in `next dev` il comportamento dei confini Suspense e' diverso.

**Prezzo del fix, da tenere presente:** quelle tre route hanno perso lo scheletro di
caricamento (la mappa aveva 69 righe di skeleton animato). Se la latenza si nota, il
fallback va rimesso dentro un `<Suspense>` interno alla pagina, DOPO il check di
esistenza — non come `loading.tsx` di segmento.

## 2026-08-22 — Una direttiva CSP sbagliata teneva spento il service worker da sempre
Cercando difetti residui in produzione, l'unico errore in console era:
`Creating a worker from '.../sw.js' violates the following Content Security Policy
directive: "worker-src blob:"`.

Non era il browser di test: l'header lo serviva il sito.
`worker-src blob:` autorizza **solo** i worker creati da URL blob. Il service worker
del progetto e' `/sw.js`, un file normale di pari origine, quindi la registrazione
veniva rifiutata a ogni visitatore. Conseguenze silenziose: nessuna cache offline,
nessuna cache delle tile OSM (piu' banda e mappa piu' lenta), pagina `/offline` mai
raggiungibile, e push notification impossibili — proprio la funzione discussa come
prossimo passo.

Fix: `worker-src 'self' blob:`.

**Pattern:** gli errori CSP non rompono niente in modo visibile — la pagina funziona,
solo che una capacita' non esiste. Vanno letti nella console di **produzione**, perche'
in sviluppo l'header puo' essere diverso. E vale la pena rileggere ogni direttiva
chiedendosi "questa lista copre davvero le risorse che il sito usa?", invece di
fidarsi che una policy restrittiva sia per definizione corretta.

## 2026-08-23 — Una query che caricava i dati e poi li buttava

`/api/spots` selezionava `spot_photos (url, position)`, ordinava, e teneva
`sorted[0]`. `photo_urls` restava vuoto. Sulla mappa la card espansa mostrava
quindi sempre una foto sola, e tutto il carosello — strip scroll-snap, puntini,
frecce, lightbox, piu' il workaround non-passivo per Safari — era codice
irraggiungibile. Misurato: 57 spot su 117 ne avevano piu' di una, 91 foto non
si vedevano.

Niente lo segnalava: tsc pulito, 122 test verdi, build verde, zero errori in
console. Un test avrebbe potuto coprirlo solo controllando il CONTRATTO della
rotta, non il suo tipo — `photo_urls` era dichiarato opzionale, quindi non
popolarlo era legale per TypeScript.

Lezione: quando una query carica dei campi che poi non compaiono nella risposta,
o la query e' sbagliata o la risposta lo e'. Vale la pena confrontare cosa si
chiede al database con cosa esce dalla rotta.

Costo della correzione, misurato: payload gzip da 11.2 KB a 12.7 KB. Gli URL
condividono un prefisso lungo, quindi 91 foto in piu' pesano 1.4 KB.

## 2026-08-23 — Due policy permissive in OR non restringono niente

`schema.sql` aveva dal primo giorno:

    create policy "public read photos of approved spots" on spot_photos
      for select using (exists(select 1 from spots
                                where spots.id = spot_photos.spot_id
                                  and spots.status = 'approved'));

Poi `20260429_phase1_contributions.sql` ha aggiunto la moderazione delle foto e
la policy corretta ("Public read approved photos", che guarda
`moderation_status`) — ma non ha rimosso la vecchia.

In Postgres le policy permissive sulla stessa operazione si sommano in OR:
basta che UNA passi. La nuova quindi non restringeva nulla, e ogni foto
caricata era pubblicamente leggibile prima di essere moderata.

Lezione: aggiungere una policy piu' stretta non stringe. Bisogna togliere
quella larga. Quando una migration introduce uno stato di moderazione, la
domanda da farsi e' «quali policy ESISTENTI ignorano questa colonna?».

Verifica: `select policyname, qual from pg_policies where tablename = '...' and cmd = 'SELECT';`

## 2026-08-23 — Il permesso di posizione chiesto prima di dare un motivo

`SpotMap` chiamava `getCurrentPosition` dentro l'init della mappa: il prompt di
sistema compariva entro un secondo dall'apertura, sopra al banner cookie, prima
che il rider sapesse cosa fosse il sito. Da quel permesso dipendeva tutto —
ordinamento per vicinanza, distanze sulle card, "portami li'" — e un no resta
appiccicato alle visite successive.

Peggio: la card di benvenuto diceva «attiva la posizione» e offriva un bottone
che si limitava a chiudersi. Il consiglio senza il mezzo per seguirlo.

Ora la richiesta automatica parte solo se il permesso c'e' gia' (Permissions
API, piu' un flag nostro in localStorage perche' Safari non espone
`geolocation` li' dentro). A tutti gli altri lo chiede un tap esplicito.

## 2026-08-24 — Le risposte opache: `response.ok` e' sempre falso

La cache delle tile non ha MAI funzionato. Non per il CSP (quello era un altro
bug, risolto ieri): per questo.

Leaflet carica le tile con dei tag `<img>`. Una richiesta di immagine
cross-origin parte in modalita' `no-cors`, e cio' che torna e' una **risposta
opaca**: corpo illeggibile, `status` a 0, `ok` sempre `false`. Quindi il
classico

    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());

scarta ogni singola tile, in silenzio, per sempre. Misurato: `chrispymaps-map`
a 0 voci dopo aver navigato la mappa.

Peggio, il tentativo di allegare un timestamp:

    new Response(await response.blob(), ...)

su una risposta opaca produce un corpo VUOTO. Se quella fosse finita in cache,
la mappa avrebbe mostrato buchi grigi al posto delle tile — un bug peggiore di
non avere cache.

Soluzione: rifare la richiesta in `mode: 'cors'` dentro il service worker.
tile.openstreetmap.org, basemaps.cartocdn.com e lo storage di Supabase mandano
tutti `access-control-allow-origin: *` (verificato con curl). Cosi' la risposta
e' leggibile, `ok` significa qualcosa e il corpo si puo' toccare.

Verificato dopo il fix, in Chrome vero, con il server SPENTO: 24 tile in cache
da 21.980 byte l'una, 118 spot, 17 pin disegnati, mappa perfettamente usabile.

Regola: dentro un service worker, `response.ok` non e' un controllo valido su
risorse di altra origine finche' non sai che la risposta non e' opaca.

## 2026-08-24 — Una cache senza tetto e' una bomba a orologeria

MAP_CACHE non aveva limiti. Le tile sono ~20 KB e navigare una citta' a piu'
zoom ne genera centinaia. Quando il browser sfonda la quota dell'origine non
cancella solo la cache piu' grossa: puo' buttare via TUTTO lo storage, precache
e pagina offline comprese. Le risposte opache contano poi molto piu' del loro
peso reale.

Aggiunto un tetto (600 tile, 60 foto) con scarto delle piu' vecchie. Il
controllo non gira a ogni scrittura — contare centinaia di chiavi per ogni tile
costerebbe piu' della tile — ma una volta su dieci.

Workbox risolve la stessa cosa con ExpirationPlugin({ maxEntries }). Vale la
pena leggere come lo fanno loro prima di scrivere il proprio.

## 2026-08-24 — Due elenchi della stessa cosa, in due file diversi

Il 19/08 e' arrivata la categoria `transition`. Il modale l'ha mostrata subito
perche' legge `TIPI_SPOT_SELEZIONABILI` da lib/constants. Il server no: dentro
submit-spot l'elenco dei tipi era ricopiato a mano dentro uno `z.enum([...])`,
e nessuno l'ha aggiornato.

Effetto: `transition` — che tolto `street` dai selezionabili era diventata la
PRIMA casella del selettore — rispondeva 422 a ogni invio. Con le foto gia'
caricate nello storage, perche' il pre-upload avviene al passo 2 e la categoria
si sceglie al passo 3. E con il messaggio «Dati non validi. Controlla tutti i
campi.», che non diceva quale campo.

Un rider che ci finiva sopra ricontrollava nome, posizione e foto — tutti
giusti — riprovava con la stessa categoria e falliva di nuovo. Per sempre.
Cinque giorni cosi'.

Niente lo segnalava: tsc pulito, test verdi, build verde. Le due liste erano
entrambe TypeScript valido, semplicemente diverse.

Regole che ne escono:
1. Un elenco di valori validi vive in UN posto solo. Se il server deve
   validare cio' che la UI offre, deve LEGGERE la stessa costante.
2. Buttare via le `issues` di zod in un `catch {}` costa caro: zod sapeva
   esattamente qual era il campo, e lo stavamo scartando.
3. Quando due file devono restare allineati e non si puo' derivare uno
   dall'altro, serve un test che confronti i due elenchi. Non verifica una
   funzione: verifica che non divergano.

Modo per trovarne altri: cercare `z.enum([` con valori scritti a mano e
chiedersi da dove vengono quei valori nella UI.
