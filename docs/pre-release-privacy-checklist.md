# Checklist tecnica privacy e rilascio

Data: 2026-10-02. Ambito: copia locale crock-lab. Nessun deploy, invio email,
modifica remota, registrazione di agenti o attivazione di servizi effettuata.
Integra i sei punti delle immagini IMG_6049, IMG_6050 e IMG_6051, adattandoli
alle funzionalita effettivamente presenti. Non e un parere legale ne una
certificazione GDPR, COPPA, CIPA, CAN-SPAM o DMCA. Gli importi del documento
non vanno interpretati come sanzioni automatiche per ogni visitatore.

## 1. Minori e creazione account - BLOCCO DI RILASCIO APERTO

Trovato: AuthModal richiede la nascita; AddSpotModal usa una dichiarazione 14+.
lib/auth-client.ts chiama direttamente Supabase auth.signUp. Il controllo UI
non prova l'eta e non impedisce richieste dirette al servizio Auth.
Esiste anche il percorso Google OAuth/setup username, da coprire prima della
creazione account, non cancellando l'account dopo che i dati sono stati raccolti.
La newsletter valida lato server consenso esplicito e dichiarazione 16+
in app/api/newsletter/subscribe/route.ts; resta una dichiarazione, non verifica.

Modificato: nessuna soglia cambiata senza decisione del titolare. Community
resta nel pilot autorizzato a livello database; la allowlist non verifica l'eta.

Da fare: decidere destinatari/paesi e policy account esistenti. Raccomandazione
operativa: primo pilot 18+ a inviti, non presentato come soluzione legale
universale. Configurare e collaudare un controllo Supabase Before User Created
che copra email, OAuth e chiamate dirette; dati mancanti devono fallire in modo
chiuso. Definire il percorso alternativo senza aggiungere raccolte identificative
non necessarie. Non attivare un hook incompleto che blocchi gli utenti reali.
Verificare anche raccolte senza account, upload, moduli newsletter e contatti.

Fonti: [FTC COPPA](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions),
[Garante minori](https://www.garanteprivacy.it/temi/minori),
[Supabase hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook).
La soglia italiana di 14 anni riguarda lo specifico consenso previsto dalla
normativa, non autorizza qualsiasi trattamento o presenza pubblica di minori.

## 2. Font e richieste terze parti - FONT GIA LOCALI

Trovato: app/layout.tsx usa next/font/google per Barlow e Barlow Condensed:
Next scarica in build e serve i font dall'app, non da Google al visitatore.
Non occorre sostituire questi font. La vecchia copia SpotMap.leaflet.bak.txt
contiene unpkg ma non e importata dal componente mappa corrente.

Modificato: rimossa dalla privacy l'indicazione obsoleta di unpkg; aggiunti
Brevo e Upstash come fornitori condizionati alla configurazione.

Destinazioni trovate nel codice, da verificare anche in rete sul deploy:

| Destinazione | Percorso | Dati/funzione |
| --- | --- | --- |
| Supabase | lib/supabase*, auth-client, upload API | Account, token Auth, database, foto; distinguere anon key pubblica da service role segreta |
| Vercel | hosting; components/Statistiche | Richieste hosting; statistiche facoltative solo con flag e scelta esplicita |
| Resend | lib/email, newsletter-preferences, session-invite-email | Destinatari e contenuti delle email operative |
| MailerLite | lib/mailerlite*, newsletter | Indirizzi, nome, gruppi; campagne/automazioni gestite anche fuori repo |
| Brevo | lib/brevo, newsletter | Destinatari e liste se provider brevo/both; possibile copia parallela |
| OSM/Nominatim | SpotMap, geocoding-server | Riquadri richiesti dal browser; ricerca/coordinate via proxy per geocoding |
| CARTO | components/SpotMap | Riquadri, IP del browser, area visualizzata |
| Upstash | lib/rate-limit | Chiavi e contatori dei limiti tecnici quando configurato |
| YouTube | embed nelle notizie/spot | Richieste del player; nocookie non equivale ad assenza di traffico verso Google |
| IndexNow | lib/indexnow | URL pubblici segnalati per indicizzazione |
| Ko-fi / social | lib/constants | Link esterni, non checkout implementato nel sito |

Fonte: [Next.js 14 font](https://nextjs.org/docs/14/app/building-your-application/optimizing/fonts).
Restano verifica contratti/regioni/trasferimenti e inventario degli asset esterni
realmente presenti nei contenuti. Nessuna pretesa che questa tabella certifichi
tutti i destinatari della configurazione cloud.

## 3. Analytics e session replay - CORREZIONI LOCALI

Trovato: nessun SDK Hotjar, FullStory, Clarity, LogRocket, PostHog, Mixpanel o
Sentry Replay nel codice applicativo e package.json esaminati. Vercel Analytics
era montato senza scelta; contatori prodotto dietro flag e gia minimizzati.

Modificato: NEXT_PUBLIC_WEB_ANALYTICS_ENABLED=false di default. Vercel SDK
caricato solo dopo consenso locale; anche trackMetric richiede consenso.
Scelta esplicita in /privacy#statistiche, revocabile, durata massima 180 giorni.
DNT/GPC prevalgono. Revoca ricarica la pagina per scaricare anche SDK gia attivi.
Nessun consenso ottenuto dal semplice bottone Ho capito. Nessun invio se storage
non disponibile. Pagine private e tutti i parametri URL/UTM esclusi.

Da fare: prova browser/rete su staging prima e dopo consenso, revoca, nuova
scheda e scadenza; verificare impostazioni Vercel e conservazione. I contatori
HTTP server e i log hosting non sono resi anonimi da questa modifica.

## 4. Email commerciali - VERIFICA PROVIDER NECESSARIA

Trovato: consenso newsletter separato da account, double opt-in, revoca e
sincronizzazione con MailerLite in newsletter-preferences e relative API/SQL.
Resend invia conferme e messaggi operativi. Il codice prevede anche Brevo/both.
Non esiste qui un sender completo delle campagne MailerLite: non e possibile
aggiungere header o footer alle campagne modificando solo l'email di conferma.

Modificato: nessun invio e nessuna falsa garanzia di disiscrizione delle
automazioni esterne. I flussi email esistenti non sono stati riscritti.

Da fare prima del marketing: fornire un indirizzo postale valido del titolare,
verificare mittente, footer e link funzionante in ogni template commerciale;
controllare header List-Unsubscribe/List-Unsubscribe-Post dove applicabili,
suppression list prima degli invii, webhook di revoca, campagne gia in coda,
tracking aperture/click e automazioni di benvenuto. Non mescolare promozioni
alle email operative per poi chiamarle transazionali. Non attivare raccolta o
invii finche questa verifica esterna non e completata.

Fonte: [FTC CAN-SPAM](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business).
Il requisito dei due header non e presentato come obbligo universale CAN-SPAM.

## 5. Abbonamenti - NON TROVATI NEL CODICE ATTUALE

Trovato: nessun checkout Stripe/Paddle, prezzo ricorrente, trial o fatturazione
implementati. Le subscription Supabase sono listener Auth, non abbonamenti.
Ko-fi e un link esterno: l'eventuale configurazione commerciale li non e verificata.

Modificato: nulla; non aggiungere pagamenti solo per soddisfare una checklist.
Se introdotti: termini accanto alla conferma, consenso, cancellazione semplice,
ricevute e promemoria applicabili, con revisione dei paesi serviti.
Fonte: [California AG](https://www.oag.ca.gov/news/press-releases/attorney-general-bonta-issues-consumer-alert-california%E2%80%99s-automatic-renewal-law).

## 6. Upload e copyright - SEGNALAZIONE MIGLIORATA, GESTIONE UMANA

Trovato: foto spot, avatar, contributi e notizie; /regole aveva gia un contatto
per segnalazioni e risposta del caricatore. Upload e moderazione esistenti
rimangono invariati.

Modificato: link vicino alle foto in PhotoCarousel verso /regole#segnalazioni;
istruzioni per identificare originale/contenuto contestato e rappresentanza;
indicazione della possibile sospensione per violazioni ripetute. Non e un
sistema automatico di gestione notice/counter-notice ne una registrazione DMCA.

Da fare: verificare copertura link anche per avatar, commenti, notizie e foto
fuori dal carousel; responsabilita operativa e tempi di gestione, contestazioni,
registro delle decisioni e applicazione coerente ai recidivi. Valutare con un
professionista DSA/GDPR e, se pertinente, condizioni del safe harbor USA.
Solo il titolare puo registrare un agente con dati reali, pubblicarne i contatti
e mantenerne la designazione. Nessun nominativo, indirizzo o numero inventato.
Fonte: [Copyright Office 512](https://www.copyright.gov/512/index.html),
[FAQ agente](https://www.copyright.gov/dmca-directory/faq.html).

## Controlli trasversali

- /privacy e /regole esistono; testo aggiornato solo in laboratorio e da revisionare.
- La scansione mirata dei sorgenti non ha trovato service-role/secret in variabili
  NEXT_PUBLIC, chiavi private PEM o pattern Stripe live. Non sostituisce una
  scansione completa della storia Git, dei bundle e delle variabili hosting.
- Callback Auth: salvati solo codici noti, non descrizioni provider o user-agent;
  rimosso l'inoltro di descrizioni libere nel redirect. Storico log gia esistente
  non cancellato: inventariare e applicare retention senza interventi ciechi.
- Sessioni personali: storico e umore privati, durata non riding, fonte manuale;
  aggiornare informativa/retention prima dell'attivazione reale. Nessun advertising
  o training AI implementato sui dati delle sessioni.
- Non applicare migrazioni o attivare flag sulla produzione come effetto collaterale.

## Prompt riutilizzabile nel repository

Prima di ogni rilascio rileggi questa checklist e il codice attuale. Per ciascun
numero riporta Trovato / Modificato / Rimane al titolare con file e test reali.
Non dedurre conformita da un banner, una checkbox o una build verde. Mantieni
separati i requisiti tecnici dalle decisioni legali e operative. Verifica le
fonti ufficiali aggiornate, non applicare soglie USA automaticamente all'Italia
o viceversa, e non riportare le cifre promozionali come sanzioni certe.
Non rompere upload, autenticazione, mappa o email operative. Non inventare
recapiti, consensi, verifiche dell'eta, registrazioni DMCA o configurazioni cloud.
Esegui test e build; per le verifiche non eseguibili indica il limite. Nessun
push, deploy, invio email o migrazione remota senza esplicita autorizzazione.
