---
title: SECURITY_PRIVACY_AUDIT
type: note
permalink: ai/antigravity/security-privacy-audit
---

# SECURITY & PRIVACY AUDIT — ChrispyMPS (maps.chrispybmx.com)

**Data**: 2026-05-06
**Auditor**: Automated Security & GDPR Compliance Review
**Stack**: Next.js 14.2.5 / Supabase / Leaflet / Resend / MailerLite / Vercel
**Dominio**: maps.chrispybmx.com
**Scope**: Sicurezza applicativa + Conformita GDPR (utenti UE/IT)

---

## EXECUTIVE SUMMARY — TOP 10 RISCHI

| # | Rischio | Severity | Track | Rif. |
|---|---------|----------|-------|------|
| 1 | **Next.js 14.2.5 ha bypass middleware auth (CVSS 9.1)** — rate limiting e protezioni middleware aggirabili | **CRITICAL** | SEC | CWE-1395 |
| 2 | **Iscrizione automatica newsletter senza consenso** — signup auto-iscrive a MailerLite senza checkbox separata, no double opt-in | **CRITICAL** | GDPR | Art. 6(1)(a), 7, 130 CP |
| 3 | **Privacy policy totalmente inadeguata** — 4 righe nel "Chi siamo", mancano tutti gli elementi Art. 13 | **CRITICAL** | GDPR | Art. 13 |
| 4 | **Nessuna cancellazione account utente (Art. 17)** — nessun bottone "Elimina account", nessun endpoint | **CRITICAL** | GDPR | Art. 17 |
| 5 | **Trasferimenti USA non documentati** — Supabase/Vercel/Resend USA, nessuna SCC/TIA documentata | **CRITICAL** | GDPR | Art. 44-49 |
| 6 | **migrate-mailerlite auth rotta** — auth diversa da tutte le altre route, potenziale accesso non autenticato | **HIGH** | SEC | CWE-287 |
| 7 | **SSRF in resolve-gmaps** — nessun blocco IP privati, DNS rebinding, redirect chain non validata | **HIGH** | SEC | CWE-918 |
| 8 | **CSP con 'unsafe-inline' + 'unsafe-eval'** — protezione XSS via CSP inefficace | **HIGH** | SEC | CWE-79 |
| 9 | **Nessuna verifica eta (14+ in Italia)** — target BMX con alta probabilita di minori | **HIGH** | GDPR | Art. 8, Art. 2-quinquies CP |
| 10 | **Nessun cookie banner** — anche i cookie tecnici richiedono banner informativo (Garante 2021) | **CRITICAL** | GDPR | ePrivacy Art. 5(3) |

**Totali**: Critical: 8 | High: 9 | Medium: 14 | Low: 10

---

# TRACCIA 1 — SICUREZZA APPLICATIVA

---

## SEC-01: Supabase RLS

### SEC-01.1: Tabella `contributors` — INSERT senza restrizioni
- **Severity**: Medium
- **File**: `supabase/schema.sql:111-112`
- **CWE**: CWE-284 (Improper Access Control)
- **Descrizione**: `FOR INSERT WITH CHECK (true)` — qualsiasi client anonimo puo inserire righe arbitrarie nella tabella contributors. L'UPDATE policy e stata correttamente rimossa in `20260428_security_fixes.sql`, ma l'INSERT resta aperta.
- **Impatto**: Flood di dati fake, spoofing email di contributor reali.
- **Remediation**: Rimuovere INSERT policy anonima. Tutte le creazioni contributor devono passare dal service role nelle API route (che gia bypassa RLS).

### SEC-01.2: Tabella `spot_status_updates` — SELECT con USING (true)
- **Severity**: Low
- **File**: `supabase/schema.sql:107-108`, `migrations/phase1_contributions.sql:86-87`
- **CWE**: CWE-200
- **Descrizione**: Policy `"public read status updates"` usa `USING (true)`, esponendo identita reporter (`user_id`).
- **Impatto**: Basso — status updates pensati pubblici, ma espone chi ha segnalato.
- **Remediation**: Filtrare per mostrare solo status updates su spot approvati.

### SEC-01.3: Tabella `flags` — INSERT senza restrizioni
- **Severity**: Low
- **File**: `supabase/schema.sql:131-132`
- **CWE**: CWE-284
- **Descrizione**: `WITH CHECK (true)` su flags. L'API route usa `supabaseAdmin()` e valida con Zod, ma un client diretto con anon key puo bypassare l'API.
- **Impatto**: Spam/abuso flagging via REST API Supabase diretta.
- **Remediation**: Rimuovere INSERT policy anonima o richiedere che `spot_id` riferisca uno spot approvato.

### SEC-01.4: Tabelle `comments`, `events`, `news`, `favorites`, `spot_likes`, `spot_ratings` — Non tracciate nelle migration
- **Severity**: Medium
- **File**: Nessun file migration trovato per i CREATE TABLE
- **CWE**: CWE-284
- **Descrizione**: Queste tabelle sono referenziate in tutto il codebase (ALTER, SELECT, INSERT) ma il CREATE e le RLS policy non sono in nessun file SQL versionato. Probabilmente create via dashboard Supabase.
- **Impatto**: Se RLS non abilitata (specialmente `comments`, `events`, `news`), qualsiasi utente con anon key puo leggere/scrivere/cancellare righe via REST API.
- **Remediation**: Esportare definizioni tabelle e RLS policies da dashboard Supabase. Aggiungere a migration versionati. Verificare: (a) RLS abilitata, (b) SELECT ristretto a contenuti approvati, (c) INSERT richiede `auth.uid()`, (d) DELETE solo admin.

### SEC-01.5: Tabella `sessions` — Mancano INSERT/DELETE RLS
- **Severity**: Medium
- **File**: `supabase/migrations/20260430200_add_sessions.sql:17-21`
- **CWE**: CWE-284
- **Descrizione**: RLS abilitata con SELECT policy (`expires_at > now()`), ma nessuna policy INSERT/DELETE. Tutti gli accessi devono passare dal service role.
- **Impatto**: Basso in isolamento (anon key non puo INSERT/DELETE), ma nessuna difesa in profondita.
- **Remediation**: Accettabile se intenzionale. Documentare che sessions gestite esclusivamente via service role. In alternativa, aggiungere policy INSERT/DELETE con `auth.uid() = user_id`.

### SEC-01.6: Storage DELETE troppo permissivo
- **Severity**: Medium
- **File**: `supabase/migrations/20260428_security_fixes.sql:60-66`
- **CWE**: CWE-284
- **Descrizione**: Le DELETE policy per bucket `spot-photos` e `status-photos` usano solo `USING (bucket_id = '...')` senza restrizione ruolo. Qualsiasi utente autenticato puo cancellare qualsiasi file.
- **Impatto**: Un utente autenticato potrebbe cancellare tutte le foto spot/status via Supabase Storage API.
- **Remediation**: Restringere DELETE a service role. Rimuovere policy (service role bypassa RLS comunque), o aggiungere `auth.role() = 'service_role'`.

---

## SEC-02: SSRF in /api/resolve-gmaps

### SEC-02.1: SSRF via DNS Rebinding / Redirect a IP interni
- **Severity**: HIGH
- **File**: `app/api/resolve-gmaps/route.ts:32-41`
- **CWE**: CWE-918
- **Descrizione**: La route fa `fetch(url)` con `redirect: 'follow'` su URL fornito dall'utente. Pur avendo controlli prefisso (linee 15-20) e whitelist hostname post-redirect (linee 44-50), restano vettori:
  1. **Nessun blocco IP privati prima del fetch iniziale** — la fetch segue redirect automaticamente
  2. **`redirect: 'follow'` risolve l'intera chain** — connessione TCP a qualsiasi IP DNS risolva, inclusi IP interni. Il check hostname valida solo URL finale stringa, non l'IP effettivo
  3. **Nessun limite dimensione response** — slow-loris o response gigante da servizio interno
  4. **DNS rebinding** — dominio che alterna tra IP Google-whitelisted e IP interno
- **Impatto**: Potenziale accesso a endpoint metadata cloud (169.254.169.254), servizi interni, esfiltrazione dati dal contesto rete Vercel.
- **Remediation**:
  1. Usare `redirect: 'manual'` e seguire redirect manualmente, validando IP risolto a ogni hop contro blocklist (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16, ::1, fc00::/7, fe80::/10)
  2. Usare `dns.resolve()` prima di ogni fetch per verificare IP non privato
  3. Aggiungere limite dimensione response (max 1MB)
  4. Il timeout 8s e buono, combinare con sopra

### SEC-02.2: Schema correttamente ristretto a HTTPS
- **Severity**: Informational
- **File**: `app/api/resolve-gmaps/route.ts:15-20`
- **Descrizione**: Tutti i controlli prefisso usano `https://`. Blocca `http://`, `file://`, `gopher://`. Ben fatto.
- **Remediation**: Nessuna azione necessaria.

---

## SEC-03: XSS

### SEC-03.1: Rischio XSS stored in News body via dangerouslySetInnerHTML
- **Severity**: Medium
- **File**: `app/news/[slug]/page.tsx:214, 223, 236-244`
- **CWE**: CWE-79
- **Descrizione**: `inlineFormat()` applica `escapeHtml()` prima di trasformare markdown-like in HTML (ordine corretto). URL auto-linking prende testo gia escaped. **Attualmente safe**, ma rischio futuro se qualcuno inverte l'ordine.
- **Impatto**: Basso residuo. Chain escaping corretta.
- **Remediation**: Aggiungere commento codice che `escapeHtml` DEVE eseguire prima dell'URL handling. Valutare libreria markdown testata.

### SEC-03.2: JSON-LD injection via `</script>` in dati utente
- **Severity**: Low
- **File**: `app/map/spot/[slug]/page.tsx:222-229`, `layout.tsx:142,147`, `map/page.tsx:47`, `map/[city]/page.tsx:128-131`, `news/[slug]/page.tsx:250`, `skate-maps/page.tsx:63`
- **CWE**: CWE-79
- **Descrizione**: Nomi spot, descrizioni, citta interpolati in `<script>` JSON-LD via `JSON.stringify()`. `JSON.stringify` NON escapa `</script>`. Uno spot con nome contenente `</script><script>alert(1)//` romperebbe il blocco JSON-LD.
- **Impatto**: XSS su qualsiasi pagina che renderizza JSON-LD dello spot.
- **Remediation**: Escape output di `JSON.stringify()`:
  ```typescript
  const safeJsonLd = JSON.stringify(data).replace(/</g, '\\u003c');
  ```
  Applicare a TUTTE le istanze `dangerouslySetInnerHTML={{ __html: JSON.stringify(...) }}`.

---

## SEC-04: Auth & Authorization

### SEC-04.1: Rate limiter admin login usa IP spoofabile
- **Severity**: Medium
- **File**: `app/api/admin/login/route.ts:16-22`
- **CWE**: CWE-307
- **Descrizione**: `getIp()` usa `x-forwarded-for?.split(',')[0]` (PRIMO elemento = controllato dal client). Middleware usa correttamente l'ULTIMO. Attacker manda IP fake diverso a ogni request, bypassa rate limiter.
- **Impatto**: Rate limiter admin login bypassabile, brute-force illimitato su `ADMIN_PASSWORD`.
- **Remediation**: Allineare `getIp()` con `getClientIp()` del middleware (x-real-ip primo, ultimo elemento x-forwarded-for). Meglio: rimuovere rate limiter duplicato nella route e affidarsi al middleware.

### SEC-04.2: Admin auth con password statica, no Supabase JWT
- **Severity**: Medium
- **File**: `lib/auth.ts:72-93`
- **CWE**: CWE-798
- **Descrizione**: Auth admin usa singola password condivisa (`ADMIN_PASSWORD` env var) con HMAC cookie. Nessun MFA, nessun account lockout (oltre rate limiter spoofabile), nessuna revoca sessione (token validi 7gg senza session store server-side).
- **Impatto**: Se password debole/compromessa, nessun secondo fattore. Sessioni attive non revocabili senza rotazione `ADMIN_SECRET`.
- **Remediation**: Accettabile per scala attuale. Miglioramenti: (a) session revocation list server-side, (b) lungo termine migrare auth admin a Supabase Auth con claim/ruolo custom.

### SEC-04.3: migrate-mailerlite usa meccanismo auth diverso e rotto
- **Severity**: HIGH
- **File**: `app/api/admin/migrate-mailerlite/route.ts:15-17`
- **CWE**: CWE-287
- **Descrizione**: Controlla `req.cookies.get('admin_session')?.value` contro `process.env.ADMIN_SESSION_TOKEN` — meccanismo completamente diverso da tutte le altre route admin (che usano `isAdminAuthenticated()` con cookie `cmps_admin_session` e verifica HMAC). Inoltre referenzia `SUPABASE_SERVICE_KEY` (linea 6) invece del corretto `SUPABASE_SERVICE_ROLE_KEY`.
- **Impatto**: Se `ADMIN_SESSION_TOKEN` non settata: `sessionCookie !== undefined` = endpoint aperto a chiunque con qualsiasi cookie `admin_session`. Se settata: confronto non timing-safe.
- **Remediation**: Sostituire check auth con `isAdminAuthenticated()`. Sostituire `SUPABASE_SERVICE_KEY` con `supabaseAdmin()` da `lib/supabase.ts`.

### SEC-04.4: run-migration usa auth via header non timing-safe
- **Severity**: Medium
- **File**: `app/api/admin/run-migration/route.ts:50-51`
- **CWE**: CWE-287
- **Descrizione**: Controlla `req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET` — terzo meccanismo auth diverso, non timing-safe.
- **Impatto**: Timing side-channel su admin secret.
- **Remediation**: Usare `isAdminAuthenticated()` o `timingSafeEqual`.

### SEC-04.5: Middleware non protegge route admin
- **Severity**: Medium
- **File**: `middleware.ts:178-191`
- **CWE**: CWE-862
- **Descrizione**: Matcher middleware copre solo endpoint specifici per rate limiting, NON include `/api/admin/*`. Ogni route admin deve chiamare `isAdminAuthenticated()` individualmente — pattern fragile.
- **Impatto**: Nessuna esposizione attuale (tutte le route controllano auth), ma alto rischio regressione futura.
- **Remediation**: Aggiungere auth check per `/api/admin/:path*` nel middleware matcher. Return 401 se cookie admin non presente/valido.

---

## SEC-05: Secrets

### SEC-05.1: .env.example con placeholder corretti
- **Severity**: Informational
- **File**: `.env.example:8-9`
- **Descrizione**: Placeholder `eyJ...` per chiavi Supabase, `re_...` per Resend. `.gitignore` esclude correttamente `.env`, `.env.local`, `.env.*.local`.
- **Remediation**: Nessuna. Buona pratica in atto.

### SEC-05.2: SUPABASE_SERVICE_ROLE_KEY correttamente server-only
- **Severity**: Informational
- **File**: `lib/supabase.ts:22`
- **Descrizione**: Accesso via `process.env.SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_`), solo in `lib/supabase.ts` (server) e `scripts/` (CLI). Browser client usa solo `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Remediation**: Nessuna. Implementazione corretta.

### SEC-05.3: ADMIN_SECRET esposto via header HTTP
- **Severity**: Low
- **File**: `app/api/admin/run-migration/route.ts:51`
- **CWE**: CWE-522
- **Descrizione**: `x-admin-secret` header = stesso secret usato per firmare cookie sessione e token approvazione/rifiuto email. Potrebbe apparire in access log, CDN log, browser inspector.
- **Remediation**: Usare `isAdminAuthenticated()` cookie-based.

---

## SEC-06: Upload Storage Supabase

### SEC-06.1: Nessun EXIF stripping su foto caricate
- **Severity**: Medium
- **File**: `app/api/spot-photos/route.ts:126-151`, `app/api/upload-image/route.ts:33-45`, `app/api/admin/upload-photo/route.ts:71-81`
- **CWE**: CWE-200
- **Descrizione**: Tutte le route upload validano MIME via magic bytes (buono), enforceano size limit (buono), ma nessuna strip EXIF. Foto JPEG da smartphone contengono GPS, modello device, timestamp, nome proprietario.
- **Impatto**: Utenti che caricano foto BMX espongono GPS esatto, modello camera, info personali. Bucket pubblici = chiunque puo scaricare e estrarre EXIF.
- **Remediation**: Strip EXIF server-side prima dell'upload. Usare `sharp`:
  ```typescript
  sharp(buffer).rotate().toBuffer() // strip EXIF preservando orientamento
  ```

### SEC-06.2: Bucket pubblici — foto rifiutate/pending accessibili
- **Severity**: Low
- **File**: `supabase/schema.sql:142-148`
- **CWE**: CWE-200
- **Descrizione**: Bucket `spot-photos` e `status-photos` con `public = true`. Appropriato per spot approvati, ma foto rifiutate/pending restano accessibili se si conosce URL.
- **Remediation**: Cleanup job che elimina file storage quando spot rifiutato, o signed URL per foto pending.

### SEC-06.3: Path traversal protetto correttamente
- **Severity**: Informational
- **File**: `supabase/migrations/20260428_security_fixes.sql:42-54`
- **Descrizione**: Policy upload enforce `array_length(string_to_array(name, '/'), 1) = 2`. `delete-spot/route.ts` controlla `..` nei path. Buono.
- **Remediation**: Nessuna.

---

## SEC-07: Rate Limiting

### SEC-07.1: Newsletter subscribe senza rate limit
- **Severity**: Medium
- **File**: `app/api/newsletter/subscribe/route.ts:15`
- **CWE**: CWE-799
- **Descrizione**: `POST /api/newsletter/subscribe` e pubblico e NON nel middleware matcher (linee 179-191). Zero rate limiting.
- **Impatto**: Attacker puo spammare MailerLite API con migliaia di email fake, esaurendo quota subscriber, rischiando sospensione account.
- **Remediation**: Aggiungere a middleware matcher con rate limit 3 req/10min per IP.

### SEC-07.2: Route POST multiple senza rate limit nel matcher
- **Severity**: Medium
- **File**: `middleware.ts:178-191`
- **CWE**: CWE-799
- **Descrizione**: Route non coperte dal middleware: `/api/newsletter/subscribe`, `/api/profile`, `/api/spot-likes`, `/api/comment-likes`, `/api/favorites`, `/api/spot-ratings`, `/api/riders`, `/api/sessions`.
- **Remediation**: Aggiungere tutti gli endpoint POST al matcher con rate limit appropriati.

### SEC-07.3: Rate limiting in-memory inefficace su serverless
- **Severity**: Low
- **File**: `middleware.ts:10-14`
- **CWE**: CWE-799
- **Descrizione**: Rate limiter usa `Map<string, RateLimitEntry>` in memoria. Su Vercel, ogni cold start crea store fresco, istanze multiple concorrenti. Store resetta a ogni deploy.
- **Remediation**: Migrare a Vercel KV o Upstash Redis. Per app community piccola, approccio attuale accettabile con documentazione limitazione.

### SEC-07.4: Rate limiting duplicato su admin login
- **Severity**: Low
- **File**: `app/api/admin/login/route.ts:9-47`, `middleware.ts:73-97`
- **Descrizione**: Login route ha rate limiter proprio (5 tentativi/15min, blocco 30min) E coperto dal middleware (10 tentativi/15min). Due `Map` store indipendenti, soglie inconsistenti.
- **Remediation**: Rimuovere rate limiter nella route, affidarsi solo al middleware.

---

## SEC-08: Headers HTTP

### SEC-08.1: CSP con 'unsafe-inline' e 'unsafe-eval' in script-src
- **Severity**: HIGH
- **File**: `next.config.js:22`
- **CWE**: CWE-79
- **Descrizione**: `script-src 'self' 'unsafe-inline' 'unsafe-eval'` — entrambi disabilitano protezione XSS di CSP. Commento dice "in prod e ridotto" ma entrambe le direttive sono attive in produzione.
- **Impatto**: Se attacker inietta HTML, CSP non blocca esecuzione script inline o eval.
- **Remediation**:
  1. Rimuovere `'unsafe-eval'` — Next.js 14 NON lo richiede in production build
  2. Sostituire `'unsafe-inline'` con approccio nonce-based
  3. Minimo: rimuovere `'unsafe-eval'` come quick win

### SEC-08.2: CSP style-src con 'unsafe-inline'
- **Severity**: Medium
- **File**: `next.config.js:24`
- **CWE**: CWE-79
- **Descrizione**: `style-src 'self' 'unsafe-inline' fonts.googleapis.com` — permette CSS injection.
- **Remediation**: Difficile da risolvere (Leaflet + React inline styles). Accettare come rischio noto o usare nonce per stylesheet.

### SEC-08.3: CSP img-src con wildcard 'https:'
- **Severity**: Low
- **File**: `next.config.js:29`
- **CWE**: CWE-942
- **Descrizione**: `img-src` include `https:` — permette caricare immagini da qualsiasi origin HTTPS.
- **Remediation**: Proxyare immagini esterne o accettare come trade-off documentato.

### SEC-08.4: Altri header configurati correttamente
- **Severity**: Informational
- **Descrizione**: Configurati correttamente:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(self), payment=()`

---

## SEC-09: CSRF

### SEC-09.1: Cookie admin session protetto correttamente
- **Severity**: Informational
- **File**: `lib/auth.ts:96-99`
- **Descrizione**: Cookie `cmps_admin_session` con `HttpOnly; SameSite=Strict; Secure`. Protezione CSRF forte.

### SEC-09.2: Supabase Auth usa Bearer Token (no rischio CSRF)
- **Severity**: Informational
- **Descrizione**: Route mutanti utente autenticano via `Authorization: Bearer <token>` JWT. Bearer token non inviati automaticamente dal browser. CSRF non applicabile.

### SEC-09.3: Admin approve/reject via GET con HMAC token
- **Severity**: Low
- **File**: `app/api/admin/approve/route.ts:7-20`
- **CWE**: CWE-352
- **Descrizione**: Endpoint approve/reject accettano GET con HMAC token in query string (per link email). GET per operazioni state-changing viola semantica HTTP. Browser prefetching o email client pre-loading potrebbero triggerare approvazioni involontarie.
- **Remediation**: Link email puntino a pagina conferma intermedia che poi invia POST.

---

## SEC-10: Open Redirect

### SEC-10.1: Auth callback usa `origin` da request URL
- **Severity**: Low
- **File**: `app/auth/callback/route.ts:9,14,18,41,55,59`
- **CWE**: CWE-601
- **Descrizione**: `origin` estratto da `new URL(request.url)`, usato in `NextResponse.redirect(${origin}/map)`. Su Vercel, `Host` header controllato dalla piattaforma. Su setup custom proxy, potenziale redirect a sito malevolo.
- **Remediation**: Validare `origin` contro allowlist (`maps.chrispybmx.com`, `localhost:3000`) o usare base URL hardcoded da env var.

### SEC-10.2: Nessun parametro redirect controllabile dall'utente
- **Severity**: Informational
- **Descrizione**: Nessun `?redirect=`, `?next=`, `?return_to=` trovato. Tutti i redirect vanno a path hardcoded. Buona pratica.

---

## SEC-11: Dipendenze

### SEC-11.1: Next.js 14.2.5 con 17 vulnerabilita note inclusa auth bypass critica
- **Severity**: CRITICAL
- **File**: `package.json:22` (pinned a `14.2.5`)
- **CWE**: CWE-1395
- **Descrizione**: `npm audit` riporta 17 vulnerabilita. Le piu severe:
  - **GHSA-f82v-jwr5-mffw** (CVSS 9.1, Critical): **Authorization Bypass nel Middleware Next.js** — permette bypassare autorizzazione middleware. Rende TUTTO il rate limiting inefficace. Fix in 14.2.25.
  - **GHSA-gp8f-8m3g-qvj9** (CVSS 7.5, High): Cache Poisoning. Fix in 14.2.10.
  - **GHSA-7gfc-8cq8-jh5f** (CVSS 7.5, High): Authorization bypass. Fix in 14.2.15.
  - **GHSA-mwv6-3258-q52c** (CVSS 7.5, High): DoS Server Components. Fix in 14.2.34.
  - **GHSA-5j59-xgg2-r9c4** (CVSS 7.5, High): DoS Server Components. Fix in 14.2.35.
  - Multiple moderate DoS e SSRF.
- **Impatto**: Middleware auth bypass = rate limiting completamente aggirabile. DoS = crash remoto applicazione.
- **Remediation**: **Aggiornare immediatamente a `next@14.2.35`** (stessa minor, semver-compatibile): `npm install next@14.2.35`.

### SEC-11.2: PostCSS dependency vulnerability (transitiva via Next.js)
- **Severity**: Medium
- **File**: `node_modules/next/node_modules/postcss`
- **CWE**: CWE-79
- **Descrizione**: GHSA-qx2v-qp2m-jg93 — PostCSS XSS via `</style>` non escaped. Fix in postcss 8.5.10.
- **Remediation**: Risolto automaticamente aggiornando Next.js a 14.2.35.

---

## SEC-12: Logging & PII

### SEC-12.1: MailerLite error log potrebbe contenere email
- **Severity**: Medium
- **File**: `lib/mailerlite.ts:50`
- **CWE**: CWE-532
- **Descrizione**: `console.error('[MailerLite] subscribe error', res.status, txt)` — response body MailerLite tipicamente contiene email subscriber.
- **Remediation**: Rimuovere `txt` dal log o mascherare email.

### SEC-12.2: migrate-mailerlite logga errori con potenziale PII
- **Severity**: Medium
- **File**: `app/api/admin/migrate-mailerlite/route.ts:36`
- **CWE**: CWE-532
- **Descrizione**: `console.error('[migrate-mailerlite] listUsers error:', error)` — oggetto errore Supabase auth admin potrebbe contenere identificatori utente.
- **Remediation**: Loggare solo `error.message`.

### SEC-12.3: Auth callback logga exchange error
- **Severity**: Low
- **File**: `app/auth/callback/route.ts:40`
- **CWE**: CWE-532
- **Descrizione**: `console.error('[auth/callback] exchangeCodeForSession error:', exchangeError)` — potrebbe contenere token o auth code.
- **Remediation**: Loggare solo `exchangeError.message`.

### SEC-12.4: set-username logga errore completo
- **Severity**: Low
- **File**: `app/api/auth/set-username/route.ts:52`
- **CWE**: CWE-532
- **Descrizione**: Logga errore Supabase admin completo, potrebbe referenziare user ID.
- **Remediation**: Loggare solo `updateErr.message`.

### SEC-12.5: Console.log/warn client-side in produzione
- **Severity**: Low
- **File**: `hooks/useUser.ts:65,75`
- **CWE**: CWE-532
- **Descrizione**: `console.error` client-side espone dettagli errore Supabase in browser dev tools.
- **Remediation**: Wrappare in `if (process.env.NODE_ENV === 'development')`.

---

## SEC-13: Findings aggiuntivi sicurezza

### SEC-13.1: delete-photo manca check path traversal su URL
- **Severity**: Medium
- **File**: `app/api/admin/delete-photo/route.ts:16-24`
- **CWE**: CWE-22
- **Descrizione**: Estrae path storage da URL utente senza validazione path traversal. `delete-spot/route.ts` (linea 34) controlla `..` e `/` iniziale, ma questa route no.
- **Remediation**: Aggiungere stessi check: `if (!storagePath || storagePath.includes('..') || storagePath.startsWith('/')) return;`

### SEC-13.2: TypeScript build errors e ESLint ignorati
- **Severity**: Low
- **File**: `next.config.js:49-50`
- **CWE**: CWE-710
- **Descrizione**: `typescript: { ignoreBuildErrors: true }` e `eslint: { ignoreDuringBuilds: true }` — errori tipo e linting ignorati in build.
- **Remediation**: Risolvere errori tipo incrementalmente. Rimuovere override.

### SEC-13.3: SSL verification disabilitata per connessione DB
- **Severity**: Low
- **File**: `app/api/admin/run-migration/route.ts:63`
- **CWE**: CWE-295
- **Descrizione**: `ssl: { rejectUnauthorized: false }` — disabilita verifica certificato SSL per connessione PostgreSQL.
- **Remediation**: Settare `rejectUnauthorized: true` o usare connection pooler Supabase con certificati SSL.

---

# TRACCIA 2 — CONFORMITA GDPR / PRIVACY

---

## GDPR-01: Cookie Banner

### GDPR-01.1: Cookie banner assente
- **Severity**: CRITICAL
- **GDPR**: Art. 5(3) ePrivacy Directive; Garante "Linee guida cookie e altri strumenti di tracciamento" (10 giugno 2021, doc. web n. 9677876)
- **File**: `app/layout.tsx` (intero file — nessun componente cookie banner)
- **Descrizione**: Zero implementazione cookie consent. Nessun banner, nessuna gestione consenso, nessuna categoria. Pur dichiarando "Non usiamo cookie di tracciamento" su /map/about, Supabase Auth setta cookie sessione (`sb-*-auth-token`), admin panel usa `cmps_admin_session`, localStorage usato estensivamente. Service Worker scrive su CacheStorage. Sotto linee guida Garante, **cookie tecnici/necessari richiedono comunque banner informativo**.
- **Impatto**: Garante puo imporre sanzioni fino a EUR 20M / 4% fatturato per violazioni ePrivacy (Art. 83(5) GDPR). Precedente: Vueling Airlines EUR 30K (2020).
- **Remediation**:
  1. Aggiungere banner informativo: "Questo sito utilizza solo cookie tecnici necessari al funzionamento. Non utilizziamo cookie di profilazione o tracciamento." con link a cookie policy
  2. Con solo cookie tecnici/necessari, Garante permette banner semplificato (no accept/reject per cookie strettamente necessari) — ma informativa OBBLIGATORIA
  3. Se in futuro aggiunto analytics/marketing: implementare consent management completa con bottoni Accept/Reject di pari evidenza

---

## GDPR-02: Privacy Policy

### GDPR-02.1: Privacy policy totalmente inadeguata
- **Severity**: CRITICAL
- **GDPR**: Art. 13 (informazioni al momento raccolta), Art. 14
- **File**: `app/map/about/page.tsx:82-93`
- **Descrizione**: L'intera "privacy policy" consiste in 4 righe nella pagina "Chi siamo":
  > Raccogliamo solo quello che serve: nome, email e posizione GPS per gli spot inviati. Non vendiamo dati. Non usiamo cookie di tracciamento. Se ti sei iscritto alla newsletter, puoi cancellarti in qualsiasi momento...

  Mancano TUTTI gli elementi Art. 13:
  - Identita e contatti titolare trattamento
  - Finalita per ogni trattamento
  - Basi giuridiche Art. 6 per ogni trattamento
  - Periodi conservazione per ogni categoria dati
  - Destinatari/sub-processor (Supabase, Vercel, Resend, MailerLite, Nominatim)
  - Trasferimenti extra-UE e garanzie (SCC/TIA)
  - Diritti interessato Art. 15-22
  - Diritto reclamo Garante (Piazza Venezia 11, 00187 Roma)
  - Contatti DPO (o dichiarazione no DPO)
  - Decisioni automatizzate (Art. 22)
  - Se conferimento dati e obbligatorio (Art. 13(2)(e))
- **Impatto**: Art. 83(5)(b): sanzioni fino a EUR 20M / 4% fatturato. Garante multa Deliveroo EUR 2.6M (2021) per informativa inadeguata.
- **Remediation**: Creare pagina dedicata `/privacy` con informativa Art. 13 completa. Linkata da footer ogni pagina e form registrazione.

### GDPR-02.2: Nessuna pagina /privacy dedicata
- **Severity**: HIGH
- **GDPR**: Art. 12 (comunicazione trasparente)
- **File**: Nessuna directory `/app/privacy/` esistente
- **Descrizione**: Nessuna route `/privacy`. SideMenu (`components/SideMenu.tsx:151`) linka a `/map/about` con label "Privacy & Contatti" che contiene solo 4 righe.
- **Remediation**: Creare `/app/privacy/page.tsx` con informativa Art. 13 completa. Aggiornare link SideMenu.

---

## GDPR-03: Cookie Policy

### GDPR-03.1: Cookie policy assente
- **Severity**: HIGH
- **GDPR**: Art. 5(3) ePrivacy; Linee guida Garante 2021
- **Descrizione**: Nessuna cookie policy. Cookie/localStorage in uso:
  - `sb-*-auth-token` (Supabase Auth sessione) — necessario
  - `cmps_admin_session` (admin auth) — necessario
  - `cmaps_drag_hint`, `cmaps_dark_map` (preferenze UI via localStorage) — necessario
  - `cmaps_radar_enabled`, `cmaps_radar_last_check`, `cmaps_radar_last_notify` (Spot Radar via localStorage) — funzionale
  - `cmaps_un_*` (cache username via localStorage) — necessario
  - `cmaps_fav_*` (preferiti via localStorage) — funzionale
  - CacheStorage da Service Worker — necessario per PWA offline
- **Remediation**: Creare cookie policy (integrata in privacy policy o pagina separata `/cookie-policy`) con: nome, provider, finalita, tipo (tecnico/funzionale), scadenza per ogni cookie/localStorage key.

---

## GDPR-04: Newsletter MailerLite

### GDPR-04.1: Iscrizione automatica newsletter senza consenso
- **Severity**: CRITICAL
- **GDPR**: Art. 6(1)(a), Art. 7 (condizioni consenso), Rec. 32 (atto positivo chiaro), Art. 130 Codice Privacy (soft spam)
- **File**: `lib/auth-client.ts:36-41`
- **Descrizione**: Al momento della registrazione, `signUp()` iscrive automaticamente utente a MailerLite via fire-and-forget:
  ```typescript
  fetch('/api/newsletter/subscribe', {
    method: 'POST',
    body: JSON.stringify({ email, username }),
  }).catch(() => {});
  ```
  - Nessuna checkbox consenso separata per newsletter
  - Nessuna checkbox opt-in deselezionata
  - Nessuna info su contenuto newsletter
  - Consenso bundled con creazione account
  - Nessun record del consenso
  - In `lib/mailerlite.ts:35` status settato a `'active'` (bypassa double opt-in)
- **Impatto**: Violazione diretta Art. 130(1-2) Codice Privacy e Art. 7 GDPR. ENEL sanzionata EUR 26.5M (2021) per marketing non consensuale.
- **Remediation**:
  1. Aggiungere checkbox **separata, deselezionata**: "Desidero ricevere la newsletter di Chrispy Maps (facoltativo)"
  2. Chiamare `/api/newsletter/subscribe` solo se checkbox selezionata
  3. MailerLite: cambiare `status: 'active'` a `status: 'unconfirmed'` (double opt-in)
  4. Aggiungere informativa al punto raccolta: "I tuoi dati saranno trattati da MailerLite per l'invio della newsletter. Puoi disiscriverti in qualsiasi momento."
  5. Conservare record consenso (timestamp + oggetto consenso)

### GDPR-04.2: Migrazione massiva utenti a MailerLite senza consenso
- **Severity**: CRITICAL
- **GDPR**: Art. 6(1)(a), Art. 130 Codice Privacy
- **File**: `app/api/admin/migrate-mailerlite/route.ts`
- **Descrizione**: Endpoint admin mass-iscrive TUTTI gli auth.users a MailerLite senza verifica consenso. Itera tutti gli utenti Supabase e li iscrive.
- **Impatto**: Se endpoint gia eseguito, tutti gli utenti iscritti senza consenso. Violazione chiara.
- **Remediation**: Eliminare endpoint o modificare per iscrivere solo utenti con opt-in esplicito. Se gia eseguito: inviare riconferma opt-in o disiscrivere tutti.

---

## GDPR-05: Account Signup

### GDPR-05.1: Nessuna informativa privacy alla registrazione
- **Severity**: CRITICAL
- **GDPR**: Art. 13 ("al momento in cui i dati personali sono ottenuti")
- **File**: `components/AuthModal.tsx:266-268`
- **Descrizione**: Form registrazione mostra solo: "Registrandoti accetti i termini della community BMX." Manca:
  - Link a privacy policy
  - Info su trattamento dati personali
  - Disclosure basi giuridiche
  - "Termini della community BMX" linka a nulla (nessuna pagina TOS)
  - Stessa issue in AddSpotModal.tsx (linee 596-619): NESSUN testo privacy/terms
- **Impatto**: Dati raccolti senza informativa Art. 13 = trattamento illecito.
- **Remediation**: Prima del bottone "CREA ACCOUNT": "Registrandoti accetti la [Privacy Policy](/privacy). I tuoi dati (email, username) saranno trattati per la gestione del tuo account e la pubblicazione degli spot. Base giuridica: Art. 6(1)(b) GDPR."

### GDPR-05.2: Nessuna distinzione tra consenso e contratto
- **Severity**: Medium
- **GDPR**: Art. 6(1)(a) vs Art. 6(1)(b), EDPB Guidelines 2/2019 su Art. 6(1)(b)
- **File**: `components/AuthModal.tsx:266-268`
- **Descrizione**: "Registrandoti accetti i termini" mescola accettazione termini servizio (contratto Art. 6(1)(b)) con trattamenti basati su consenso (newsletter Art. 6(1)(a)). Devono essere separati.
- **Remediation**: Separare basi giuridiche. Account = contratto. Newsletter = consenso separato. Spot submission = legittimo interesse o esecuzione contratto. Geolocalizzazione = consenso.

---

## GDPR-06: User-Generated Content (Spot)

### GDPR-06.1: Nessuna policy moderazione foto per dati personali
- **Severity**: Medium
- **GDPR**: Art. 5(1)(c) (minimizzazione dati)
- **File**: `app/map/about/page.tsx:50-53`
- **Descrizione**: About page dice "Ogni spot viene revisionato personalmente da Chrispy". Moderazione manuale esiste, ma nessuna procedura documentata per: volti riconoscibili, targhe, dati personali visibili in foto. GPS + foto possono identificare residenze.
- **Remediation**:
  1. Disclaimer invio foto: "Le foto non devono contenere volti riconoscibili o targhe. Il moderatore rifiutera foto con dati personali di terzi."
  2. Checklist moderazione (anche informale)
  3. Meccanismo segnalazione takedown foto per privacy (flag esiste ma non specifico per privacy)

### GDPR-06.2: Nessun disclaimer pubblicazione per chi invia spot
- **Severity**: Medium
- **GDPR**: Art. 13(1)(e) (destinatari), Art. 13(2)(e)
- **File**: `components/AddSpotModal.tsx` (nessun disclaimer nell'intero file)
- **Descrizione**: Inviando uno spot, utente non e informato che: @username sara pubblico, coordinate GPS pubbliche, foto pubblicamente accessibili, email usata per notifiche moderazione.
- **Remediation**: Aggiungere notice nello Step 3: "Inviando questo spot, il tuo @username, le foto e la posizione GPS saranno visibili pubblicamente sulla mappa dopo approvazione. La tua email resta privata."

---

## GDPR-07: Minori

### GDPR-07.1: Nessuna verifica eta / age gate
- **Severity**: HIGH
- **GDPR**: Art. 8, Art. 2-quinquies D.lgs. 196/2003 — eta minima 14 anni in Italia
- **File**: `components/AuthModal.tsx` (form registrazione, nessun check eta), `lib/auth-client.ts:18-46` (signUp, nessuna validazione eta)
- **Descrizione**: Registrazione raccoglie email, username, password senza alcuna verifica eta. BMX/skate/scooter = sport con audience significativa di minori. In Italia eta minima consenso digitale autonomo = 14 anni.
- **Impatto**: Minori sotto 14 registrati senza consenso genitoriale = trattamento illecito. Dato target audience, scenario molto probabile.
- **Remediation**:
  1. Aggiungere campo data nascita o conferma eta
  2. Minimo: checkbox "Confermo di avere almeno 14 anni" (o meccanismo consenso genitoriale per under-14)
  3. Documentare nella privacy policy

---

## GDPR-08: Data Retention

### GDPR-08.1: Nessuna policy retention o cleanup automatico
- **Severity**: HIGH
- **GDPR**: Art. 5(1)(e) (limitazione conservazione), Art. 13(2)(a)
- **File**: `supabase/schema.sql` (nessuna logica retention/cleanup)
- **Descrizione**: Nessuna policy retention definita. Nessun cleanup automatico di: account inattivi, spot rifiutati/archiviati, contributor records, sessioni, flag report. Schema ha `created_at` ma nessun `last_login`, `last_active`, TTL. Dati conservati indefinitamente.
- **Remediation**:
  1. Definire periodi retention (es. account inattivi: 24 mesi; spot rifiutati: 6 mesi; flags: 12 mesi dopo risoluzione)
  2. Implementare cleanup schedulato (cron job o Supabase scheduled function)
  3. Documentare periodi retention in privacy policy

### GDPR-08.2: Nessuna cancellazione account utente (Art. 17)
- **Severity**: CRITICAL
- **GDPR**: Art. 17 (diritto alla cancellazione), Art. 12(3) (termine un mese)
- **File**: `app/u/[username]/ProfileClient.tsx` (profilo: edit bio/avatar ma NO elimina account), `app/api/admin/users/route.ts` (admin: sospende/elimina commenti ma NO elimina account completo)
- **Descrizione**: Nessun meccanismo per utente di eliminare il proprio account. Pagina profilo permette edit bio e Instagram handle ma nessun bottone "Elimina account". Admin panel puo solo eliminare commenti e sospendere utenti. Nessun processo documentato per gestire richieste Art. 17.
- **Remediation**:
  1. Aggiungere bottone "Elimina account" su pagina profilo
  2. Creare endpoint API che: elimina profilo, anonimizza spot inviati (o elimina su scelta utente), rimuove da MailerLite, elimina utente Supabase Auth
  3. Documentare processo, completamento entro 30 giorni
  4. Email conferma dopo eliminazione

---

## GDPR-09: DPA / Sub-Processor

### GDPR-09.1: Nessun DPA documentato con sub-processor
- **Severity**: HIGH
- **GDPR**: Art. 28 (obblighi responsabile trattamento), Art. 28(3) (contratto vincolante)
- **Descrizione**: Il progetto usa almeno 5 sub-processor:
  1. **Supabase** (Supabase Inc, USA) — account, profili, spot, foto Storage
  2. **Vercel** (Vercel Inc, USA) — hosting, processa tutte le richieste HTTP con IP
  3. **Resend** (Resend Inc, USA) — email transazionali con email utente e dati spot
  4. **MailerLite** (MailerLite Ltd, Lituania/USA) — email subscriber e nomi
  5. **Ko-fi** (Ko-fi Labs Ltd, UK) — link donazioni (Ko-fi processa dati pagamento)

  Inoltre **OpenStreetMap/Nominatim** per geocoding (potenziale forwarding IP utente).

  Nessun DPA documentato. La maggior parte offre DPA standard nelle piattaforme, ma il titolare (Christian Ceresato) deve accettarli/firmarli.
- **Remediation**:
  1. Firmare DPA con Supabase (disponibile in dashboard)
  2. Firmare DPA con Vercel (disponibile in dashboard)
  3. Firmare DPA con Resend (contattare team legale)
  4. Firmare DPA con MailerLite (disponibile in dashboard)
  5. Documentare tutti i DPA e pubblicare lista sub-processor
  6. Valutare flussi dati Nominatim/OSM

---

## GDPR-10: Data Portability (Art. 20)

### GDPR-10.1: Nessuna funzionalita export dati
- **Severity**: HIGH
- **GDPR**: Art. 20 (diritto alla portabilita)
- **Descrizione**: Nessun meccanismo per scaricare dati personali in formato strutturato, di uso comune, leggibile da dispositivo automatico. Nessun endpoint `/api/user/export`.
- **Remediation**: Creare endpoint autenticato `/api/user/export` che restituisce JSON con: dati profilo, spot inviati (con stato), foto caricate (URL), commenti, stato iscrizione newsletter, data creazione account.

---

## GDPR-11: Breach Response

### GDPR-11.1: Nessuna procedura risposta data breach
- **Severity**: HIGH
- **GDPR**: Art. 33 (notifica autorita entro 72 ore), Art. 34 (comunicazione interessato)
- **Descrizione**: Nessuna procedura documentata. Progetto conserva email, dati GPS, foto, username in Supabase (USA). Mancano: meccanismo rilevamento breach, procedura escalation, template notifica Garante, template notifica utente, registro violazioni (Art. 33(5)).
- **Remediation**: Creare piano risposta breach:
  1. Criteri rilevamento e valutazione
  2. Template notifica Garante 72h (https://servizi.gpdp.it/databreach/s/)
  3. Template notifica utente (Art. 34)
  4. Template registro violazioni
  5. Contatti team sicurezza Supabase/Vercel

---

## GDPR-12: Trasferimenti USA

### GDPR-12.1: Nessuna garanzia documentata per trasferimenti a sub-processor USA
- **Severity**: CRITICAL
- **GDPR**: Art. 44-49, Capitolo V; Schrems II (CGUE C-311/18); EDPB Recommendations 01/2020
- **Descrizione**: Almeno 3 sub-processor USA-based:
  - **Supabase** (San Francisco, CA) — ospita TUTTI i dati utente
  - **Vercel** (San Francisco, CA) — processa tutte le richieste HTTP
  - **Resend** (USA) — processa email

  Post Schrems II, trasferimenti verso USA richiedono:
  1. Certificazione EU-US Data Privacy Framework, OPPURE
  2. SCC 2021 + Transfer Impact Assessment (TIA)

  Nulla documentato. `.env.example` mostra `PROGETTO.supabase.co` senza specificare regione.
- **Impatto**: Garante italiano ha sanzionato uso Google Analytics per trasferimenti USA non conformi (giugno 2022).
- **Remediation**:
  1. Verificare se progetto Supabase ospitato in regione EU — se no, migrare
  2. Verificare certificazione EU-US DPF per ogni provider USA
  3. Firmare SCC (Decisione Commissione 2021/914) con ogni processor USA
  4. Condurre e documentare TIA per ogni trasferimento
  5. Valutare misure supplementari tecniche (encryption at rest con chiavi customer-managed)
  6. Documentare in privacy policy sotto "Trasferimenti extra-UE"

---

## GDPR-13: Geolocalizzazione

### GDPR-13.1: Informativa insufficiente per trattamento geolocalizzazione
- **Severity**: Medium
- **GDPR**: Art. 5(1)(a) (liceita, correttezza, trasparenza), Art. 13; WP29 Opinion 13/2011
- **File**: `components/AddSpotModal.tsx:682-688`, `app/map/MapClient.tsx:241-286`
- **Descrizione**: Geolocalizzazione usata in piu contesti:
  1. **Invio spot** (GPS per pin) — breve messaggio UI: "serve solo per piazzare il pin, non ti tracciamo"
  2. **Bottone "localizzami"** — nessuna informativa
  3. **Spot Radar** (check geolocalizzazione periodica in background) — solo "Avvisami quando ci sono spot vicini"
  4. **Ricerca raggio** (GPS per centro) — nessuna informativa

  Dialog permesso browser NON sufficiente come consenso GDPR. Utente deve essere informato PRIMA del dialog browser.
- **Remediation**:
  1. Per Spot Radar: "Spot Radar utilizza periodicamente la tua posizione per verificare se ci sono spot nelle vicinanze. La posizione non viene salvata ne inviata a server esterni."
  2. Privacy policy deve coprire geolocalizzazione specificamente
  3. Chiarire che dati geolocalizzazione processati client-side (se vero) e mai conservati server-side (eccetto coordinate spot submission, che SONO conservate)

---

## GDPR-14: Analytics

### GDPR-14.1: Nessun analytics di terze parti rilevato (Finding positivo)
- **Severity**: N/A (Conforme)
- **File**: `app/layout.tsx`, `next.config.js`
- **Descrizione**: Nessun GA4, Google Analytics, Plausible, Vercel Analytics o altro script tracking trovato. CSP non whitelista domini analytics. Finding POSITIVO.
- **Remediation**: Nessuna. Se analytics aggiunto in futuro: consenso prima del caricamento, DPA con provider, garanzie trasferimento, aggiornare cookie/privacy policy.

---

# CHECKLIST REMEDIATION

## Priorita Immediata (Effort S = Small, M = Medium, L = Large)

| # | Azione | Track | Effort | Severity |
|---|--------|-------|--------|----------|
| 1 | `npm install next@14.2.35` | SEC | **S** | CRITICAL |
| 2 | Fix auth in `migrate-mailerlite/route.ts` → usare `isAdminAuthenticated()` | SEC | **S** | HIGH |
| 3 | Aggiungere checkbox newsletter separata, deselezionata + double opt-in MailerLite | GDPR | **S** | CRITICAL |
| 4 | Creare pagina `/privacy` con informativa Art. 13 completa | GDPR | **M** | CRITICAL |
| 5 | Aggiungere link privacy policy + informativa pre-submit in AuthModal e AddSpotModal | GDPR | **S** | CRITICAL |
| 6 | Rimuovere `'unsafe-eval'` da CSP (quick win) | SEC | **S** | HIGH |
| 7 | Aggiungere cookie banner informativo (solo tecnici) | GDPR | **S** | CRITICAL |
| 8 | Aggiungere checkbox "Confermo di avere almeno 14 anni" alla registrazione | GDPR | **S** | HIGH |
| 9 | Fix SSRF: `redirect: 'manual'` + blocklist IP privati in resolve-gmaps | SEC | **M** | HIGH |
| 10 | Implementare "Elimina account" (endpoint + UI profilo) | GDPR | **M** | CRITICAL |

## Settimana 1-2

| # | Azione | Track | Effort |
|---|--------|-------|--------|
| 11 | Aggiungere rate limit a `/api/newsletter/subscribe` e altre POST route | SEC | **S** |
| 12 | Fix Storage DELETE policy — restringere a service role | SEC | **S** |
| 13 | Strip EXIF su foto upload (integrare `sharp`) | SEC | **M** |
| 14 | Allineare `getIp()` login con `getClientIp()` middleware | SEC | **S** |
| 15 | Aggiungere auth check admin in middleware per difesa in profondita | SEC | **M** |
| 16 | Firmare DPA con Supabase, Vercel, Resend, MailerLite | GDPR | **M** |
| 17 | Verificare/documentare garanzie trasferimento USA (SCC + TIA o DPF) | GDPR | **L** |
| 18 | Creare cookie policy | GDPR | **S** |
| 19 | Escape `</script>` in tutti i JSON-LD | SEC | **S** |
| 20 | Fix run-migration: `timingSafeEqual` + `rejectUnauthorized: true` | SEC | **S** |

## Mese 1

| # | Azione | Track | Effort |
|---|--------|-------|--------|
| 21 | Implementare endpoint export dati utente (Art. 20) | GDPR | **M** |
| 22 | Definire e implementare data retention policy + cleanup schedulato | GDPR | **L** |
| 23 | Documentare procedura breach response | GDPR | **M** |
| 24 | Aggiungere disclaimer foto e linee guida moderazione | GDPR | **S** |
| 25 | Aggiungere informativa geolocalizzazione specifica | GDPR | **S** |
| 26 | Esportare e versionare RLS policies per tabelle mancanti | SEC | **M** |
| 27 | Rimuovere console.log PII / wrappare in dev guard | SEC | **S** |
| 28 | Migrare rate limiting a Vercel KV / Upstash Redis | SEC | **L** |
| 29 | Rimuovere `ignoreBuildErrors` e `ignoreDuringBuilds` | SEC | **L** |
| 30 | Convertire approve/reject GET → pagina conferma + POST | SEC | **M** |

---

# ALLEGATO A — DPA DA FIRMARE

| Provider | Tipo | Dati trattati | DPA disponibile | Azione |
|----------|------|---------------|-----------------|--------|
| **Supabase** | Processor | Account, profili, spot, foto, sessioni | Si, dashboard Settings > Legal | Accettare in dashboard |
| **Vercel** | Processor | IP, request headers, function logs | Si, dashboard Settings > Legal | Accettare in dashboard |
| **Resend** | Processor | Email utente, contenuto email spot | Contattare team legale | Richiedere DPA via email |
| **MailerLite** | Processor | Email subscriber, username | Si, account Settings > Legal | Accettare in dashboard |
| **Ko-fi** | Controller indipendente | Dati pagamento (su piattaforma Ko-fi) | N/A (controller separato) | Verificare TOS Ko-fi, menzionare in privacy policy |
| **OpenStreetMap/Nominatim** | N/A se server-side | Potenziale IP forwarding | N/A (servizio pubblico) | Verificare flussi dati, documentare |

---

# ALLEGATO B — CONTENUTO MINIMO PRIVACY POLICY

La privacy policy deve contenere almeno:

```
INFORMATIVA SUL TRATTAMENTO DEI DATI PERSONALI
(Art. 13 Regolamento UE 2016/679 — GDPR)

1. TITOLARE DEL TRATTAMENTO
   Christian Ceresato
   Email: christian.ceresato@gmail.com (o privacy@chrispybmx.com)

2. DATI RACCOLTI E FINALITA

   | Trattamento | Dati | Base giuridica | Conservazione |
   |-------------|------|---------------|---------------|
   | Registrazione account | Email, username, password (hash) | Art. 6(1)(b) contratto | Durata account + 24 mesi inattivita |
   | Invio spot | @username, GPS, foto, descrizione | Art. 6(1)(b) contratto | Durata pubblicazione |
   | Newsletter | Email, username | Art. 6(1)(a) consenso | Fino a revoca consenso |
   | Geolocalizzazione ("vicino a me") | Coordinate GPS | Art. 6(1)(a) consenso | Non conservato server-side |
   | Spot Radar | Coordinate GPS periodiche | Art. 6(1)(a) consenso | Solo client-side |
   | Email moderazione | Email utente | Art. 6(1)(b) contratto | Durata account |
   | Cookie tecnici | Dati sessione | Art. 6(1)(f) legittimo interesse | Durata sessione |

3. DESTINATARI E SUB-RESPONSABILI
   - Supabase Inc (USA) — database, storage, autenticazione
   - Vercel Inc (USA) — hosting, CDN
   - Resend Inc (USA) — email transazionali
   - MailerLite Ltd (Lituania/USA) — newsletter
   [Per ciascuno: finalita, garanzie trasferimento extra-UE]

4. TRASFERIMENTI EXTRA-UE
   I dati sono trasferiti negli USA verso [provider]. Garanzie: [SCC 2021 / EU-US DPF].
   TIA condotta in data [data].

5. DIRITTI DELL'INTERESSATO
   Hai diritto di: accesso (Art. 15), rettifica (Art. 16), cancellazione (Art. 17),
   limitazione (Art. 18), portabilita (Art. 20), opposizione (Art. 21).
   Per esercitare: [email].
   Termine risposta: 30 giorni.

6. RECLAMO
   Diritto di reclamo al Garante per la protezione dei dati personali:
   Piazza Venezia 11, 00187 Roma — www.gpdp.it — protocollo@gpdp.it

7. MINORI
   Il servizio e riservato a utenti di almeno 14 anni (Art. 2-quinquies D.lgs. 196/2003).

8. COOKIE
   [Rimando a cookie policy o sezione dedicata con lista cookie]

Ultimo aggiornamento: [data]
```

---

*Report generato il 2026-05-06. Audit basato su analisi statica del codice sorgente.*