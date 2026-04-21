# ChrispyMPS — Find Your Spot 🏴

La mappa BMX street italiana, community-driven.

**URL**: [chrispybmx.com/map](https://chrispybmx.com/map)  
**Stack**: Next.js 14 · Supabase · Leaflet/OSM · Vercel · Resend

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

### Custom domain (chrispybmx.com/map)

In Vercel → Settings → Domains → aggiungi `chrispybmx.com`.  
Nel tuo registrar DNS aggiungi i record che Vercel ti mostra.

---

## Struttura del progetto

```
app/
  layout.tsx          — Root layout (VHS overlay, SupportStrip)
  map/
    page.tsx           — Mappa principale (server component)
    MapClient.tsx      — Wrapper client con stato
    loading.tsx        — Loading screen VHS
    [city]/page.tsx    — Pagina città (ISR)
    spot/[slug]/       — Pagina singolo spot (OpenGraph completo)
    support/           — Pagina donazioni Ko-fi
    about/             — Chi siamo / Privacy
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

components/
  SpotMap.tsx          — Mappa Leaflet (dynamic, no SSR)
  SpotSheet.tsx        — Scheda spot (bottom sheet)
  AddSpotModal.tsx     — Form aggiungi spot (multi-step)
  PhotoUpload.tsx      — Upload foto con camera support
  TopBar.tsx           — Barra superiore + filtri
  SideMenu.tsx         — Drawer menu laterale
  SupportStrip.tsx     — Strip donazioni ambient
  SupportModal.tsx     — Modal Ko-fi
  AdminCard.tsx        — Card moderazione mobile
  VhsOverlay.tsx       — Scanlines overlay

lib/
  types.ts             — Tipi TypeScript
  constants.ts         — TIPI_SPOT, CITTA, palette, link
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

## Feature Day 1 ✅

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

---

*Made with 🏴 by [Chrispy](https://instagram.com/chrispy_bmx)*
