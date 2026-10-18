# Template Supabase Auth

## Attualmente pubblicato — 26 settembre 2026

- Nome mittente: **Chrispy Maps**, indirizzo già esistente `noreply@chrispybmx.com`.
- Recupero password: `reset-password-current.html`.
- Oggetto: **Reimposta la password di Chrispy Maps**.
- Collegamento: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery` (27 settembre 2026, dopo il deploy di `/auth/confirm`). Verifica lato server, funziona da qualsiasi browser o dispositivo; prima era `{{ .ConfirmationURL }}` (PKCE, solo stesso browser).

Il contenuto e l’oggetto sono stati verificati nella dashboard dopo un ricaricamento. Una nuova richiesta sul sito pubblico ha restituito conferma di invio. La ricezione di questa nuova versione resta da confermare.

La prima email, precedente al cambio del testo, è arrivata nello spam. Il proprietario ha riportato SPF PASS, DKIM PASS sul dominio chrispybmx.com e DMARC PASS. Questi esiti non garantiscono la consegna in Posta in arrivo. Non sono stati cambiati DNS, provider o credenziali.

## Preparati per il prossimo deploy, non pubblicati

- `confirm-account.html`
- `reset-password.html`

`confirm-account.html` (27 settembre 2026): stesso stile del recupero, oggetto «Conferma il tuo account Chrispy Maps», link `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email`. Da pubblicare in «Confirm sign up» prima di attivare Confirm Email. Il codice necessario è online. `reset-password.html` resta come alternativa non usata. Il file `reset-password.html` non è una copia del template attualmente online. Confirm Email resta disattivato.
