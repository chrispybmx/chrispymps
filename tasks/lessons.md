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

## Ricorrente — questo progetto non ha CLI/psql per il DB
DDL solo via Supabase SQL Editor (browser). Nessun `DATABASE_URL`, nessun Personal Access Token
Management, `supabase` CLI non installato. Il service-role key fa solo PostgREST (no DDL).
Le migration si scrivono in `supabase/migrations/` per storico, ma vanno applicate a mano.
