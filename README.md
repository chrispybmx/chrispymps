---
title: README
type: note
permalink: ai/antigravity/readme
---

# Chrispy Maps — Find Your Spot 🏴

La mappa community per trovare, salvare e aggiornare spot BMX, skate e scooter.

**URL**: [maps.chrispybmx.com](https://maps.chrispybmx.com)<br>
**Stack**: Next.js 14 · Supabase · Leaflet/OSM · Vercel · Resend · MailerLite

## Stato prodotto

Chrispy Maps non è più solo una mappa Day 1. Oggi include:
- mappa spot con filtri, ricerca, geolocalizzazione, radius search e preferiti
- contributi community: nuovi spot, foto, commenti, like, rating e conferme stato
- profili rider, XP, livelli e classifica
- sezioni Scopri, Sfoglia, Eventi, News e Sessioni live
- admin per moderazione spot, news, eventi, foto e utenti
- privacy policy, cancellazione account e gestione consenso cookie/localStorage

La priorità UX resta: aprire la mappa, capire cosa c'è vicino, contribuire uno spot reale con foto scattata sul posto.

---

## Setup locale

### 1. Prerequisiti
- Node.js 18+
- Account Supabase (gratuito)
- Account Resend (gratuito)

### 2. Clona e installa

```bash
git clone https://github.com/TUO_USERNAME/chrispymps.git
cd chrispymps
npm install
```

### 3. Variabili d'ambiente

```bash
cp .env.example .env.local
```

Compila `.env.local` con:
- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Supabase Dashboard → Settings → API
- `SUPABASE_SERVICE_ROLE_KEY` → stesso posto (tienila segreta!)
- `RESEND_API_KEY` → resend.com → API Keys
- `ADMIN_PASSWORD` → la password per `/admin`
- `ADMIN_SECRET` → stringa random di almeno 32 caratteri

### 4. Setup database Supabase

Nel pannello Supabase → SQL Editor → incolla ed esegui il contenuto di `supabase/schema.sql`.

Poi in Storage → crea due bucket pubblici:
- `spot-photos` (limite 5MB, immagini)
- `status-photos` (limite 5MB, immagini)

### 5. Avvia in sviluppo

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000) — si redirecta automaticamente a `/map`.

---

## Import spot da Google My Maps

Se hai già degli spot su Google My Maps:

1. Apri la mappa → Menu ⋮ → Esporta in KML
2. Salva il file (es. `mymaps.kml`)
3. Esegui:

```bash
# Dry run (solo preview, non scrive niente)
npm run seed -- --file=./mymaps.kml --dry-run

# Import reale
npm run seed -- --file=./mymaps.kml
```

---

## Generare QR sticker per spot fisici

```bash
# Installa la libreria QR (una tantum)
npm install qrcode @types/qrcode

# Genera per una città
npx tsx scripts/generate-qr.ts --city=verona

# Genera tutti
npx tsx scripts/generate-qr.ts --all
```

Output in `tmp/qr-stickers/` — file HTML stampabile (A4, 3 sticker per riga).

---

## Deploy su Vercel

1. Pusha il codice su GitHub
2. Vai su [vercel.com](https://vercel.com) → Import Project → seleziona il repo
3. In Settings → Environment Variables → aggiungi tutte le variabili da `.env.local`
4. Deploy!

### Custom domain (maps.chrispybmx.com)

In Vercel → Settings → Domains → aggiungi `maps.chrispybmx.com`.<br>
Nel tuo registrar DNS aggiungi i record che Vercel ti mostra.

---

## Struttura del progetto

```
app/
  layout.tsx          — Root layout, metadata, JSON-LD, cookie banner
  map/
    page.tsx           — Mappa principale (server component)
    MapClient.tsx      — Wrapper client con stato mappa, filtri, pannello spot
    loading.tsx        — Loading screen VHS
    [city]/page.tsx    — Pagina città (ISR)
    spot/[slug]/       — Pagina singolo spot (OpenGraph completo)
    support/           — Pagina supporto community e donazioni
    about/             — Chi siamo
  sfoglia/             — Esperienza swipe per salvare spot
  scopri/              — Feed scoperta spot
  events/              — Eventi e calendario community
  news/                — News e contenuti editoriali
  classifica/          — Ranking XP rider
  u/[username]/        — Profilo pubblico e modifica profilo
  admin/
    login/             — Form password
    page.tsx           — Dashboard moderazione
    [id]/              — Edit spot singolo
  api/
    submit-spot/       — POST: invia nuovo spot
    spots/             — GET: lista spot per la mappa
    admin/approve      — POST/GET: approva spot
    admin/reject       — POST/GET: rifiuta spot
    admin/update-status — POST: aggiorna condizione spot
    admin/login        — POST: autenticazione admin
    admin/logout       — POST: logout admin
    admin/edit-spot    — POST: modifica spot da admin
    flag/              — POST: segnala spot
    user/delete        — DELETE: cancellazione account

components/
  SpotMap.tsx          — Mappa Leaflet (dynamic, no SSR)
  AddSpotModal.tsx     — Form aggiungi spot con GPS, foto e anti-duplicati
  PhotoUpload.tsx      — Upload foto con camera support
  TopBar.tsx           — Barra superiore + filtri
  SideMenu.tsx         — Drawer menu laterale
  BottomNav.tsx        — Navigazione mobile principale
  FreshnessDot.tsx     — Freschezza dello stato spot
  AdminCard.tsx        — Card moderazione mobile
  VhsOverlay.tsx       — Scanlines overlay
  AuthModal.tsx        — Login, registrazione, reset password

lib/
  types.ts             — Tipi TypeScript
  constants.ts         — TIPI_SPOT, regioni, palette, link, config
  image.ts             — Resize, compressione e strip EXIF
  ssrf.ts              — Guardie anti-SSRF
  rate-limit.ts        — Rate limit Upstash opzionale + fallback memory
  email.ts             — Email Resend (admin, conferma, approvazione)
  mailerlite.ts        — Iscrizione newsletter
  auth.ts              — Autenticazione admin + token HMAC
  slugify.ts           — Slug URL
  supabase.ts          — Client Supabase (browser/server/admin)

scripts/
  import-kml.ts        — Seed da Google My Maps KML
  generate-qr.ts       — QR sticker per spot fisici

public/
  manifest.json        — PWA manifest
  sw.js                — Service Worker (offline + cache tile mappa)
```

---

## Admin

URL: `/admin` (non pubblicizzato)

Login con la password impostata in `ADMIN_PASSWORD`.

Funzionalità:
- Coda spot in attesa con foto, GPS, dettagli
- Approva / Rifiuta con un tap
- Edit spot (nome, tipo, condizione, YouTube, GPS)
- Approvazione anche via link email (link incluso nella notifica)

---

## Feature principali

- [x] Mappa interattiva Leaflet/OSM
- [x] Filtri per tipo spot
- [x] Ricerca per città
- [x] Form aggiungi spot (GPS + foto + dati) — friction zero
- [x] Moderazione admin mobile
- [x] Email notifiche (admin + contributor)
- [x] MailerLite newsletter
- [x] PWA installabile (manifest + service worker)
- [x] Pagine città con SEO
- [x] Pagina singolo spot con OpenGraph
- [x] Stato spot datato (alive/bustato/demolito)
- [x] Integrazione YouTube nella scheda spot
- [x] QR sticker generabili da script
- [x] Cache offline tile mappa
- [x] Donazioni Ko-fi ambient (no popup, no paywall)
- [x] Profili rider, XP, livelli e classifica
- [x] Eventi, news, commenti e notifiche
- [x] Upload immagini ottimizzato con rimozione metadati EXIF
- [x] Rate limiting e CSP nonce-based
- [x] Privacy policy, cookie banner e cancellazione account

---

*Made with 🏴 by [Chrispy](https://instagram.com/chrispy_bmx)*
