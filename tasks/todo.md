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
- [ ] ⚠️ DA INCOLLARE nel SQL Editor: fix FK + enum 'deleted' (poi cleanup orfani opz.)
- [ ] ⚠️ PUSH → deploy (in attesa OK utente)
- [ ] Verifica live post-migration: upload foto ok + delete spot ok
- [ ] Routine scraping eventi ogni 2 settimane (UCI dataride vuoto; worldrookietour WP REST viable) — DA FARE

## Prossimi passi (aperti)
- [ ] Mostrare country nella UI (filtro paese su mappa/cerca-spot, bandierine) — fase 2 del world-wide
- [ ] Lingua/i18n (decisione aperta: en default / i18n / resta it)
- [ ] Soft-404 sito-wide: notFound() risponde HTTP 200 con body 404 su TUTTE le route dinamiche (pre-esistente, non regressione) — indagare middleware/CSP
- [ ] ⚠️ Supabase FREE: banner "Grace period is over" — rivedere quota/billing prima che blocchi le richieste
