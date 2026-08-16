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
