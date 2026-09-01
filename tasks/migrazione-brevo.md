# Migrazione newsletter MailerLite -> Brevo

Obiettivo: azzerare i **23,18 EUR/mese** di MailerLite (278 EUR/anno per 72 iscritti)
senza perdere iscrizioni ne' automazioni. Brevo ha l'editor HTML custom nel piano free.

**Il motivo e' il costo, non la privacy.** Una versione precedente di questa nota
diceva che Brevo elimina un trasferimento extra-UE: e' falso. `app/privacy/page.tsx`
sezione 3 dichiara **MailerLite UAB, Lituania** — gia' dentro l'Unione. Sendinblue
SAS (Francia) e' lo stesso identico quadro giuridico. I trasferimenti USA della
sezione 4 sono Supabase, Vercel e Resend, e restano dove sono.

## Inventario reale (letto via API MailerLite, 1 set 2026)

72 iscritti unici, 8 gruppi, 4 automazioni attive (3 spente), 2 form embedded,
13 campagne inviate (Ed#1 del 4 mag → Ed#9 del 27 lug), nessun campo personalizzato.

| id gruppo | iscritti | nome |
|---|---|---|
| 185532080718873760 | 42 | ChrispyMPS — Spot Submission |
| 186569652817627119 | 32 | *(misto, artefatto di import)* Spot Submission, Coaching Call, Corsi, Prima BMX |
| 183113810495669979 | 15 | Prima BMX |
| 186569732865918849 | 13 | Newsletter BMX Settimanale |
| 185103332169221824 | 5 | gopro 12 |
| 183283872475121373 | 2 | Iscrizione Corsi BMX |
| 188059390435132622 | 2 | Account Chrispy Maps |
| 183283931785725929 | 1 | Coaching Call |

| automazione attiva | trigger | consegne | aperture | click |
|---|---|---|---|---|
| Welcome — Newsletter Settimanale | entra in gruppo `1865697328…` | 10 | 60% | **0%** |
| Welcome — Account Chrispy Maps | entra in gruppo `1855320807…` (Spot Submission) | 8 | 37,5% | **0%** |
| Benvenuto Prima BMX | form «Guida Gratuita Prima BMX» | 7 | 85,7% | 14,3% |
| Copy of Benvenuto Prima BMX | form «gopro preset» | 4 | 100% | 50% |

Due cose che l'inventario ha reso evidenti:

1. **Le due welcome hanno 0% click su 18 invii**, mentre un'altra automazione
   sullo stesso account segna 50%. Il tracking funziona: aprono e non cliccano.
   Copiarle identiche su Brevo si porta dietro il problema.
2. **Il nome del gruppo da 32 e' quattro nomi concatenati.** Viene da un import
   andato storto. Quasi meta' della lista sta in un contenitore che non dice
   niente: all'import in Brevo va sciolto, non replicato.

Nota per chi legge fra sei mesi: la seconda automazione si chiama «Account
Chrispy Maps» ma il suo trigger e' il gruppo **Spot Submission**, non il gruppo
omonimo. E' corretto — `lib/auth-client.ts` iscrive i nuovi account a
`submit-spot`. Il gruppo «Account Chrispy Maps» (2 iscritti) non ha automazioni,
e `source:'signup'` punta li: se qualcuno un giorno «sistema» quella riga in
`lib/mailerlite.ts:26`, il benvenuto si spegne in silenzio.

Piano completo: `~/.claude/plans/parallel-giggling-nebula.md`

## Principio della migrazione

Il provider si sceglie da **env**, non da codice: `NEWSLETTER_PROVIDER`.
Nessun deploy serve per tornare indietro. Finche' la variabile e' vuota e
`MAILERLITE_API_KEY` c'e', il comportamento e' identico a prima.

    mailerlite   stato attuale (default)
    both         MailerLite decide l'esito, Brevo riceve copia di ogni iscritto
    brevo        cutover completato

## Fatto (codice)

- [x] `lib/brevo.ts` — API v3, single opt-in + double opt-in, `updateEnabled:true`
      (senza, una re-iscrizione risponde 4xx invece di aggiornare), niente PII nei log
- [x] `lib/newsletter.ts` — facade che instrada sul provider, con modalita' `both`
- [x] Chiamanti ripuntati sulla facade: `app/api/newsletter/subscribe/route.ts`,
      `app/api/rider/details/route.ts`, `app/api/admin/migrate-mailerlite/route.ts`
- [x] `.env.example` — `NEWSLETTER_PROVIDER` + blocco `BREVO_*`
- [x] `__tests__/newsletter.test.ts` — 10 test. Suite intera: 160/160 verdi, build OK

Nota: `migrate-mailerlite/route.ts` **non e' stato cancellato**. L'audit lo segnava
HIGH per auth rotta, ma usa gia' `isAdminAuthenticated()`: quel punto dell'audit e'
vecchio. Ripuntato sulla facade, serve a popolare Brevo in massa (Fase 4).

## Da fare — dashboard e DNS (richiede te)

- [ ] **Fase 0 — verifica prima di procedere**
  - [ ] Account Brevo free; confermare che l'editor **HTML custom** c'e' nel free
  - [ ] Incollare `bmx-intel/newsletter/newsletter-2026-06-15-v2.html`, test a se stessi,
        controllare resa su Gmail web, Gmail app, Apple Mail
  - [ ] Verificare che MailerLite non abbia spostato l'HTML custom su un piano piu'
        economico del tuo -> **se si', downgrade e la migrazione si ferma qui**
  - [ ] 300 email/giorno del free: 42 iscritti stanno larghi, ma contano anche i DOI

- [ ] **Fase 1 — dominio**
  - [ ] DKIM Brevo su `chrispybmx.com` (DNS Hostinger)
  - [ ] SPF: **estendere** il record esistente che serve Resend, non sostituirlo.
        Due `v=spf1` sullo stesso dominio li rompono entrambi.
  - [ ] Sender `christian@chrispybmx.com`, from_name `Christian — Chrispy BMX`
        (RULES #29: identita' fissa per la reputazione Gmail)

- [ ] **Fase 2 — liste e template**
  - [ ] Creare **tutte e 8** le liste; annotare gli id numerici. Il codice ne legge
        solo 3 da env (`BREVO_LIST_NEWSLETTER`, `BREVO_LIST_SIGNUP`,
        `BREVO_LIST_SUBMIT_SPOT`): le altre 5 non sono scritte dal sito, servono a
        non perdere i contatti
  - [ ] **Il gruppo misto da 32 non si ricrea**: quei contatti vanno smistati
        nelle liste vere durante l'import (il CSV MailerLite riporta i gruppi)
  - [ ] Ricostruire i 2 form embedded su WordPress («Guida Gratuita Prima BMX»,
        «gopro preset») puntandoli a Brevo. Finche' non stacchi i vecchi, quelli
        MailerLite continuano a funzionare: non c'e' finestra scoperta
  - [ ] Template DOI; annotare l'id
  - [ ] Copie Brevo di `static-landing/email/welcome-newsletter.html` e
        `welcome-regolamento-maps.html` con `{$unsubscribe}` -> `{{ unsubscribe }}`.
        **Non modificare gli originali**: sono in produzione su MailerLite finche' non stacchi.
        Brevo blocca il salvataggio se il tag manca. RULES #30 vale uguale: il link
        va dentro l'ultima `<td>`, mai fuori dalla table.
  - [ ] Ricreare **tutte e 4** le automazioni attive (vedi tabella nell'inventario).
        Le 3 spente — `Simple welcome email`, `gopro 12`, `Online course` — non si
        migrano
  - [ ] **Le due welcome NON si copiano identiche**: 0% click su 18 invii. Vanno
        riscritte mentre le ricrei, e' lo stesso lavoro fatto una volta sola

- [ ] **Fase 3 — parallelo (2-3 settimane)**
  - [ ] Su Vercel: `BREVO_API_KEY`, i 3 `BREVO_LIST_*`, `NEWSLETTER_PROVIDER=both`
  - [ ] Lasciare `BREVO_DOI_TEMPLATE_ID` **vuoto** durante il parallelo: col DOI acceso
        ogni iscritto riceverebbe sia la welcome MailerLite sia la conferma Brevo
  - [ ] Export CSV da MailerLite -> import in Brevo. Chi non ha mai confermato non va
        importato come confermato.
  - [ ] Verificare che i nuovi iscritti arrivino in entrambi

- [ ] **Fase 4 — cutover**
  - [ ] Inviare un'edizione vera da Brevo; confrontare consegna e aperture con lo storico
  - [ ] `NEWSLETTER_PROVIDER=brevo`
  - [ ] Accendere `BREVO_DOI_TEMPLATE_ID` (double opt-in, chiude GDPR-04.1)
  - [ ] **Prima di accendere il DOI**: cambiare il testo di `/newsletter-grazie` (WP 181).
        Oggi dice "sei iscritto", ma col DOI l'iscrizione non e' ancora confermata a
        quel punto — deve dire di controllare la mail e confermare.
  - [ ] Disdire MailerLite; rimuovere `MAILERLITE_*` da Vercel e `lib/mailerlite.ts`

- [ ] **Fase 5 — privacy e documenti**
  - [x] *(1 set)* `app/privacy/page.tsx` sezione 3: aggiunti i tre sub-responsabili
        che il sito caricava senza dichiararli — **CARTO** (basemaps.cartocdn.com,
        vede l'IP e l'area inquadrata di ogni visitatore della mappa), **unpkg**
        (icone dei segnaposto), **YouTube** (video nelle news). Esteso il punto
        OpenStreetMap: non fa solo geocoding Nominatim, serve anche le tile
  - [x] *(1 set)* embed YouTube spostati su `youtube-nocookie.com` in
        `app/news/[slug]/page.tsx` e `app/map/spot/[slug]/page.tsx`. La CSP in
        `middleware.ts:41` gia' lo permetteva
  - [ ] Al cutover: sostituire MailerLite con Brevo **in due punti** di
        `app/privacy/page.tsx` — la sezione 3 e la riga «Comunicazioni di
        servizio» in `dataRows`, che oggi dice «tramite MailerLite»
  - [ ] iubenda **84160410**: MailerLite -> Brevo (Sendinblue SAS, Francia) nei sub-processor
  - [ ] Aggiungere **maps.chrispybmx.com** agli scan iubenda: oggi controlla solo
        `chrispybmx.com`, e il sito che raccoglie di piu' non e' nemmeno in lista
  - [ ] Firmare il DPA Brevo dalla dashboard
  - [ ] Aggiornare `README.md`, `SECURITY_PRIVACY_AUDIT.md`,
        `ChrispyBMX/.claude/skills/newsletter-weekly/SKILL.md:422` (`MAILERLITE_API_KEY`),
        `ChrispyBMX/automazione/newsletter-lunedi.sh`
  - [ ] `bmx-intel/newsletter/RULES.md`: le regole #12, #13, #27, #29, #30, #32, #36 sono
        lezioni sui difetti di MailerLite. Riscriverle sui difetti di Brevo man mano che
        emergono — **questo e' il costo vero della migrazione, non il codice**

## Verifica end-to-end (dopo Fase 3)

    npm test && npm run build
    curl -X POST http://localhost:3000/api/newsletter/subscribe \
      -H 'Content-Type: application/json' \
      -d '{"email":"test@example.com","username":"test","source":"newsletter"}'

- [ ] Iscrizione reale dal form su chrispybmx.com/newsletter: CORS ok, contatto in lista
- [ ] Col DOI attivo: arriva la mail di conferma, il click porta a /newsletter-grazie,
      il contatto passa a confermato
- [ ] Signup sul sito maps -> lista Spot Submission, automazione welcome parte
- [ ] Link di disiscrizione funzionante e in fondo alla mail
- [ ] Il transazionale Resend continua a funzionare (SPF non rotto)

## Fuori scope

- Spostare il transazionale da Resend a Brevo: da valutare quando accendi il
  funnel bike-check da 19 EUR
- Gap OAuth Google (i signup Google non entrano in lista) — vedi
  `tasks/welcome-regolamento-plan.md`, bug preesistente
