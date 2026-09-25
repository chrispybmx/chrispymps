# Chrispy Maps · Direzione di prodotto

## Cosa abbiamo osservato

La mappa è già il centro del prodotto. Il sito usa nero/arancione e fotografie pubblicate dai rider. Ricerca, categorie, ostacoli, difficoltà, regioni, raggio e posizione sono già disponibili. Le schede collegano fotografie, autore, accesso, indicazioni, contributi, commenti e valutazioni. L'interfaccia precedente sovrapponeva effetti VHS e testi piccoli a questi contenuti; su desktop la lista occupava il fondo della mappa.

## Una direzione: costruito da chi gira

Conserviamo nome, nero/arancione, cartografia chiara, fotografie e attribuzione alla community. Il marchio tipografico usa Barlow Condensed in grassetto, con Chrispy chiaro e Maps arancione. È compatto e leggibile nella testata mobile. Non introduce graffiti, adesivi o immagini artificiali.

La personalità deriva dai posti reali, dai nomi dei rider e da simboli che rappresentano rail, ledge, bank e altri elementi. Le superfici sono piene; separatori e spazio sostituiscono schede annidate e ombre diffuse.

## Mappa desktop

Testata con ricerca, filtri e Aggiungi spot; categorie frequenti nella seconda riga. Lista laterale da 400 px e cartografia nel resto dello schermo. Ogni riga privilegia foto, nome, località, categoria e autore. La selezione apre un'anteprima e centra un marker arancione. Un pulsante arancione «Apri spot» rimane visibile sopra la foto mentre si scorre l’anteprima; anche il nome dello spot è un collegamento alla scheda completa. La foto mantiene l’ingrandimento a schermo intero. Indicazioni e preferiti restano disponibili. Le altre sezioni restano nel menu esistente.

## Mappa mobile

Testata compatta con marchio, ricerca e filtri. Pannello inferiore con tre stati: Mappa (ridotto), Lista e lista estesa; anche trascinabile. La selezione lascia una zona di mappa libera sopra la fotografia. La navigazione inferiore conserva le destinazioni esistenti e mette Aggiungi spot al centro. Altezza e posizione tengono conto delle aree sicure del telefono.

## Dettaglio spot

Desktop a due colonne: foto a sinistra, caratteristiche e azioni a destra. Mobile in sequenza: foto, nome/località, ostacoli, autore, informazioni disponibili, indicazioni e contributi. Valutazioni e commenti restano secondari. Le immagini sono mostrate senza tagliare gli ostacoli; Street View è dichiarato. Nessun valore di distanza o valutazione viene inventato: le distanze compaiono solo con un'origine nota e sono indicate come distanza in linea d'aria.

## Regole del sistema

- Colori: antracite caldo per le superfici, bianco caldo per il testo; arancione Chrispy #ff6a00 per azioni principali, selezione e focus. Cartografia chiara con tono caldo ispirato al VHS originale: seppia 32%, saturazione 1,45 e contrasto 1,12. La correzione riguarda solo le tessere, mai marker, controlli o foto, e non si applica alla mappa scura. Nessuna scanline, sfocatura o animazione decorativa. Colori di stato solo quando indicano dati reali.
- Tipografia: Barlow Condensed per il marchio; sans di sistema per l'interfaccia. Informazioni principali 14–16 px, nomi 16–26 px, titolo scheda 28–32 px. Etichette secondarie compatte 12 px; niente font decorativi nei comandi.
- Icone: contorno coerente, 18–24 px; simboli distinti per categoria e ostacolo, con etichetta testuale nei controlli. I marker non dipendono solo dal colore.
- Spazi: passi di 4/8 px, margini principali 16/20/24 px. Raggi generalmente 4–8 px; separatori sottili. Nessuna ombra sistematica.
- Interazioni: obiettivi principali di almeno 44 px, focus visibile, dialoghi ricerca/filtri/menu/accesso gestibili da tastiera. Animazioni brevi e solo funzionali; rispetto della preferenza di movimento ridotto.
- Marker: gruppi numerici ad alto contrasto, raggruppamento anche tra celle adiacenti per evitare sovrapposizioni, singoli con simbolo di categoria. Lo spot selezionato è più grande e arancione.
- Contenuti: italiano diretto, dati effettivamente disponibili, fotografie della community. XP e classifiche rimangono nelle sezioni esistenti.

## Perimetro

Il redesign modifica presentazione e interazioni di mappa, navigazione, scheda e accesso/contributo. Mantiene API, database, slug, collegamenti, autenticazione e invio esistenti. Nessuna pubblicazione sul sito live e nessuna scrittura ai dati della community durante la verifica.

## Dettaglio del pulsante Aggiungi spot

Su richiesta del proprietario, il pulsante Aggiungi spot conserva una trama interlacciata statica: una riga sottile ogni 4 px, dietro a testo e icona. Si applica al pulsante desktop e al + mobile, senza animazione né estensione agli altri controlli.

## Continuità dell’esplorazione

La chiusura della ricerca annulla solo la modifica in corso: il filtro applicato resta finché si usa Cancella o Tutti gli spot. I risultati remoti arrivati in ritardo non possono sostituire quelli della query corrente.

Risultati torna alla vista geografica e al punto della lista precedenti all’anteprima. Nella stessa scheda, aprendo la pagina di uno spot e tornando alla mappa si recuperano filtri, selezione, inquadratura, altezza del pannello e scorrimento. Questa memoria di sessione scade dopo due ore; non memorizza credenziali, fotografie o il profilo del rider.

Se Aggiungi spot richiede l’accesso, l’intenzione viene mantenuta fino al successo dell’accesso; chiudere il dialogo la annulla.

## Pulsanti con carattere

I comandi principali recuperano una presenza fisica: angoli da 3 px, bordo inferiore netto e pressione verticale di 2 px. L’interlacciato resta solo su Aggiungi spot. Filtri passa a superficie arancione quando attivo. Gli stati del pannello Mappa, Lista ed Espandi hanno aree da almeno 44 px e selezione a superficie chiara, distinta dall’arancione delle azioni. Nessun nuovo effetto continuo.

## Affidabilità dei percorsi principali

Il tocco su un marker apre la stessa anteprima della lista, senza un secondo popup sovrapposto. Una ricerca esplicita per nome apre sempre lo spot scelto e segnala la rimozione dei filtri precedenti. Scegliere una città sostituisce zona e testo della ricerca, mantenendo le preferenze sul tipo di spot; il movimento della mappa non viene sovrascritto da un secondo riposizionamento automatico.

La ricerca di una città inquadra il centro e gli spot corrispondenti ai filtri presenti entro la zona locale, con margini per il pannello. In assenza di spot resta una vista geografica della città. Il precaricamento foto viene invalidato a ogni cambio di selezione o chiusura: soltanto una corrispondenza completa e ordinata File→URL può sostituire i file nell’invio. Errori parziali offrono riprova, mantenendo il percorso multipart esistente.

## Proposte di session e messaggi

Il nuovo percorso mantiene il nero/arancione e i pulsanti con bordo inferiore netto. Su desktop elenco inviti a sinistra, proposta o conversazione a destra. Su telefono si vede una schermata alla volta, con ritorno a Messaggi e campo di scrittura ancorato al fondo della finestra visibile.

La gerarchia è persona, spot, giorno e risposta. Lo spot resta un collegamento esplicito. Prima dell’accettazione sono disponibili solo risposta e gestione dell’invito; dopo appare la chat. Ricerca rider e spot usa dati esistenti. Il fuso orario è esplicito; nessun dato di distanza o presenza viene dedotto da un invito accettato.

Stati e selezioni hanno testo oltre al colore. Controlli principali da almeno 44 px, testo dei campi da 16 px, focus visibile, aggiornamenti sospesi a pagina nascosta. Blocco e segnalazione vivono in Opzioni; i rider possono essere sbloccati anche dalle preferenze. La segnalazione condivide con i moderatori una copia dell’invito e degli ultimi 20 messaggi, dichiarandolo prima dell’invio.

## Scopri, salvati e fiducia

Scopri riusa marchio, superfici e pulsanti della mappa. Fotografie 3:2, griglia di tre colonne da 960 px e quattro da 1440 px; su mobile una colonna. I primi 24 spot seguono l’ordine dichiarato (più recenti o nome); Carica altri mantiene il controllo al rider. Filtri per paese dai dati presenti e regioni italiane secondarie. Mostra sulla mappa apre lo spot corrispondente, senza ricerca da ripetere.

Prima di partire è un elenco con separatori vicino alle indicazioni, composto solo dai campi disponibili. Le foto mostrano credito, fonte e data di caricamento, distinta dalla data dello scatto. Lo storico mostra segnalazioni reali attribuite a username pubblici. La recenza usa unità complete, in entrambe le lingue.

I preferiti sono una scelta reversibile, con Annulla sulla pagina salvati. Un errore di rete ripristina lo stato confermato e resta visibile. I vecchi salvataggi di provenienza incerta si recuperano con scelta esplicita, senza assegnarli automaticamente a un account.
