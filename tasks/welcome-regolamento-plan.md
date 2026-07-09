---
title: welcome-regolamento-plan
type: note
permalink: ai/antigravity/tasks/welcome-regolamento-plan
---

# Piano — Email Benvenuto + Regolamento per ogni iscritto (maps.chrispybmx.com)

Obiettivo: ogni nuovo registrato sul sito maps entra nel gruppo MailerLite **"ChrispyMPS — Spot Submission"** (185532080718873760) e riceve un'email automatica **benvenuto + regolamento d'uso mappa**. Chi spunta il consenso → anche gruppo **"Newsletter BMX Settimanale"** (186569732865918849).

Stato pattern (gia provato in sessione): email MailerLite custom-HTML via dashboard Chrome, entita HTML per non-ASCII, paste `pbcopy`+`cmd+v`, tag `{$unsubscribe}` obbligatorio, poi Activate. Automazione "Welcome — Newsletter Settimanale" gia LIVE.

NOTA path: il progetto e in `/Users/christianceresato/Documents/ai/antigravity` (senza spazio — rinominato; prima era `ai ` con spazio).

---

## Fase 0 — Fatti accertati (gia verificati)

- **Endpoint** `app/api/newsletter/subscribe/route.ts`: accetta `{ email, username, source, alsoNewsletter }`. `source:'submit-spot'` → gruppo Spot Submission; `alsoNewsletter:true` → aggiunge anche gruppo Newsletter. Default source = 'submit-spot'. CORS per chrispybmx.com. Rate limit 3/10min per IP (middleware) — ok per signup.
- **Mapping gruppi** `lib/mailerlite.ts` GROUP_BY_SOURCE: submit-spot=185532080718873760, newsletter=186569732865918849, signup=188059390435132622 (Account Chrispy Maps).
- **signUp email/password** `lib/auth-client.ts` — GIA MODIFICATO: ora ogni signup → POST subscribe con `source:'submit-spot'` + `alsoNewsletter:!!opts.newsletter`. Coperti i 2 entry point: `components/AuthModal.tsx` (checkbox newsletter L266) e `components/AddSpotModal.tsx` (newsletterOptIn2 L659, signUp L495).
- **GAP OAuth Google**: `app/auth/callback/route.ts` → nuovo utente Google va a `/auth/setup-username` (NON passa da signUp). Quindi i signup Google NON entrano in MailerLite. Da coprire in setup-username.
- **Automazioni MailerLite**: esiste draft "Welcome — Account Chrispy Maps" (188060189260252397, gruppo sbagliato). NON esiste automazione sul gruppo Spot Submission → va creata o retargettata.

---

## Fase 1 — Coprire i signup Google (codice)

**Cosa**: aggiungere la chiamata MailerLite quando un nuovo utente Google completa lo username in `app/auth/setup-username/page.tsx` (li avviene l'insert del profilo per gli OAuth). Replicare ESATTAMENTE il pattern di `lib/auth-client.ts:43-52` (post a `/api/newsletter/subscribe`, source 'submit-spot', alsoNewsletter da checkbox o false).

1. Leggere `app/auth/setup-username/page.tsx` — trovare dove fa l'insert in `profiles` dopo scelta username.
2. Dopo insert profilo riuscito, aggiungere (copiare da auth-client.ts):
   ```ts
   fetch('/api/newsletter/subscribe', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ email, username, source: 'submit-spot', alsoNewsletter: false }),
   }).catch(() => {});
   ```
   (email = `data.session.user.email` / dalla sessione Supabase; newsletter opt-in per Google: default false, oppure aggiungere checkbox in setup-username se voluto.)

**Verifica**: `grep -n "submit-spot" app/auth/setup-username/page.tsx` → presente. Registrarsi con Google in test → l'email appare in MailerLite gruppo Spot Submission (`curl .../api/subscribers/<email>`).
**Anti-pattern**: NON inventare un nuovo endpoint; riusare `/api/newsletter/subscribe`. NON aggiungere a gruppo Newsletter senza consenso.

---

## Fase 2 — Email benvenuto + regolamento (contenuto)

**Cosa**: creare `static-landing/email/welcome-regolamento-maps.html` copiando struttura/stile da `static-landing/email/welcome-newsletter.html` (gia esistente, email-safe, dark/arancione, entita HTML per emoji/accenti, `{$unsubscribe}`).

Contenuto:
- Header band + "Benvenuto su Chrispy Maps 🗺️"
- Intro: account creato, cos'e Chrispy Maps (mappa community spot BMX Italia).
- **REGOLAMENTO** (sezione, le regole d'uso):
  1. Aggiungi solo spot reali e accessibili pubblicamente.
  2. NIENTE spot privati, pericolosi o vietati.
  3. Foto adeguate e veritiere dello spot.
  4. Rispetto: niente spam, insulti, contenuti offensivi.
  5. Info corrette (tipo spot, difficolta, posizione).
  6. Chi viola → rimozione contributi / ban.
- CTA: "Apri la mappa" (maps.chrispybmx.com/map) + "Aggiungi il tuo primo spot".
- Footer GDPR: `{$unsubscribe}`, Privacy iubenda 84160410, Cookie, Contatti.

**Verifica**: `grep -c "[^ -~]" file` = 0 (puro ASCII via entita). Anteprima render in MailerLite ok.
**Anti-pattern**: NON usare emoji/accenti raw (rompe UTF-8 nel paste) — solo entita `&#x...;`/`&egrave;` ecc.

---

## Fase 3 — Automazione MailerLite (dashboard Chrome)

**Cosa**: automazione attiva su trigger "joins group Spot Submission" → manda l'email Fase 2.

Decisione: **creare nuova automazione** "Welcome — Spot Submission / Regolamento" (il draft "Account Chrispy Maps" e su gruppo diverso; piu pulito crearne una sul gruppo giusto). Se la UI rende difficile, in alternativa retargettare il draft esistente cambiando il gruppo trigger a Spot Submission.

Passi (richiede Chrome connesso + login MailerLite gia fatto):
1. Automations → New automation → trigger "When subscriber joins a group" → gruppo "ChrispyMPS — Spot Submission".
2. Add step → Email. Oggetto: "Benvenuto su Chrispy Maps + regolamento". From: Christian / christian@chrispybmx.com.
3. Design email → "Code from scratch" → `pbcopy < welcome-regolamento-maps.html` → click editor → `cmd+v` → Done editing → Save.
4. Verifica green check (no warning unsubscribe). Activate → "No, only add new subscribers".

**Verifica**: automazione stato Active; test reale = registrazione test sul sito → email arriva in inbox + subscriber in Spot Submission; poi pulizia subscriber test.
**Anti-pattern**: NON riaprire l'editor custom-HTML dopo paste (mostra chooser vuoto, contenuto perso) — paste+Done in un colpo. Account MailerLite deve NON essere "under review" (blocca invio).

---

## Fase 4 — GDPR / Privacy

**Cosa**: ogni email account ora entra in MailerLite (gruppo Spot Submission) anche senza consenso newsletter → la privacy policy DEVE dichiararlo.
1. Pannello iubenda (policy 84160410, login utente) → aggiungere: dati account (email, username) trattati anche tramite MailerLite per comunicazioni di servizio (benvenuto/regolamento) relative all'account Chrispy Maps; newsletter solo con consenso.
2. Verificare che la registrazione mostri il riferimento privacy (checkbox/nota in AuthModal e AddSpotModal).

**Verifica**: testo privacy iubenda cita MailerLite + account. (Manuale, fatto dall'utente nel pannello iubenda.)
**Nota legale**: il benvenuto+regolamento e messaggio di servizio (lecito). Evitare blast marketing al gruppo Spot Submission verso non-consenzienti — quello richiede consenso (= gruppo Newsletter).

---

## Fase 5 — Verifica finale end-to-end

1. `grep -rn "source: 'submit-spot'" lib/auth-client.ts app/auth/setup-username/page.tsx` → entrambi presenti.
2. Registrazione test email/password (senza spunta newsletter) → subscriber SOLO in Spot Submission; email benvenuto+regolamento ricevuta.
3. Registrazione test con spunta newsletter → subscriber in Spot Submission + Newsletter; riceve benvenuto-regolamento (Spot) e benvenuto newsletter (gia live) — valutare se doppia email e accettabile o dedup.
4. Signup Google test → subscriber in Spot Submission + email ricevuta.
5. Pulire tutti i subscriber di test via API MailerLite (DELETE).

**Rischio noto da decidere**: chi opt-in newsletter riceve 2 email benvenuto (una da automazione Spot, una da automazione Newsletter). Opzioni: (a) accettare; (b) escludere gruppo Newsletter dal trigger Spot; (c) un solo benvenuto unificato.