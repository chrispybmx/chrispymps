---
title: PRODUCT
type: note
permalink: ai/antigravity/product
---

# Chrispy Maps Product Notes

## Register

product

## Purpose

Chrispy Maps aiuta rider BMX, skate e scooter a trovare spot reali, capire se sono ancora buoni e contribuire posti nuovi alla scena. La mappa deve sembrare fatta da chi gira davvero, non da un catalogo turistico o da una directory SEO.

## Core User

Il rider apre l'app dal telefono, spesso fuori casa o già vicino a uno spot. Ha bisogno di risposte rapide: cosa c'è vicino, com'è lo spot, quanto è fresco lo stato, come arrivarci, se vale la pena salvarlo o contribuire una foto.

## Product Priority

1. Trovare uno spot vicino.
2. Capire se lo spot è reale, recente e rideable.
3. Salvare o condividere lo spot.
4. Contribuire uno spot o una foto vera.
5. Far emergere rider, eventi e contenuti solo quando aiutano la scena.

## Experience Principles

- La mappa è il prodotto principale. Tutto il resto deve riportare alla mappa o migliorare la fiducia negli spot.
- Mobile first significa uso con una mano, luce esterna, connessione imperfetta e poca pazienza.
- Le foto reali valgono più di screenshot, descrizioni vaghe o categorie troppo generiche.
- Ogni feature social deve aumentare fiducia e partecipazione, non creare rumore.
- La voce può essere ruvida e da scena BMX, ma i controlli devono restare chiari e prevedibili.

## UX Guardrails

- Non aggiungere nuove voci principali se una feature può vivere dentro mappa, profilo o spot.
- Evitare tutorial lunghi: mostrare subito un risultato utile.
- Chiedere login per contribuire e modificare. I preferiti funzionano anche sul dispositivo; l’accesso li collega all’account.
- Preferire stati vuoti che suggeriscono una prossima azione concreta.
- Mantenere `Aggiungi spot` orientato allo scatto sul posto, con galleria come alternativa secondaria.

## Visual Direction

Interfaccia nera e arancione, leggibile e curata, costruita intorno a cartografia e fotografie reali. La mappa resta chiara di default. Il carattere BMX emerge dal marchio, dai simboli degli ostacoli e dai contributi dei rider. Su indicazione del proprietario, la cartografia mantiene un tono caldo ispirato al VHS e Aggiungi spot una trama interlacciata statica. Il trattamento non copre testi, foto o marker. Niente glow, sfocature o animazioni decorative; la qualità dipende da tipografia, proporzioni e interazioni.

## Anti-Goals

- Diventare una landing page o una raccolta di card promozionali.
- Trasformare `street` in un contenitore dove finisce tutto.
- Coprire la mappa con pop-up, banner o richieste di donazione.
- Nascondere problemi di fiducia: foto da mappa, stati vecchi e spot dubbi devono essere dichiarati.

## Inviti personali a una session

Decisione approvata dal proprietario il 25 settembre 2026: prima funzione sociale per la community BMX, oggi soprattutto italiana. Un rider invita una persona specifica con spot, giorno, ora e messaggio facoltativo. La chat di testo si apre dopo l’accettazione. La mappa e la scoperta degli spot restano il centro del prodotto.

Accesso da profilo e autore registrato dello spot; Messaggi nel menu e nella campanella. Nessuna nuova voce nella barra mobile. Gli appuntamenti non sostituiscono il check-in «Sono in session». Rifiuto, annullamento, scadenza, blocco e segnalazione sono parti della prima versione. Email per nuovi inviti solo con preferenza attivata, mai testo della chat. Nessun premio per il numero di messaggi.

Implementazione inizialmente disattivata tramite flag. Prima del rilascio servono migrazione verificata in staging, verifica con account di test, configurazione della coda email e revisione delle informative e della gestione dei dati privati.

## Affidabilità, scoperta e apertura internazionale — 25 settembre 2026

Priorità implementate: preferiti condivisi fra mappa, scheda e pagina salvati; consenso sullo stato basato sull’ultima opinione di rider distinti; informazioni utili e date foto verificabili; Scopri con ordine esplicito e paginazione; indice mappa senza gallerie e copertine caricate per i risultati mostrati.

I controlli principali di ricerca, scheda, contributo e accesso hanno italiano e inglese selezionabili. I nomi, le descrizioni e i commenti dei rider restano originali. La selezione della lingua non equivale a pagine SEO inglesi indicizzabili: URL per lingua, hreflang e strategia editoriale internazionale sono una fase separata.

La crescita parte dai luoghi e dai contributori esistenti. Nessun numero di visite, recensione o presenza inventato. L’indice mappa resta globale e leggero: prima di volumi molto maggiori servono indice spaziale/cluster server e misure su dispositivi e reti reali. Le prove di usabilità con rider reali restano da svolgere.
