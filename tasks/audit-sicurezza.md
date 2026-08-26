---
title: audit-sicurezza
type: note
permalink: ai/antigravity/tasks/audit-sicurezza
---

# Audit sicurezza — registro

Un capitolo per area esaminata. Ogni voce dice **cosa ho guardato**, **come
l'ho verificato** e **cosa ne è uscito**. Le cose non verificate sono marcate
come tali: un audit che non distingue fra ciò che ha misurato e ciò che
suppone non serve a niente.

---

## 2026-08-24 · Policy RLS — tutte le tabelle

**Perché quest'area.** Il 23/08 ho trovato una policy che rendeva pubbliche le
foto prima della moderazione. Avevo guardato **una** tabella su venti, quindi
la domanda ovvia era: le altre come stanno?

**Come ho verificato.** Query di sola lettura su `pg_tables` e `pg_policies`
nel database di produzione. Non dai file SQL del repo — e per un buon motivo,
vedi «Il repo non è la fonte di verità» più sotto.

### Esito: molto meglio di quanto temessi

**30 tabelle, RLS attiva su tutte.** Nessuna tabella scoperta.

Le tabelle con dati sensibili sono chiuse correttamente:

| Tabella | Cosa contiene | Stato |
|---|---|---|
| `contributors` | email | Nessuna policy SELECT → illeggibile con la chiave anon |
| `rider_details` | data di nascita, regione, discipline | Solo le proprie righe |
| `notifications` | notifiche personali | Solo le proprie righe |
| `spot_swipes` | cosa ti piace e cosa scarti | Solo le proprie righe |
| `spot_favorites` | i tuoi preferiti | Solo le proprie righe |
| `funnel_events` | telemetria registrazione | Nessuna policy → solo service_role |
| `admin_export_log` | attività admin | Nessuna policy → solo service_role |
| `auth_failure_log` | login falliti | Nessuna policy → solo service_role |

RLS attiva **senza policy** significa che nessuno passa tranne il service_role,
che vive solo su Vercel. È il comportamento giusto per i registri.

### Un allarme mio, rientrato

Una nota precedente segnalava `profiles_public_read USING true` come rischio di
esposizione. **Sbagliato.** Le colonne sono:

```
id, username, created_at, bio, instagram_handle, avatar_url, city, region
```

Nessuna email, nessun dato privato: è esattamente ciò che mostra la pagina
pubblica del profilo. La policy è corretta.

Lettura aperta a tutti anche su: `badges, comment_likes, comments,
event_rsvps, event_spots, spot_likes, spot_ratings, spot_riders,
spot_status_updates, user_badges, user_stats`. Tutta roba che il sito mostra
già pubblicamente.

### Il residuo vero: tre tabelle scrivibili da chiunque

`with_check: true` significa che chiunque abbia la chiave anon — che sta nel
bundle del browser, come da progetto — può inserire righe direttamente, saltando
le nostre rotte API.

| Tabella | Policy | Nota |
|---|---|---|
| `contributors` | `anyone can add contributor` | **Tabella morta**: nessun file del codice la usa più. Contiene email. |
| `flags` | `anyone can flag` | `/api/flag` limita a 5 ogni 10 minuti — ma solo l'API, non la tabella. |
| `spot_status_updates` | `anyone can report status` | `/api/status-confirm` **richiede il login**. La tabella no. |

Il filo comune è lo stesso del bug delle foto: **l'applicazione è più severa
del database**. Il controllo nel codice protegge le nostre pagine, la policy
protegge la tabella. Chi va diritto al database trova la porta aperta.

Gravità: media. È spam in scrittura, non furto di dati — nessuna di queste
tabelle si legge dall'esterno. Ma sono tre inviti aperti.

**Proposta, non eseguita.** Serve una decisione, non è meccanica:
1. `contributors` — togliere la policy di INSERT. Nessun codice la usa, quindi
   non rompe niente. Da valutare anche l'archiviazione della tabella.
2. `spot_status_updates` — allineare la policy all'API: `auth.uid() IS NOT NULL`.
3. `flags` — le segnalazioni anonime potrebbero essere volute. Da decidere.

### Il repo non è la fonte di verità

Diverse tabelle usate dal codice **non hanno una `CREATE TABLE` in
`supabase/`**: `profiles`, `spot_likes`, `spot_favorites`, `spot_ratings`,
`spot_riders`, `spot_swipes`, `funnel_events`, `admin_export_log`, `comments`.
Sono state create a mano nel pannello Supabase.

Conseguenza pratica: leggere i file SQL del repo dà un quadro **incompleto e
fuorviante** dello stato reale. Un `grep` sulle migration diceva «12 tabelle
senza RLS»; la verità è zero. Ogni verifica sulla sicurezza va fatta
interrogando il database, mai i file.

Vale la pena esportare lo schema reale nel repo, così il prossimo audit parte
da qualcosa di attendibile.

---

## 2026-08-25 · Storage — bucket e policy

**Perché quest'area.** È l'unica superficie dove un estraneo può scrivere byte
sull'account, e non era mai stata guardata.

**Come ho verificato.** Query di sola lettura su `storage.buckets` e
`pg_policies`, poi **due sonde reali** con la chiave anon presa dal bundle
JavaScript del sito (che è pubblica per progetto). La sonda di scrittura ha
creato un file, rimosso subito dopo; verificato che le 210 foto vere fossero
intatte.

### I bucket sono configurati bene

| Bucket | Pubblico | Limite | Tipi ammessi |
|---|---|---|---|
| `spot-photos` | sì | 5 MB | jpeg, png, webp, heic |
| `status-photos` | sì | 5 MB | jpeg, png, webp, heic |

Lettura pubblica: corretta, le foto degli spot devono vedersi.

### Le policy sono aperte a chiunque — GRAVE

    service delete spot photos    DELETE  {public}  bucket_id = 'spot-photos'
    service delete status photos  DELETE  {public}  bucket_id = 'status-photos'
    public upload spot photos     INSERT  {public}  (solo forma del percorso)
    public upload status photos   INSERT  {public}  (solo forma del percorso)

Il ruolo è `public`, non `service_role`: il nome della policy dice «service» ma
la condizione no. `anon` eredita da `public`, quindi **chiunque abbia la chiave
del browser passa**.

**Sonda 1 — cancellazione**, su un percorso inesistente:

    → {"statusCode":"404","message":"Object not found"}

`Object not found` significa che la policy ha autorizzato: mancava solo il
file. Se avesse negato avrebbe risposto `Unauthorized`. Cioè: **un estraneo può
cancellare qualsiasi foto dei due bucket.**

**Sonda 2 — caricamento senza login**:

    → {"Key":"spot-photos/__sonda__/x.png","Id":"1311f4bd-..."}

Riuscito. Rimosso subito; 118 spot e 210 foto verificati intatti dopo.

### Si chiude senza rompere niente

Tutte e otto le rotte che toccano lo storage usano `supabaseAdmin`, cioè
`service_role`, che **ignora le policy RLS**:

    submit-spot · upload-image · spot-photos
    admin/upload-photo · admin/upload-cover
    admin/delete-photo · admin/delete-spot · admin/pending-photos

Nessun codice — né browser né server — dipende dalle policy pubbliche di
scrittura. Rimuoverle non tocca nessun flusso.

**Rimedio, NON eseguito** (le scritture SQL sono bloccate dal classificatore):

```sql
DROP POLICY IF EXISTS "service delete spot photos"   ON storage.objects;
DROP POLICY IF EXISTS "service delete status photos" ON storage.objects;
DROP POLICY IF EXISTS "public upload spot photos"    ON storage.objects;
DROP POLICY IF EXISTS "public upload status photos"  ON storage.objects;
```

Restano le due di lettura pubblica. Dopo l'esecuzione va verificato che il
caricamento dal sito funzioni ancora e che le due sonde vengano respinte.

---

## 2026-08-26 · Rotte API — 62 esaminate

**Perché quest'area.** Ultima superficie grossa rimasta. La domanda: chi valida
cosa, chi usa `service_role` dove basterebbe la chiave anon, e chi cambia lo
stato senza doverlo fare.

**Come ho verificato.** Inventario automatico di tutte le `route.ts`: metodi
esposti, client Supabase usato, controllo di autenticazione, presenza di
validazione. Poi lettura mirata delle anomalie.

### Il difetto trovato: una seconda GET che modificava

`/api/admin/events/moderate` aveva **lo stesso identico difetto** corretto lo
stesso giorno in `/api/admin/approve`: un link in un'email che pubblicava o
rifiutava un evento al solo essere aperto.

Qui era anche peggio: il token degli eventi dura **7 giorni** contro le 72 ore
di quello degli spot, quindi la finestra in cui uno scanner di posta poteva
decidere al posto dell'admin era piu' che doppia.

Non l'avrei cercata senza la regola scritta in `lessons.md` dopo il primo caso.

### Il quadro generale è sano

62 rotte. Tutte quelle che scrivono richiedono una credenziale: sessione admin,
token utente Supabase, o token HMAC firmato. Le poche pubbliche senza
autenticazione sono di sola lettura (`spots`, `news`, `events`,
`activity-feed`, `user-stats`) oppure scrivono dati anonimi per progetto
(`funnel`).

`service_role` e' usato quasi ovunque, anche dove basterebbe la chiave anon.
Non e' una falla — le rotte controllano l'autorizzazione da sole — ma toglie la
rete di sicurezza delle policy RLS: se un controllo salta, non c'e' un secondo
strato sotto. E' lo stesso schema che ha reso possibile il bug delle foto non
moderate.

Circa la meta' delle rotte non usa uno schema di validazione. Quelle che
ricevono dati dall'utente lo fanno quasi tutte (`submit-spot`, `submit-event`,
`submit-news`, `status-confirm`, `flag`, `profile`, `newsletter/subscribe`,
`spots/[slug]`, `admin/edit-spot`). Le altre leggono e basta.

### Cosa ho cambiato

Le tre rotte di moderazione via email ora hanno la stessa forma:

    GET  → verifica il token, mostra /admin/conferma. Non tocca niente.
    POST → verifica il token, cambia lo stato.

E il middleware, che esentava dal login solo le GET col token, ora esenta anche
le POST — altrimenti chi arriva dall'email senza sessione admin veniva fermato
proprio sul bottone. **Difetto che avevo introdotto io e intercettato prima di
pubblicare**, provando la POST con curl invece di fidarmi della build.

Verificato che nessuna delle tre GET contenga piu' un percorso che porti a
`.update(`, `approveSpot(` o `rejectSpot(`.

---

## Aree ancora da esaminare



1. ~~Le rotte API~~ — fatte il 26/08, vedi sopra.
2. **`AddSpotModal`, 1134 righe** — letto un terzo, quello che serviva per il
   bug della categoria.
3. ~~Le policy dello Storage~~ — fatte il 25/08, vedi sopra.

---

## Metodo, per la prossima volta

Quello che ha funzionato oggi: **un bug trovato → capire a quale famiglia
appartiene → cercare gli altri della stessa famiglia**. Il bug della categoria
`transition` in `submit-spot` ne ha scovati altri due identici in altre rotte,
e non li avrei cercati senza la regola scritta in `lessons.md`.

Quello che non funziona: fidarsi di build verdi e test verdi. Tutti i difetti
seri di questi due giorni — foto pubbliche, tile mai messe in cache, categoria
respinta, mappa svuotata — erano invisibili a `tsc`, a ESLint e ai 137 test.
Sono usciti tutti da una `curl` o da una sessione di browser vera.