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

## Aree ancora da esaminare

1. **Le ~30 rotte API** — chi valida cosa, chi usa `service_role` dove basterebbe
   la chiave anon, chi espone messaggi del database al client.
2. **`AddSpotModal`, 1134 righe** — letto un terzo, quello che serviva per il
   bug della categoria.
3. **Le policy dello Storage** — chi può caricare file nel bucket, con che
   limiti di dimensione e tipo. Mai guardate.

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