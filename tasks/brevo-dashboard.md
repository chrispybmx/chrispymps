# Brevo — sequenza operativa dashboard

Compagno di `tasks/migrazione-brevo.md`, che spiega il perche'. Qui c'e' solo l'ordine
dei click, con i valori esatti da incollare. L'ordine conta: le liste prima dei form,
i template prima delle automazioni, il dominio prima di qualsiasi invio.

Man mano che crei le liste **annota gli id numerici nella tabella qui sotto**: tre
finiscono in env su Vercel, e senza quelli il sito scrive nel vuoto.

---

## 1 — Account e mittente

- [ ] Account Brevo **free** su `christian@chrispybmx.com`
- [ ] Senders > sender `christian@chrispybmx.com`, from_name **`Christian — Chrispy BMX`**
      (RULES #29: identita' fissa, la reputazione Gmail si costruisce sul mittente)
- [ ] Firma il **DPA** da Account > Privacy. Serve per iubenda, non e' burocrazia:
      senza, Brevo non e' un responsabile del trattamento dichiarabile.
- [ ] SMTP & API > API Keys > crea una chiave. **Non incollarla in chat, in un file
      del repo o in `settings.local.json`** — va solo in Vercel e in `.env.local`.

## 2 — DNS (Hostinger)

- [ ] **DKIM**: copia i record che ti da' Brevo in Senders > Domains. Sono suoi, cambiano
      per account, non li posso scrivere qui.
- [ ] **SPF** — il dominio ne ha gia' uno. **Sostituisci il TXT di root con questo**,
      che e' l'attuale piu' `spf.brevo.com`:

      v=spf1 +a +mx include:_spf.mlsend.com include:spf.brevo.com include:chrispybmx.com.spf.auto.dnssmarthost.net ~all

  - Un solo record `v=spf1` sul dominio. Due li rompono entrambi.
  - `_spf.mlsend.com` e' MailerLite: **resta finche' non fai il cutover**, esce dopo.
  - `dnssmarthost` e' la webmail SiteGround: non toglierlo mai.
  - Il transazionale **Resend non e' in questo record** — manda da
    `send.chrispybmx.com`, che ha un SPF suo. Toccando il root non lo rompi, ma
    controlla comunque che le mail di sistema partano ancora (vedi Verifica).
  - Lookup DNS dopo la modifica: 6 su 10. C'e' margine.
- [ ] Aspetta che Brevo segni il dominio **autenticato** prima di mandare qualsiasi cosa.

## 3 — Liste

Creale **tutte e otto**, anche quelle che il sito non scrive: servono a non perdere
contatti. Nomi puliti — il gruppo artefatto **non si ricrea**.

| # | Nome lista in Brevo | da MailerLite | iscritti | id Brevo | env |
|---|---|---|---|---|---|
| 1 | `Newsletter BMX Settimanale` | omonimo | 13 | `_______` | `BREVO_LIST_NEWSLETTER` |
| 2 | `Account Chrispy Maps` | omonimo | 2 | `_______` | `BREVO_LIST_SIGNUP` |
| 3 | `Spot Submission` | ChrispyMPS — Spot Submission | 42 | `_______` | `BREVO_LIST_SUBMIT_SPOT` |
| 4 | `Prima BMX` | omonimo | 15 | `_______` | — |
| 5 | `GoPro 12` | gopro 12 | 5 | `_______` | — |
| 6 | `Iscrizione Corsi BMX` | omonimo | 2 | `_______` | — |
| 7 | `Coaching Call` | omonimo | 1 | `_______` | — |
| 8 | `Residuo import 2026` | *(l'artefatto sciolto)* | ~? | `_______` | — |

La #8 **non e' una lista di invio**: e' dove finisce chi su MailerLite stava solo nel
gruppo dal nome concatenato e non ha una casa vera. Va guardata a mano prima di
scriverle. Non mandarci campagne.

- [ ] Attributi contatto: crea `NOME` e `INSTAGRAM` (testo). Sono i nomi che scrive
      `lib/brevo.ts`; se li chiami diversamente, i contatti dal sito arrivano senza nome.

## 4 — Import contatti

- [ ] MailerLite > esporta i contatti in CSV. Se puoi, esporta **un gruppo per volta**:
      la colonna gruppi unica e' ambigua e il gruppo artefatto ha le virgole nel nome.
- [ ] Passa il CSV allo script, che smista e scarta chi non e' attivo:

      node scripts/brevo-import.mjs ~/Downloads/export.csv --out tmp/brevo-import

  Un file per gruppo (`--group` dice a quale gruppo appartiene tutto il file):

      node scripts/brevo-import.mjs ~/Downloads/prima-bmx.csv --group "Prima BMX" --out tmp/brevo-import

- [ ] Leggi il report che stampa: quanti sciolti dall'artefatto, quanti esclusi e perche'.
- [ ] Brevo > Contacts > Import, **un file per lista**, sulle liste create al punto 3.
      Se importi senza aver creato la lista, Brevo ne inventa una col nome del file.
- [ ] `_esclusi.csv` **non si importa**. Sono unsubscribed, unconfirmed e bounced:
      rimetterli dentro come confermati e' il modo piu' veloce per bruciare la
      reputazione di un mittente nuovo, che parte gia' senza storico.

## 5 — Template

- [ ] `static-landing/email/welcome-newsletter-v2.html` → template `Welcome newsletter`
- [ ] `static-landing/email/welcome-regolamento-maps-v2.html` → template `Welcome account Maps`
- [ ] `static-landing/email/doi-conferma.html` → template `Conferma iscrizione (DOI)`,
      **annota l'id**: e' `BREVO_DOI_TEMPLATE_ID`

Trappole, tutte imparate su MailerLite e probabilmente valide anche qui:
- Incolla via clipboard (`pbcopy < file`, poi cmd+v), non a mano
- I due `*-v2` hanno gia' `{{ unsubscribe }}` dentro l'ultima `<td>`. Se lo sposti
  fuori dalla table, sui client mobile il link esce dal riquadro (RULES #30)
- Brevo blocca il salvataggio di una campagna senza tag di disiscrizione
- Il DOI usa `{{ doubleOptInUrl }}`, **non** `{{ unsubscribe }}`: li' il contatto non
  e' ancora in lista, non c'e' niente da cui disiscriversi
- Manda un test a te stesso e guardalo su **Gmail web, Gmail app e Apple Mail** prima
  di dire che e' fatto. Sul free c'e' il logo Brevo in fondo: e' atteso, non e' un errore
- **Non toccare gli originali** `welcome-newsletter.html` e `welcome-regolamento-maps.html`:
  sono in produzione su MailerLite finche' non stacchi

## 6 — Automazioni

Ricrea **tutte e quattro** le attive. Le tre spente (`Simple welcome email`, `gopro 12`,
`Online course`) non si migrano.

| Automazione | Trigger: entra in lista | Manda |
|---|---|---|
| Welcome — Newsletter Settimanale | `Newsletter BMX Settimanale` | template `Welcome newsletter` |
| Welcome — Account Chrispy Maps | **`Spot Submission`** | template `Welcome account Maps` |
| Benvenuto Prima BMX | `Prima BMX` | (ricrea dal contenuto MailerLite) |
| Benvenuto GoPro preset | `GoPro 12` | (ricrea dal contenuto MailerLite) |

- [ ] **Il trigger della seconda e' `Spot Submission`, non l'omonima `Account Chrispy
      Maps`.** Sembra un errore e non lo e': `lib/auth-client.ts` iscrive i nuovi account
      a `submit-spot`. Se lo "sistemi" puntandolo alla lista omonima, il benvenuto si
      spegne in silenzio e non se ne accorge nessuno.
- [ ] Le due welcome sono gia' riscritte (le v1 facevano 0% click su 18 invii). Usa i
      `*-v2`, non ricopiare le vecchie.

## 7 — Form WordPress

- [ ] Ricostruisci i due form embedded puntandoli a Brevo:
      «Guida Gratuita Prima BMX» e «gopro preset»
- [ ] I vecchi form MailerLite **restano attivi** finche' non stacchi: nessuna finestra
      scoperta, chi si iscrive nel frattempo non si perde.

Il form principale `/newsletter` (WP 175) **non si tocca**: non parla con MailerLite,
posta su `maps.chrispybmx.com/api/newsletter/subscribe`, ed e' il codice a scegliere
il provider. Vedi [newsletter-landing](../../ChrispyBMX) e `tasks/migrazione-brevo.md`.

## 8 — Vercel

- [ ] `BREVO_API_KEY`
- [ ] `BREVO_LIST_NEWSLETTER`, `BREVO_LIST_SIGNUP`, `BREVO_LIST_SUBMIT_SPOT` (dal punto 3)
- [ ] `BREVO_DOI_TEMPLATE_ID` → **lascia vuoto**. Col DOI acceso durante il parallelo
      ogni iscritto riceve sia la welcome MailerLite sia la conferma Brevo.
- [ ] `NEWSLETTER_PROVIDER=both` → MailerLite resta la fonte di verita', Brevo riceve
      copia di ogni nuovo iscritto. **Per tornare indietro basta rimettere `mailerlite`:
      nessun deploy di codice.**

## Verifica prima del cutover

- [ ] Iscrizione vera dal form su `chrispybmx.com/newsletter` → il contatto compare in
      **entrambi** i provider
- [ ] Signup su `maps.chrispybmx.com` → lista `Spot Submission`, welcome parte
- [ ] Il transazionale Resend funziona ancora (reset password, notifiche spot):
      e' la prova che l'SPF di root non ha rotto niente
- [ ] Manda **un'edizione vera** da Brevo e confronta consegna e aperture con lo storico
      MailerLite. Se crollano, il problema e' il dominio nuovo agli occhi di Gmail:
      aspetta e manda ancora, non spostare la lista

Solo dopo: `NEWSLETTER_PROVIDER=brevo`, poi il DOI, poi la disdetta.
La coda (privacy, iubenda, doc, RULES) sta in `tasks/migrazione-brevo.md` Fase 5.
