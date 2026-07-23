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

## Ricorrente — questo progetto non ha CLI/psql per il DB
DDL solo via Supabase SQL Editor (browser). Nessun `DATABASE_URL`, nessun Personal Access Token
Management, `supabase` CLI non installato. Il service-role key fa solo PostgREST (no DDL).
Le migration si scrivono in `supabase/migrations/` per storico, ma vanno applicate a mano.
