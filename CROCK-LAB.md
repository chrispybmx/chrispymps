# Crock Lab

Workspace sperimentale creato il 2026-10-02 dal sito Chrispy Maps.

## Stato aggiornato: versione pubblicata

Il 2026-10-02 il proprietario ha autorizzato il rilascio sul progetto reale.
Questa cartella e' ora collegata a Vercel chrispymps; il codice e' stato
pubblicato su maps.chrispybmx.com e le due nuove migrazioni sono state applicate
al Supabase esistente. Le indicazioni di isolamento sotto descrivono la fase
iniziale, non lo stato corrente. Dettagli, backup e rollback:
`docs/deployment/rider-release-2026-10-02.md`.

Non eseguire test distruttivi usando .env.production.local. La demo locale
richiede credenziali loopback esplicite. La cartella non ha Git: prima di un
push dall'originale riconciliare i sorgenti, altrimenti main puo' sovrascrivere
il rilascio CLI. Originale e modifiche preesistenti non sono stati alterati.

## Isolamento

- Originale: `/Users/christianceresato/Documents/Chrispy Maps/sito`.
- Backup: `../backups/chrispy-maps-2026-10-02-pre-crock.tar.gz`.
- La copia include le modifiche non committate e i file sorgente non tracciati.
- Non sono stati copiati `.git`, `.vercel`, `.env*` (eccetto `.env.example`),
  `node_modules`, `.next`, `tsconfig.tsbuildinfo` e le configurazioni locali
  degli agenti `.agents`, `.claude`, `.impeccable`.
- Nessun collegamento Git remoto o deploy configurato in questa copia.
- Non copiare qui le credenziali del sito originale: database, storage,
  autenticazione ed email devono usare un progetto di sviluppo separato.
- Nessuna migrazione o modifica ai dati reali autorizzata.
- Prima implementazione Sessioni e collaudo locale: vedi `docs/rider-sessions-local.md`.

Il backup comprende Git e la configurazione locale con segreti: mantenerlo
privato e non caricarlo su repository o servizi pubblici. Esclude soltanto
dipendenze, output Next e cache TypeScript rigenerabili. Non costituisce
un backup del database remoto o dello storage Supabase.

## Prima iterazione

Aggiornamento 2026-10-02: il brief successivo del proprietario da' priorita'
alle sessioni personali con presenza opzionale. Implementazione e limiti
sono documentati in `docs/rider-sessions-local.md`; i filtri multisport restano
una fase successiva, non inclusa in questo intervento.

1. Esaminare e riutilizzare il lavoro recente sulle sessioni, senza sostituirlo.
2. Prototipo locale con dati simulati, esplicitamente identificati come demo.
3. Un'unica mappa con selettore Spot / Live; preservare centro e zoom.
4. Filtro multidisciplina con selezione singola, multipla e Tutte.
5. Distinguere discipline da tipi di luogo: campeggio e servizi non sono sport.
6. Simulare inizio, termine e scadenza della sessione presso uno spot.
7. Verificare mobile, desktop, filtri e regressioni del caricamento foto.

## Decisioni ancora aperte

- Presenza allo spot oppure posizione GPS: proposta iniziale solo spot.
- Dettagli dei partecipanti pubblici oppure riservati agli iscritti.
- Accesso al Live per minorenni e modalita di gestione dell'eta.
- Discipline incluse al primo lancio.
- Nome Crock: marchi e disponibilita non ancora verificati.

Nessuna delle proposte sopra equivale a una decisione legale approvata.
Avvisi di sessione opt-in e separati dal marketing; niente notifiche reali
o raccolta di nuove informazioni personali durante il prototipo.

## Criteri prima del lancio

- Ambiente di sviluppo realmente separato da produzione.
- Informative, conservazione, moderazione, abusi e segnalazioni definiti.
- Revisione privacy e normativa nei mercati di lancio, inclusi minori e posizione.
- Build, test e verifica visuale aggiornati; flusso upload verificato in sandbox.
- Nessun push o deploy senza richiesta esplicita.
