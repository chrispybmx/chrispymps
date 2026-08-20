---
title: todo
type: note
permalink: ai/antigravity/tasks/todo
---

# World-wide readiness — todo

## Fase 1 — DB: country su spots
- [x] Migration SQL `spots.country` + `spots.country_code` (pattern da 20260504_events_worldwide.sql) + backfill IT + index → `supabase/migrations/20260709_spots_worldwide.sql`
- [x] Migration APPLICATA al DB (2026-07-09, SQL Editor: 107 spot → Italia/IT, index ok)
- [x] submit-spot salva country/country_code
- [x] reverseGeocode estrae anche country

## Fase 2 — Geocoding world
- [x] lib/geocoding.ts: via `countrycodes: 'it'`
- [x] accept-language = lingua browser (forward); reverse senza lingua → nomi locali (slug città consistenti)
- [x] displayExtra col paese per luoghi esteri

## Fase 3 — Mappa world
- [x] SpotMap: fit Italia = placeholder; auto-fit data-driven sugli spot; dragstart annulla auto-fit
- [x] AddSpotModal: fallback mini-mappa = vista mondo [20,0] z2

## Fase 4 — Città dinamiche
- [x] /map/[city] data-driven (curate IT + città dai dati; 404 solo se non-curata E senza spot)
- [x] sitemap città da DB + lista curata
- [x] Admin edit: città input libero + datalist suggerimenti
- [x] TopBar: ricerca già world via geocoding (dropdown curato IT resta come scorciatoia)
- [x] skate-maps: lasciata (pagina SEO Italia, cosmetica)

## Verifica
- [x] typecheck pulito
- [x] test 78/78 verdi (geocoding tests aggiornati al contratto world)
- [x] build produzione ok
- [x] commit 5ff9608 pushato → DEPLOY LIVE (2026-07-09, verificato: copy world in home, /map/verona 200, /map/reggio-emilia 200, sitemap 209 pagine /map/)

## Email infra (2026-07-09)
- [x] SCOPERTA: RESEND_API_KEY=re_PLACEHOLDER in prod → email moderazione MAI partite
- [x] SCOPERTA: SMTP Supabase puntava a mail.chrispybmx.com (SiteGround, rotto) → reset/conferme mai arrivate
- [x] Account Resend: dominio chrispybmx.com aggiunto (eu-west-1), 3 record DNS su SiteGround (DKIM, SPF send, MX send)
- [x] API key Resend "chrispymps-prod" (sending) → Vercel RESEND_API_KEY aggiornata + redeploy
- [x] SMTP Supabase → smtp.resend.com / resend / key, sender noreply@chrispybmx.com
- [ ] Attesa verifica dominio Resend (monitor attivo) → poi test email end-to-end
- [x] Google OAuth signup → MailerLite submit-spot (setupGoogleUsername, pushato 647063b)
- [x] Email benvenuto+regolamento HTML pronta (static-landing/email/welcome-regolamento-maps.html)
- [ ] MailerLite: login utente → creare automazione "joins Spot Submission" → incolla HTML → Activate
- [ ] Bottone "Continua con Google" in AuthModal: FATTO in locale, NON pushato — richiede prima Google provider attivo in Supabase (ora Disabled; serve OAuth app su Google Cloud Console)

## 2026-07-22/23 — Bug foto + edit/delete spot + moderazione eventi
- [x] ROOT CAUSE bug upload foto: FK `spot_photos.uploaded_by` → `contributors` invece di `auth.users` (vedi lessons.md). Feature mai funzionata: 0 foto con uploaded_by, 4 contributi orfani.
- [x] Migration fix FK scritta: `20260721_fix_spot_photos_uploaded_by_fk.sql`
- [x] Migration cleanup 4 orfani (distruttiva, separata): `20260721_cleanup_orphan_photo_contributions.sql`
- [x] `/api/spot-photos`: logga sempre insertErr + pulisce storage/contributo se upload fallisce del tutto
- [x] Edit/delete own spot: `/api/spots/[id]` PATCH+DELETE owner-scoped, `SpotOwnerActions.tsx`, montato in page spot
- [x] Soft-delete via enum: migration `20260722_spot_status_deleted.sql` (`ALTER TYPE spot_status ADD VALUE 'deleted'`)
- [x] Moderazione eventi via link email (token HMAC): `generateEventActionToken`, `/api/admin/events/moderate`, bottoni in mail
- [x] 3 commit locali (cdf3842 events, 8ddfd1f photos, 181fe79 spots) — typecheck verde
- [x] SQL applicato al DB prod (fix FK + enum 'deleted') via SQL Editor (2026-07-23) — verificato live: insert foto passa, PATCH deleted passa
- [x] CONFLITTO ROUTING: `[id]` vs `[slug]` rompeva build Vercel (tsc non lo cattura) → PATCH/DELETE spostati in `[slug]/route.ts`, `next build` 171/171 ok (vedi lessons.md)
- [x] PUSH → deploy live (8902992): endpoint /api/spots/[id] PATCH/DELETE attivo, auth 401 su token fasullo, 400 su id non-UUID
- [ ] cleanup 4 contributi fantasma (distruttivo, opzionale) — `20260721_cleanup_orphan_photo_contributions.sql`, in attesa OK
- [ ] Routine scraping eventi ogni 2 settimane — BLOCCATO SU FONTE. Schema pronto (scraped_at/source_aggregator/source_url), moderazione via token email pronta, cron Vercel da fare. MA: UCI dataride vuoto; worldrookietour WP REST espone solo post/page (no CPT eventi, no The Events Calendar) → solo scraping HTML fragile. Serve che Christian indichi le fonti reali che segue (FISE? federazioni? aggregatori) prima di scrivere lo scraper. Alternativa robusta: flusso semi-manuale (incolla link → parse → draft → approva)
- [ ] Verifica UI reale (opz.): loggarsi come owner e provare Modifica/Elimina dal vivo sulla pagina spot

## 2026-07-24 — Ottimizzazioni performance
- [x] Marker Leaflet self-hosted (public/leaflet/) — erano da unpkg.com (latenza + pin rotti se giu). Live: /leaflet/marker-icon.png 200
- [x] Asset statici public/ ricompressi in-place (21 JPEG, -24%, nomi invariati) — scripts/optimize-public-assets.mjs. Commit 95d562b
- [x] Analisi: bundle JS ok (max chunk 180KB), /api/spots ok (107 spot, 44KB), 0 spot 'deleted' residui dai test
- Note ottimizzazioni NON fatte (basso ROI): icon-512.png PNG 304KB (icona PWA, servita raramente); bundle JS gia snello

## 2026-07-25 — UX mobile: lightbox foto swipeable
- [x] Foto a schermo intero ora swipeable col dito (era solo frecce). Swipe orizz = cambia foto (snap per distanza O velocità, damping ai bordi), swipe giù = chiude (iOS-like, sfondo dissolve). Pointer events + capture + lock asse. Anima solo transform/opacity, ref durante drag. Frecce nascoste su touch. Indice sync col carousel. Commit f9ca8aa
- [x] Verificato in viewport mobile locale: apertura, swipe 1/3->2/3, swipe-giu chiude, sync carousel. 0 errori console. Deploy live
- [ ] Feel finale da testare su telefono vero (le gesture si sentono solo lì) — Christian

## 2026-08-02/03 — Code review, SEO, indicizzazione
- [x] 7 fix dal code review deployati (commit e28ffba): email awaited x4 (submit-spot, submit-event, approve, reject) + notifiche in-app + XP — su serverless le promise non attese non completavano; revalidatePath dopo PATCH/DELETE/approve (prima 5 min di dati stale); alpha->WebP (flyer/loghi PNG diventavano neri); tap-per-chiudere lightbox; photo_urls solo storage nostro; rollback pulisce storage; commento migration corretto
- [x] Soft-404 (commit 7f965ba): check esistenza in generateMetadata + React cache() su map/[city], map/spot/[slug], news/[slug]; not-found noindex+canonical:null. VERIFICATO LIVE: slug inventati -> noindex,nofollow, nessun canonical; pagine vere index,follow
- [ ] LIMITE: status HTTP resta 200. Causa provata (A/B su Next 14.2.35): i loading.tsx di segmento flushano lo shell prima di notFound(). Fix = spostare il fallback in <Suspense> interno alla pagina dopo il check. Serve OK di Christian (aveva chiesto di non toccare i loading.tsx)
- [x] Tagline condivisione (commit a214c82): "Chrispy Maps — la mappa freestyle" in og:title, twitter:title, immagine OG e testo share. NB: "/" fa rewrite su "/map", i metadata veri stanno in app/map/page.tsx
- [x] IndexNow: lib/indexnow.ts + chiave pubblica + ping automatico su approvazione spot. 263 URL della sitemap inviate (HTTP 200 OK). Prima submit dava SiteVerificationNotCompleted: normale, serve attendere la verifica della chiave
- [x] DIAGNOSI INDICIZZAZIONE: nessun blocco tecnico (robots.txt aperto, sitemap 263 URL, canonical ok, contenuto server-rendered — verificato H1/H2/testo su /map/verona). Il sito NON compare nelle ricerche perche' il sottodominio e' ORFANO: chrispybmx.com non lo linka (0 occorrenze) e l'autorita' del dominio principale non si eredita
- [ ] ⚡ LEVA PRINCIPALE: link da chrispybmx.com -> maps.chrispybmx.com (menu + home). Bloccato: estensione Chrome non connessa
- [ ] Google Search Console: aggiungere proprieta', verificare, inviare sitemap, richiedere indicizzazione — azione di Christian (serve il suo account)
- [ ] Backlink dai canali propri: descrizione YouTube, bio Instagram, canale Telegram

## 2026-08-16 — SiteGround + chrispybmx.com (sessione browser)
- [x] CDN SiteGround attivata (piano Base gratuito) +20 — PRIMA salvato backup zona DNS in scratchpad; verificato subito dopo che maps.chrispybmx.com risponde 200 e il CNAME punta ancora a 4d93e8294504622a.vercel-dns-017.com
- [x] Memcached ON nel pannello (Site Tools > Velocita > Caching) +10
- [x] Memcached ON anche nel plugin Speed Optimizer (va acceso in DUE posti, altrimenti non conta)
- [x] Cache dinamica: risultava gia' attiva nel plugin
- [x] Verificato dopo le modifiche: chrispybmx.com 200, TTFB ~0.4s, header x-cache-enabled: True; maps 200
- [ ] PHP Ultraveloce +5: NON incluso nel piano StartUp, richiede upgrade a GrowBig (+12 EUR/mese). Non acquistato
- [ ] 2FA SiteGround +5: azione di Christian (serve QR + codici di recupero)
- [ ] 3 temi obsoleti +4: da aggiornare/eliminare in WP > Aspetto > Temi
- [x] Creata pagina https://chrispybmx.com/mappa-spot-bmx/ (ID 186) che linka maps + 6 pagine citta + eventi + news
- [ ] La pagina e' grezza (solo HTML, nessuno stile Elementor) — DA RIFARE INSIEME
- [ ] Menu: il sito non espone menu via REST (Elementor) — link nel menu ancora da mettere

### SCOPERTA IMPORTANTE: chrispybmx.com e' praticamente vuoto
- 0 articoli pubblicati, 9 pagine, home = archivio blog senza post
- Testo visibile in home: 180 caratteri. Link nella home: 1
- Conseguenza: linkare la mappa da qui passa poca autorita'. Il dominio principale va riempito di contenuti
- wp-sitemap.xml esiste (200) quindi la pagina nuova e' comunque scopribile

## Prossimi passi (aperti)
- [ ] Mostrare country nella UI (filtro paese su mappa/cerca-spot, bandierine) — fase 2 del world-wide
- [ ] Lingua/i18n (decisione aperta: en default / i18n / resta it)
- [ ] Soft-404 sito-wide: notFound() risponde HTTP 200 con body 404 su TUTTE le route dinamiche (pre-esistente, non regressione) — indagare middleware/CSP
- [x] Supabase FREE "Grace period is over" — CAUSA: foto salvate a piena risoluzione (solo .rotate(), niente resize), PNG 1-3.5MB servite pubbliche → egress 5GB/mese esaurito. NON era MAU/DB (44 utenti). RISOLTO alla radice:
  - [x] lib/image.ts optimizeImage() applicata ai 5 path upload → foto nuove ottimizzate (resize 1600 + JPEG q85, -85%)
  - [x] scripts/compress-existing-photos.mjs eseguito su prod: 94 foto 113MB→30MB (-74%, PNG legacy -91%), 0 errori, URL invariati. Verificato: content-type image/jpeg, immagini valide
  - [x] commit 2f3d31c pushato → deploy
  - [ ] monitorare che il banner sparisca nei prossimi giorni (egress si resetta a ciclo)

## 2026-08-19 — Design pass UX/emozione (fasi 1+2 audit)
Vincolo esplicito Christian: **non toccare il flusso "aggiungi spot"** (AddSpotModal, /api/submit-spot, bottone +) — rispettato, zero modifiche a quei file.
Branch `ux/fase1-2-app`, NON committato, NON pushato.

### Fase 1 — prima impressione
- [x] Apertura su vista locale: SpotMap zoom avvio 5 (paese) → 11 (zona) + callback `onUserLocated`
- [x] MapClient: `userPos`, `nearestOverall`, `nearbyCount` (raggio 25 km), distanza sulle card
- [x] Popup in coda: CookieBanner emette `cmaps:cookie-dismissed`, OnboardingHints lo aspetta — VERIFICATO a 375px, niente più sovrapposizione né bottoni tagliati
- [x] Onboarding: da 3 slide tutorial a 1 schermata di risultato (`cmaps_onboarding_v2`) — VERIFICATO: "116 spot mappati dai rider" + un bottone
- [x] Mappa scura di default (CARTO dark esisteva già come opt-in; ora default, preferenza salvata rispettata)
- [x] Empty state a 3 casi: filtri troppo stretti / zona scoperta con "portami lì" + km / zona vuota con +25 XP Fondatore

### Fase 2 — fiducia
- [x] `lib/freshness.ts` — lo stato decade da `condition_updated_at`; 16 test verdi. `condition_updated_at` propagato in SpotMapPin, /api/spots, /scopri
- [x] `components/FreshnessDot.tsx` su card mappa, card espansa, griglia Scopri; badge scheda spot — VERIFICATO: Panchina/Silandro passa da "ALIVE" verde a "ALIVE · 4m" giallo
- [x] Classifica: numero dominante = XP invece di spot_count — VERIFICATO: 240·175·152·100·80·50 monotono, niente più 10 spot sopra 11
- [x] `lib/levels.ts` sorgente unica (le soglie erano triplicate e divergenti in xp.ts/classifica/ProfileGamification). Ricalibrate 0/30/80/180/380/750/1400 sui numeri reali
- [x] Eventi per vicinanza: `/api/events/nearby` (150 km, orizzonte 60 gg) + `NearbyEventBanner` che sostituisce JamBanner, cablato su Colle del Cemento 6 giugno e quindi morto da metà giugno
- [x] Sessioni: voce di menu nascosta quando non c'è nessuno fuori, con badge "N ORA" quando c'è
- [x] Foto Street View: migration `20260819_spot_photos_source.sql` + etichetta in PhotoCarousel + select con fallback se la colonna non esiste

### Verifica
- [x] `npx tsc --noEmit` pulito
- [x] `npx vitest run` — 94/94 verdi (78 preesistenti + 16 nuovi)
- [x] `npx next build` — compilato, 172/172 pagine statiche, zero errori
- [x] Giro manuale a 375px su dev server: mappa, onboarding, classifica, scheda spot, scopri
- [x] Errori console in dev confrontati con `main` via stash: identici, nessuno introdotto da questo lavoro

### Foto Street View — identificate, SQL pronto
- [x] Guardate tutte e 116 le copertine, non solo l'euristica: **26 sono screenshot di Google Maps / Street View**. L'estensione `.png` ne prendeva solo 16; fra i `.jpg` ce n'erano altri 10 riconoscibili da status bar del telefono, logo Google, "© 2026 Google", barra indirizzo, pin rossi, un dialog "Share Street View?"
- [x] `supabase/migrations/20260819b_mark_streetview_photos.sql` — UPDATE per url, con il nome dello spot in commento su ogni riga
- [ ] **DECISIONE APERTA**: `Skate park austria` (Zirl) — vista dall'alto 320x489, nessuna UI Google. Potrebbe essere una foto da drone. L'ho lasciato FUORI dall'UPDATE: dimmi tu

### Rimasti — serve la tua mano
- [x] **Push fatto** (autorizzato da Christian): branch `ux/fase1-2-app` su origin. PR da aprire: https://github.com/chrispybmx/chrispymps/pull/new/ux/fase1-2-app — `gh` non è installato sulla macchina, quindi la PR va aperta dal browser
- [x] **MERGE FATTO E DEPLOY LIVE** (19/08/2026, commit merge `dfa257c`). Verificato PRIMA del push su main mergiato: tsc pulito, 94/94 test, build 172/172.
      Verificato DOPO sul sito vero: `/api/spots` restituisce `condition_updated_at` su tutti e 116 gli spot (solo il codice nuovo lo fa); scheda Panchina/Silandro mostra badge giallo `ALIVE · 4m` e l'etichetta "foto da mappa — serve uno scatto vero"; classifica in ordine 240·175·152·100·80·50.
      NB: il push ha portato su anche `dc19fda` (docs sessione SiteGround), che era fermo in locale su main da prima e non era mai stato pushato
- [x] **Migration APPLICATE al DB prod** (19/08/2026, SQL Editor via browser, dopo login fatto da Christian):
      1. `20260819_spot_photos_source.sql` → "Success. No rows returned". Prima `spot_photos` aveva 10 colonne, nessuna `source`
      2. `20260819b_mark_streetview_photos.sql` → prima un SELECT di controllo ha confermato **26 righe corrispondenti** sulle 26 attese, poi l'UPDATE
      Verifica finale: `SELECT source, count(*) FROM spot_photos GROUP BY source` → **rider 212, streetview 26** (238 foto totali)
      NB: l'etichetta sul sito compare solo dopo il merge — il codice che legge `source` è sul branch, non ancora in produzione. La colonna in più non disturba il codice attualmente deployato
- [ ] **Provare su telefono vero** l'apertura geolocalizzata: nel browser di test il permesso non viene concesso, quindi il ramo "N spot nella tua zona" con la distanza non è mai stato visto dal vivo
- [ ] Fase 3 (push notification, rituale post-visita, clip agganciate agli spot) non iniziata — le push richiedono chiavi VAPID che devi generare tu

### Chiuso con una decisione
- [x] `A&C Wedding Jam` (05/09) fuori dal banner evento vicino, e va bene così: il record ha `location: 'Italy'`, niente città e niente coordinate — è granularità nazionale, arriva così dallo scraper illuminatebmx. Un fallback su `country_code` lo mostrerebbe a ogni italiano a qualunque distanza, cioè esattamente il rumore che il banner serve a togliere. Se lo vuoi coperto, serve la città nel record, non codice

### Preesistente, trovato ma non toccato (fuori scope)
- [ ] Errore di idratazione da `SpotRadarToggle` in SideMenu.tsx: legge localStorage durante il render, il server rende un markup diverso dal client. Presente anche su `main`, visibile solo in dev

### Trovato durante la sessione — verificato, NON è un problema
- [x] **Supabase "Grace period is over"**: allarme rientrato dopo aver aperto i numeri. Il testo completo è *"Your grace period ended on 02 Jun, 2026. Fair Use Policy applies now. **If** your organization is over its quota, your projects can be restricted"* — è un avviso di policy che Supabase mostra a tutti i piani Free, non una segnalazione sull'account.
      Uso reale al 19/08/2026 (ciclo 05 ago – 05 set), org `chrispybmx`: Cached Egress 0,725/5 GB (15%) · Storage 0,103/1 GB (10%) · Database 0,03/0,5 GB (6%) · Egress 0,243/5 GB (5%) · MAU 11/50.000 · Realtime ed Edge Functions a zero. Nessuna azione necessaria.
- [ ] Solo da tenere d'occhio nel tempo: **Storage, limite 1 GB** — è il contatore che si riempie per primo man mano che la community carica foto (238 foto = 10%)

## 2026-08-19 — Aggiungi spot: meno passaggi (richiesta di Christian)
Il vincolo "non toccare aggiungi spot" è stato tolto da Christian, che ha proposto lui la modifica.

- [x] **Posizione: da 2 tap a 0 o 1.** Prima: schermata "come vuoi indicare la posizione?" → schermata "il browser chiederà il permesso" → dialog. Il primo tap chiedeva una decisione a uno in piedi sullo spot.
      Ora `locMode` parte su `'gps'` e si guarda `navigator.permissions.query({name:'geolocation'})`:
      permesso già concesso → `getGPS()` da solo, zero tap; permesso assente → spiegazione + un bottone.
      **Perché non spariamo il dialog subito**: chi se lo vede arrivare senza contesto tocca "Blocca" d'istinto e il browser lo ricorda per sempre — si brucia proprio chi voleva contribuire.
      Via di fuga in fondo, piccola: "Non sono nello spot — inserisci le coordinate →"
- [x] Selettore metodo rimosso (irraggiungibile dopo il default) + `methodBtn` inutilizzato. I link di ritorno da `coords` ora puntano a `'gps'`, non al selettore inesistente
- [x] **Foto: lo scatto diventa l'azione.** Prima due bottoni identici affiancati (Scatta / Galleria): nessun default. Ora `📸 SCATTA LA FOTO` arancione pieno e sotto, piccolo, "aggiungi dalla galleria".
      Collegato al problema delle copertine: 26 su 116 erano screenshot di Google Maps, e la galleria è la porta da cui entrano
- [x] Verificato: tsc pulito, 94/94 test, build 172/172, tutti gli stati GPS (denied/timeout/error) ancora raggiungibili
- [x] **VERIFICATO a video** (dopo il feedback di Christian: la posizione arrivava, ma il link piccolo non c'era). Montato il modale in locale con uno stub di `useUser` dietro `NEXT_PUBLIC_UI_PREVIEW=1`, provati tutti gli stati, poi stub rimosso e `git diff --quiet hooks/useUser.ts` confermato pulito.

### Due bug che avevo introdotto io, trovati grazie alla prova di Christian
- [x] **Il link di uscita spariva proprio nel caso normale.** Stava dentro il blocco `locMode === 'gps' && !hasCoords`: prendendo il GPS da solo, `hasCoords` diventa subito true e quel blocco non compare mai. Chi NON era sullo spot restava senza via d'uscita. Ora "Non sono nello spot — ho le coordinate →" sta anche sotto la posizione confermata
- [x] **Vicolo cieco su "Cambia →".** Faceva `setLocMode(null)`, ma il selettore di metodo l'avevo rimosso: `null` non corrisponde a nessun ramo, quindi la sezione posizione restava VUOTA. Ora è "Rileva di nuovo →" e riporta su `'gps'`
- [x] **Reset con doppia assegnazione.** In `handleClose` avevo aggiunto `setLocMode('gps')` ma sotto era rimasto `setLocMode(null)`, che vinceva: chiudendo e riaprendo il modale la sezione posizione sarebbe rimasta vuota. Latente — funzionava solo la prima volta

## 2026-08-19 — Mappa chiara + categoria Transition
- [x] **Mappa scura annullata.** L'avevo messa scura di default per uniformarla alla UI. A Christian non piace: sulle tile scure gli spot si leggono peggio quando giri davvero. Torna chiara di default, il toggle resta e la preferenza salvata vince. **Lezione: la coerenza cromatica è un argomento mio, la leggibilità è un argomento suo — vince il suo.**
- [x] Nuova categoria **Transition** (`lib/types.ts`, `TIPI_SPOT`, test aggiornato a 11 tipi). Tutta la UI la prende da `TIPI_SPOT`, quindi filtri, Scopri, admin e import KML la ereditano senza altri interventi
- [x] **Migration APPLICATA** (19/08/2026, SQL Editor). Al primo tentativo il classifier aveva bloccato; su richiesta esplicita di Christian ripetuto ed è passato. Verificato: `enum_range(NULL::spot_type)` restituisce **11 valori** con `transition` presente
- [x] **Street diventa categoria storica** (decisione di Christian): i 60 spot restano `street` e il filtro continua a mostrarla, ma **non è più scegliibile quando si aggiunge uno spot**. Implementato con un flag `legacy: true` in `TIPI_SPOT` + `TIPI_SPOT_SELEZIONABILI` in constants (costante testabile invece di un filtro dentro il JSX). 4 test nuovi
- [ ] Ri-categorizzare i 60 `street` esistenti: una parte sono transition. Serve l'occhio di chi conosce gli spot. Da oggi però il calderone non cresce più

## 2026-08-19 — Cancella account: fuori dal profilo, dentro Modifica profilo
Richiesta di Christian: "cancella profilo" via dalla pagina profilo, dentro modifica profilo come seconda pagina, quasi nascosto.

- [x] Nuova pagina `/u/[username]/modifica` (`page.tsx` + `EditProfileClient.tsx`), `noindex/nofollow` e canonical null: è una pagina privata
- [x] Guardia proprietario nel client: se la sessione non corrisponde all'username → schermata "Questo profilo non è tuo". La pagina non espone dati sensibili (bio e Instagram sono già pubblici sul profilo), quindi è un guard di UX, non di sicurezza; le scritture restano protette dal token su `/api/profile`
- [x] Spostati nella pagina nuova: avatar, bio, Instagram, salvataggio
- [x] `ProfileClient`: "✏️ Modifica profilo" da bottone che apriva un pannello inline a link verso la pagina. Rimossi form inline, `handleSave`, `handleDeleteAccount` e gli stati `editing/saving/deleting/msg`
- [x] Cancellazione account: in fondo alla pagina modifica, testo grigio scurissimo "Elimina account". Aprendola compare la spiegazione + campo dove scrivere il proprio username; il bottone resta disabilitato finché il nome non combacia
- [x] Sostituito `window.confirm` con la conferma per digitazione: un confirm si scarta per riflesso, scrivere il proprio nome no
- [x] Verificato a video con stub di sessione (poi rimosso, `git diff --quiet` su supabase-browser e useUser): profilo senza più "Cancella profilo", link a `/u/chrispy/modifica`, campi precompilati, bottone disabilitato con nome sbagliato e attivo con quello giusto
- [x] tsc pulito, 98/98 test, build 172/172, lint pulito sui file toccati
- NB GDPR: la cancellazione resta raggiungibile — è un diritto dell'utente e la privacy policy la promette. È nascosta, non rimossa

## 2026-08-19 — Login Google: reso visibile il fallimento (causa radice NON ancora isolata)
Segnalazione: "il login con Google non funziona, non ti fa creare un profilo".

### Verificato funzionante (non è qui il problema)
- [x] Bottone "Continua con Google" nel bundle di produzione, live dal commit 98586c6 del 9 luglio
- [x] Provider Google `Enabled` su Supabase, con client_id reale
- [x] Site URL `https://maps.chrispybmx.com`; Redirect URLs includono `maps.chrispybmx.com/**`
- [x] `/auth/v1/authorize?provider=google` → 302 verso accounts.google.com con client_id valido
- [x] Google accetta: nessun `redirect_uri_mismatch`, nessun `invalid_client`, nessun "Access blocked"
- [x] `/auth/callback` raggiungibile e coerente col codice (codice finto → `?auth_error=oauth_failed`)
- [x] `/auth/setup-username` → 200
- [x] RLS `profiles`: `profiles_own_insert` con check `auth.uid() = id` — corretta
- [x] `setupGoogleUsername` inserisce davvero in `profiles` ed è collegata alla pagina

### Dati
- 47 utenti totali, **tutti `provider = email`, zero Google**. 7 iscritti dal 9 luglio, zero Google. Zero utenti senza profilo (il flusso email funziona)

### Difetto certo, corretto
- [x] `?auth_error=` veniva scritto e **mai letto da nessuno** → nuovo `components/AuthErrorBanner.tsx`, avviso persistente sulla mappa
- [x] `setup-username`: il timeout di 6s rimandava a `/map` in silenzio → ora `/map?auth_error=no_session`
- [x] `/auth/callback`: distingue `no_code` da `oauth_failed` e logga il messaggio esatto dell'errore
- [x] `lib/auth-errors.ts` con messaggi che dicono cosa fare + 6 test
- [x] Verificato a video: l'avviso compare e resta finché non lo chiudi; il parametro sparisce dall'URL

### Aperto
- [ ] **Causa radice non isolata**: l'ultimo tratto (scambio del codice e passaggio della sessione al browser) richiede un login Google vero, che non posso fare al posto di Christian. Ora però il fallimento ha un nome: **Christian riprova e il messaggio dirà quale passaggio si rompe** (`oauth_failed` = scambio lato server, `no_session` = sessione non arrivata al browser, `profile_failed` = profilo non creato)

### 2026-08-19, secondo giro — Christian riprova: "Google ha risposto con un errore"
Codice ricevuto: `server_error`. Significa che Google ha completato ma **Supabase non è riuscito a chiudere lo scambio**.

Escluse con prove:
- [x] Trigger su `auth.users`: **nessuno** (query su pg_trigger) → esclusa la "Database error saving new user" da trigger
- [x] Gli account `christian.ceresato@gmail.com` e `christian.ceresatob@gmail.com` esistono come `provider=email`, email **confermata**, 1 identità ciascuno

Rimane in piedi: collisione di identità (email già registrata con password che tenta di legarsi a Google) oppure client secret Google errato/scaduto lato Supabase.

- [x] **Mio errore corretto**: il callback leggeva solo `error` e buttava via `error_description` / `error_code`, cioè proprio la stringa che dice il motivo. Ora li legge, li logga e li mostra come "Dettaglio tecnico" nel banner
- [ ] **Prossimo passo**: Christian riprova e legge il Dettaglio tecnico. Quella stringa è la risposta letterale di Supabase e chiude l'indagine
- [ ] Se dice "Unable to exchange external code" → rigenerare Client ID/Secret su Google Cloud Console e reincollarli in Supabase
- [ ] Se parla di identità/utente già esistente → è la collisione con l'account email; si risolve provando con un account Google mai usato sul sito, o abilitando il linking manuale

### Strumentazione: i fallimenti OAuth finiscono nel database
Christian riprova e vede ancora solo "errore" senza riferire il dettaglio. Tolgo l'utente dalla staffetta.
- [x] Tabella `auth_failure_log` creata e **applicata in produzione** (RLS attiva, zero policy → solo service role)
- [x] `/auth/callback` ci scrive: provider, error_code, error_detail (l'`error_description` del provider), stage, user_agent. Scrittura in try/catch e **awaited** (vedi lessons: su serverless le promise non attese non completano)
- [x] **Verificato end-to-end in produzione**: 6 sonde inviate al callback vero → 6 righe con stage `provider_redirect`, codice e dettaglio corretti, ua `curl/8.7.1`
- [ ] Christian riprova il login Google UNA volta → leggo la riga in SQL:
      `SELECT created_at, stage, error_code, error_detail FROM auth_failure_log WHERE error_code NOT LIKE 'sonda%' ORDER BY created_at DESC LIMIT 5;`
- Nota: le righe `sonda_*` e `test_deploy` sono mie, da ignorare o cancellare
