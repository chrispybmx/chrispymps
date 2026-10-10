# Rilascio 2026-10-07

Pubblicazione richiesta esplicitamente dal titolare. Nessun push Git.

## Deployment verificato

- Dominio: https://maps.chrispybmx.com/map.
- Vercel: dpl_9gFFYVV9bCWb161u4ENdGhbnFKrj, READY, promosso con successo.
- URL immutabile: https://chrispymps-ffai0reg0-chrispybmxs-projects.vercel.app.
- Build Vercel: compilazione, TypeScript, lint e 187 pagine riusciti.
- Il dominio e' stato ispezionato dopo la promozione: punta al nuovo deployment.
- Rollback applicativo: promuovere dpl_g9XXeokLFjLczf2QAkUHgtwhde8W.
  Conservare le nuove tabelle e i dati; non annullare le protezioni del database.

Pubblicati: scheda dal basso del +, timer nella mappa, riapertura senza GPS,
profilo compatto con soli totali, condivisione facoltativa dei totali, filtro
Live e conteggi aggregati, correzione Aggiungi spot durante l'attesa GPS.

## Migrazioni e backup

Progetto Supabase verificato: aoiuzmidvbfukemkhajk, chrispymps.
Applicate singolarmente via db query --linked --file, ciascuna in transazione:

- 20261002190000_rider_profile_stats.sql
- 20261003120000_rider_live_map.sql

Registrate entrambe come applied con migration repair. Nessun db push/reset.
Storico ottobre verificato: 20261002, 20261002170000, 20261002190000,
20261003120000. Nuova tabella con RLS; SELECT negato ad anon/authenticated;
RPC Live eseguibile solo dal servizio backend, non dai client.

Backup precedente alle migrazioni, modalita' 0600:
/Users/christianceresato/Documents/Chrispy Maps/backups/supabase-pre-live-20261007.dump
654679 byte, 82 TABLE DATA, archivio leggibile con pg_restore --list.
SHA256: 6bddbf8b61fd43e93c488786142eef91480e27c6e8c05eede25bc8b1a7e9893f.
Schemi public/auth/storage/supabase_migrations; contiene dati personali e va
mantenuto privato. Non include i file foto o configurazioni provider esterne.
Non e' stata fatta una prova di ripristino completa su un altro progetto.

## Verifiche eseguite

- 705 test in 65 file, inclusa la sequenza di 1000 operazioni sintetiche.
- Due account Auth temporanei reali: login senza email signup, avvio, retry,
  doppio avvio, riapertura, chiusura, correzione, faccine private, cancellazione.
- Scadenza simulata modificando solo una sessione tecnica: necessita conferma,
  esclusione dai totali prima della conferma, 7200 secondi dopo.
- Altro utente: storico vuoto, modifica altrui 404; SELECT diretto negato.
- Totali pubblici inizialmente null; opt-in restituisce solo confirmedCount e
  confirmedSeconds; revoca torna null. Preferenze private non leggibili da client.
- Live per account non autorizzato: available=false, spots=[]; RPC diretta negata.
  Avvio Community non autorizzato 403. Nessuna apertura del kill switch.
- Upload immagine reale HTTP 200, recuperabile e senza EXIF; invio spot HTTP 201,
  stato pending, foto collegata; sessione privata sul pending solo per autore.
- Cleanup riuscito: 2 account, 1 spot pending, 1 foto. Query finale conferma
  zero account cm-release e zero spot TEST TECNICO RILASCIO residui.
- Chrome e WebKit sul dominio pubblico, 320/390/430 px: nuovo bottom sheet,
  touch, null blur, riapertura, Escape, focus trap, sfondo, accesso per aggiunta
  spot da ospite, nessun overflow o errore JavaScript.
- SEO online: canonical, noindex pagine private, veri 404, sitemap senza doppioni;
  207 URL e 127 spot. Nessuna promessa sul posizionamento nei motori di ricerca.

Output HTTP reale successivo alla promozione:

```text
200 /map
200 /u/chrispy
200 /sessioni
401 /api/rider-sessions
401 /api/rider-sessions?live=1
404 /api/rider-sessions-preview
404 /api/rider-stats-preview
404 /anteprima-sessioni
404 /map/Verona
404 /news/non-esiste
```

## Limiti e continuita'

- sharing_enabled resta false: la presenza Community e' ancora disattivata,
  anche se il filtro Live e il backend aggregato sono pubblicati. Nessuna
  apertura automatica per tutti, nessuna verifica dell'eta' inventata.
- Notifiche push dopo due ore non implementate. Conferma della fine nell'app
  e scadenza lato server restano operative.
- Test browser automatizzati, non su iPhone fisico. L'email tecnica di moderazione
  puo' essere stata inviata dal test submit-spot; consegna in casella non verificata.
- Nessun cambiamento a conferma email Supabase, provider, consensi o analytics.
- Demo e snapshot esclusi dal rilascio; flag demo false; nessuna credenziale locale
  caricata. La build ha usato la configurazione remota Vercel.
- Il laboratorio non e' un checkout Git. Prima di un prossimo push da sito,
  riconciliare i cambiamenti preservando il lavoro preesistente: un autodeploy
  del vecchio main potrebbe sovrascrivere questo rilascio.
- scripts/check-live-rider-release.mjs e' stato esteso localmente durante il
  collaudo con test statistiche/Live e VERCEL_CLI. Nessun codice applicativo e'
  stato modificato dopo l'upload; tale aggiornamento dello script non e' incluso
  nei sorgenti del deployment. I documenti sono esclusi da .vercelignore.
