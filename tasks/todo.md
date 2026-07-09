---
title: todo
type: note
permalink: ai/antigravity/tasks/todo
---

# World-wide readiness — todo

## Fase 1 — DB: country su spots
- [ ] Migration SQL `spots.country` + `spots.country_code` (pattern da 20260504_events_worldwide.sql) + backfill IT + index
- [ ] submit-spot salva country/country_code
- [ ] reverseGeocode estrae anche country

## Fase 2 — Geocoding world
- [ ] lib/geocoding.ts: via `countrycodes: 'it'`
- [ ] accept-language neutro/dinamico
- [ ] UI ricerca regge risultati mondiali (displayExtra col paese)

## Fase 3 — Mappa world
- [ ] SpotMap: vista iniziale non-Italia (geolocate → fallback mondo/fit spots)
- [ ] AddSpotModal: fallback center non hardcoded Italia

## Fase 4 — Città dinamiche
- [ ] /map/[city] data-driven (no CITTA_ITALIANE)
- [ ] sitemap città da DB
- [ ] TopBar dropdown da dati
- [ ] Admin dashboard/edit: città input libero
- [ ] skate-maps: verifica uso lista

## Verifica
- [ ] typecheck + build ok
- [ ] test esistenti passano
- [ ] commit (push solo su ok di Christian)

## Parcheggiato
- Lingua/i18n (decisione aperta)
- Piano welcome-regolamento (tasks/welcome-regolamento-plan.md, decisione A/B/C aperta)