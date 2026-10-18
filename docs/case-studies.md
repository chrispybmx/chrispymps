# Case study — idee da altri servizi

Iniziato 2026-10-12. Cosa fanno altri servizi, cosa prendere per Chrispy Maps, cosa scartare.
Stato: **da implementare** salvo dove indicato.

---

## 1. iNaturalist — inserimento e verifica community

**Come funziona**
- Ogni osservazione parte "Needs ID", diventa "Research Grade" quando >2/3 di chi identifica concorda.
- Voti sì/no semplici: data giusta? posizione giusta? la foto mostra il soggetto? foto non ritoccata con AI?
- Voti negativi → "Casual": resta visibile ma non conta. Si può tornare indietro se la community cambia idea.
- Posizione: le app native leggono il GPS dalle foto. Il sito web ha il nostro stesso limite.

**Situazione Chrispy Maps**
- Posizione: già presa dal GPS del telefono (`components/AddSpotModal.tsx`), pulsante fotocamera diretto (`components/PhotoUpload.tsx`, `capture="environment"`). Ok.
- Il GPS dentro le foto dalla galleria viene quasi sempre tolto da iOS/Android prima di arrivare al browser. Da verificare con il test: https://claude.ai/artifact/EnD9HDYCfm4hakEe99hURR
- Nuovi spot entrano `pending` e aspettano l'admin (`app/api/submit-spot/route.ts`) → collo di bottiglia.
- Consenso sullo stato spot già presente e fatto bene (`app/api/status-confirm/route.ts`).

**Da fare**
1. ❌ **Scartato 2026-10-12** — Spot nuovi visibili subito con etichetta "nuovo, da confermare". Christian: arrivano troppe foto scadenti, l'approvazione admin resta. Eventuale alternativa: rendere più veloce la sua coda di approvazione, non toglierla.
2. Domande sì/no al posto della moderazione: "la posizione è giusta?", "la foto è di questo spot?". Riusare la logica di `status-confirm`.
3. Badge "📍 Scattata sullo spot" per le foto dal pulsante fotocamera: contano di più per la verifica.
4. (Facoltativo) Leggere il GPS dalla foto nel browser se c'è ancora, fallback al pin a mano.

**Scartare**: AI che riconosce cosa c'è nella foto; gergo tipo "Research Grade" → usare "Verificato da 3 rider".

**Più avanti**: app nativa via Capacitor solo se arrivano altri motivi (notifiche push sessioni live).

---

## 2. Komoot — prima apertura, "cosa c'è vicino"

**Come funziona** (osservato su komoot.com/discover)
- Appena apri la pagina chiama `/api/geoip/json/<ip>` → posizione approssimativa dall'IP, poi reverse geocoding. Mostra subito percorsi vicini, zero popup.
- Lista di 5 schede prima della mappa: nome, difficoltà (Facile/Moderato/Difficile), voto, n. recensioni.
- Una sola domanda: "Quale sport? Dove?".

**Smontato con REA** (2026-10-12, Chrome isolato, 53 richieste catturate)
- I percorsi "vicino a te" sono **già nell'HTML** dal server (React Query `dehydratedQueryClientState`, chiave `{"hike":{"tours":[...]}}`). Il server sceglie la zona dall'IP prima di mandare la pagina. Nessuna chiamata API per la lista.
- Dopo il caricamento il browser chiama `/api/geoip/json/<ip>` → `{city:"Sacile", region_name:"Friuli Venezia Giulia", latitude, longitude}` e poi `/api/search/reverse-geocoding` → "Sacile, Pordenone". Serve a precompilare il campo "Dove?".
- **Ordine della lista = numero di visitatori** (`visitors`: 1017, 1007, 913, 662, 618), non voto né distanza. Il numero grande sulla card sono i visitatori.
- Ogni percorso ha:
  - `difficulty: {grade:"easy", explanation_technical:"dh#t1", explanation_fitness:"d#c1"}` → difficoltà divisa in tecnica e fisica
  - `summary.surfaces` → % asfalto / sterrato / natura
  - `rating_count`, `rating_score` (295 voti, 4.6)
  - `faq` → domande pratiche tipo "Dove inizia e dove parcheggio?"
  - foto della community con voto `rating:{up,down}` → la foto migliore va in copertina
  - `source: editorial_tour` → percorsi scelti dalla redazione Komoot, non solo dagli utenti

**Situazione Chrispy Maps**
- `components/SpotMap.tsx` (~riga 215): la posizione precisa parte solo se il permesso c'è già, sennò lo chiede la card di benvenuto. Scelta giusta.
- Ma chi entra la prima volta o ha negato vede l'Italia intera.

**Da fare**
1. ✅ **Fatto 2026-10-12** (`lib/ip-view.ts`, solo visitatori in Italia, zoom 9). Posizione dall'IP per chi non ha dato il permesso. Vercel la dà gratis negli header `x-vercel-ip-latitude`, `x-vercel-ip-longitude`, `x-vercel-ip-city`. Prima apertura → mappa già sulla città ("Spot vicino a Treviso"). Poi la card chiede la posizione precisa come oggi.
2. Etichetta di difficoltà sulle card spot, tipo "🟢 Adatto per iniziare". Verificare se esiste già un campo. Come Komoot, si può dividere in due: livello tecnico (rampe/rail) e "tranquillità" (affollato, traffico).
3. Ordinare "vicino a te" per **rider che ci sono andati** (sessioni), non solo per distanza: mostra subito gli spot vivi.
4. Voto 👍/👎 sulle foto di uno spot: la più votata diventa la copertina.
5. Mini FAQ pratica per spot: "dove lascio la bici/auto?", "c'è acqua?", "orari?". Campi brevi compilati dalla community.
6. Spot "scelti da Chrispy" (editoriali), in evidenza rispetto a quelli degli utenti: legame con il canale.

**Scartare**: "Quale sport?" come domanda d'ingresso.

---

## 3. Strava — classifiche, local legend

**Come funziona il Local Legend**
- Lo vince chi fa **più volte** un segmento negli ultimi **90 giorni**. La velocità non conta (quella è il KOM).
- Finestra mobile: ogni giorno le uscite più vecchie di 90 giorni scadono. Per tenere il titolo devi continuare ad andarci.
- Corona a forma di alloro sul profilo, pagina "Most Efforts" con il conteggio. Classifica generale + femminile.
- Perché funziona: premia la costanza, non il talento. Chiunque può vincerlo, anche un principiante, se ci va spesso.

**Smontato con REA** (2026-10-12, segmento pubblico 229781 "Hawk Hill", da sloggato)
- Pagina Next.js come la nostra. Da sloggato `__NEXT_DATA__` contiene solo nome, sport, luogo del segmento: tutto il resto è dietro registrazione (muro di login come leva di iscrizione).
- Le regole vere sono nei testi dell'interfaccia (`/frontend/assets/landing-pages/locales/it-IT/views.yml`, blocco `local_legend:`):
  - "Maggior numero di attività sul segmento negli ultimi 90 giorni"
  - **Istogramma a fasce**, non classifica: "Tu e altri {{N}} atleti avete completato {{min}}-{{max}} prestazioni". Sei in un gruppo, non "37°".
  - **Privacy**: "Il nome e le attività della Local Legend sono visibili a tutti. Se non sei tu, il numero delle tue attività e la tua posizione nell'istogramma sono visibili solo a te."
  - **Si può uscire** ("Abbandona Local Legend"): i risultati spariscono entro 24 ore; se rientri contano solo le attività da quel momento.
  - Stato vuoto: "La corona di alloro è qui che ti aspetta — Nessuno ha completato questo segmento negli ultimi 90 giorni."
  - Classifica a nomi solo tra persone che si seguono a vicenda.
  - Categorie: Generali + Donne.
  - Confronto dettagliato con gli altri = a pagamento (abbonamento).

**Situazione Chrispy Maps**
- Le sessioni live sono già legate a uno spot e prendono la posizione quando entri (`app/api/sessions/route.ts`, `join` con `spot_id`, `lat`, `lon`). È il "check-in" che serve.
- Tabelle già presenti: `sessions`, `spot_riders`, `user_badges`, `point_events`, `user_stats`.

**Da fare — "Local dello spot"**
1. Ogni sessione valida allo spot = 1 presenza. Valida solo se la posizione al `join` è entro ~150 m dallo spot, max 1 al giorno per spot (contro i furbi).
2. Chi ha più presenze negli ultimi 90 giorni = **Local dello spot**. Badge sul profilo + nome sulla scheda dello spot ("Local: @marco, 14 sessioni").
3. Finestra mobile: se smetti di andarci, il titolo passa a chi ci va.
4. Mostrare anche "ti mancano 3 sessioni per diventare Local": spinge senza umiliare.
5. Niente classifica di velocità o trick: solo presenze. In linea con "scena aperta" e "non mollare".
6. Copiare l'**istogramma a fasce** di Strava: pubblico solo il nome del Local; gli altri vedono solo se stessi ("Tu e altri 8 rider siete passati qui 3-5 volte"). Nessuno è ultimo in pubblico.
7. Opt-out dal Local con un tap (importante per i minori).
8. Stato vuoto che invita: "Nessun Local qui. Il posto è tuo: bastano 2 sessioni."

**Da decidere**
- Nome: "Local", "Padrone di casa", "Re dello spot"?
- Classifiche separate per età/primo anno, così un ragazzino può vincere contro i veterani?
- Privacy minori: mostrare il Local solo con username, mai orari esatti delle sessioni.

---

## 4. Waze — segnalazioni rapide

**Smontato con REA** (2026-10-12, waze.com/it/live-map, da sloggato)
- Caricamento segnalazioni bloccato dall'anti-bot (`/live-map/api/georss` → 403). Non aggirato. Analizzato il JS già scaricato (`livemap-*.js`).
- Le segnalazioni si caricano per **riquadro visibile**: `georss?top=&bottom=&left=&right=&types=alerts,traffic`. Solo quello che c'è a schermo.
- Ogni segnalazione: `type` + `subtype` (es. `HAZARD` → `HAZARD_ON_ROAD_POT_HOLE`), via, `likes` (= nThumbsUp, i "grazie"), commenti, foto, autore, **team** dell'autore, orario (`pubMillis`).
- Tassonomia a due livelli: poche categorie grandi, sottotipi precisi opzionali (~30 sottotipi solo di "pericolo").
- Posizione dall'IP anche qui (`/web_api/request_info` → `city:"Padua"`). Komoot dallo stesso Mac diceva Sacile: **l'IP sbaglia anche di ~80 km**. Va bene per scegliere la regione, non per le distanze.
- La logica "c'è ancora? Sì/No" è solo nell'app nativa, non nel web.

**Da fare**
1. Segnalazioni rapide sugli spot a due livelli: categoria (🚧 problema, ✅ ok, 🔒 chiuso) → dettaglio facoltativo (vetri, bagnato, sorveglianza, rampa rotta, demolito...). Un tap basta.
2. "Grazie" su ogni segnalazione: chi segnala vede quante persone ha aiutato (rinforzo positivo, punti XP).
3. Ogni segnalazione mostra quanto è vecchia ("2 ore fa") e scade da sola. Lo stato `condition` attuale c'è già in `status-confirm`.
4. Crew/team come Waze: la segnalazione mostra la crew del rider ("by @luca · Treviso BMX crew").

---

Fonti Strava: [DC Rainmaker](https://dcrainmaker.com/2020/06/strava-legends-feature.html), [Zwift](https://www.zwift.com/news/27291-strava-local-legends), [Zwift Insider](https://zwiftinsider.com/strava-local-legends)
