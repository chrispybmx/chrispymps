# La regola che non si rompe

**Un rider deve sempre poter aggiungere uno spot.**

Tutto il resto del sito è migliorabile, sostituibile, rifacibile. Quello no.
È l'unica cosa che rende Chrispy Maps una mappa della community invece di una
mappa di Christian.

---

## Perché serve scriverla

Il 19 agosto 2026 è stata aggiunta la categoria `transition` al selettore, ma
non all'elenco che il server accetta. Per **cinque giorni** la prima casella
del selettore rispondeva «Dati non validi. Controlla tutti i campi» a ogni
invio — con le foto già caricate nello storage e un messaggio che non diceva
quale campo fosse sbagliato.

In quei cinque giorni:

```
tsc      pulito
ESLint   pulito
test     122 verdi
build    verde
```

**Nessun controllo statico può vedere quel bug.** Le due liste erano entrambe
TypeScript valido, semplicemente diverse. Serviva una richiesta vera a un
server vero.

Lo stesso è successo il 24 agosto con la colonna `ostacoli`: aggiunta a una
query prima che esistesse nel database, la mappa restituiva zero spot. Build
verde, 137 test verdi.

---

## Come si controlla

```bash
npm run verifica          # contro il server locale
npm run verifica:prod     # contro maps.chrispybmx.com
```

Lo script fa **richieste vere**. Prova ogni categoria che il selettore offre —
leggendola da `lib/constants.ts`, non da un elenco scritto a mano — e verifica
che il server la accetti. Se una viene respinta, te lo dice con il nome della
categoria e il messaggio esatto.

Gli invii di prova si fermano tutti sul token finto, **prima di scrivere
qualsiasi cosa**. Non creano spot.

Esce con codice `1` se qualcosa non va.

---

## Quando lanciarlo

**Prima di ogni push.** Se esce rosso, non si pubblica.

**Dopo ogni deploy**, con `npm run verifica:prod`. Il locale e la produzione
non sono la stessa cosa: il database è lo stesso ma le cache, il CDN e le
variabili d'ambiente no.

---

## Cosa controlla

1. **Aggiungere uno spot** — ogni categoria del selettore, gli ostacoli, gli
   errori che dicono quale campo, e che senza sessione non si scriva nulla.
2. **La mappa non è vuota** — quanti spot, quanti con copertina.
3. **Le pagine che contano** — mappa, sfoglia, preferiti, conferma, e che le
   route inesistenti diano 404 e non 200.
4. **Le porte chiuse** — l'admin richiede la sessione, e le GET di moderazione
   rimandano alla conferma invece di decidere.
5. **Tipi e test**, solo in locale.

---

## Il limite di cui tenere conto

Il sito accetta **10 invii ogni 5 minuti per indirizzo IP**. Lo script ne fa
otto. Se lo lanci due volte di seguito, il secondo giro prende `429`: lo script
lo riconosce e te lo dice invece di darti un falso allarme. Aspetta cinque
minuti e rilancia.

---

## Come è stata provata la guardia

Rimettendo il bug vero. Tolta `street` dall'elenco che il server accetta:

```
✗ categoria «street» RESPINTA — un rider che la sceglie non riesce a inviare
  {"ok":false,"error":"Controlla il campo: categoria.","campi":["categoria"]}
```

Build verde, e la guardia rossa. Ripristinato, verde.

**Una guardia che non è mai stata vista fallire non è una guardia.**
