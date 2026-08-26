# Chrispy Maps — sito

Next.js 14 + Supabase. Mappa degli spot BMX in Italia, con community, eventi e newsletter.
Repo: github.com/chrispybmx/chrispymps · deploy Vercel automatico su `main`.

## Path

**ROOT del sito:** `/Users/christianceresato/Documents/Chrispy Maps/sito`
**Progetto contenuti (canale, vision, brand):** `/Users/christianceresato/Documents/ChrispyBMX`

Sempre percorsi assoluti, mai relativi.

## Struttura

| Cartella | Cosa |
|---|---|
| `app/` | Rotte Next.js: map, cerca-spot, sfoglia, scopri, classifica, events, news, sessioni, preferiti, u (profili), admin, auth, api |
| `components/` | 42 componenti React |
| `lib/` `hooks/` | Supabase client, utility, hook condivisi |
| `__tests__/` | Test |
| `.agents/rules/` | Regola RTK per Antigravity |

## Prima di lavorare all'interfaccia

Il sito è la faccia pubblica del canale: **stesse associazioni, stesso pubblico.**

1. `/Users/christianceresato/Documents/ChrispyBMX/vision/chrispy-vision.md` — l'isola sono i ragazzi che iniziano la BMX in Italia. Se una schermata parla a qualcun altro, è fuori rotta.
2. `/Users/christianceresato/Documents/ChrispyBMX/brand/` — loghi veri, non ricrearli.

Le tre associazioni da tenere in piedi anche nell'interfaccia: **scena aperta** (niente barriere per chi arriva, niente gatekeeping), **evolvo in pubblico** (mostrare il processo, non solo il risultato finito), **non mollare** (chi sbaglia a inserire uno spot non deve sentirsi stupido).

## Skill da usare qui

| Quando | Skill |
|---|---|
| Costruire o rifare una schermata | `frontend-design` |
| Rivedere, sistemare, rendere più chiara una UI esistente | `impeccable` |
| Movimento, transizioni, gesture | `ui-animation` |
| Grafiche e immagini per il sito | `ai-graphics`, poi `web-ready` per ottimizzarle |
| Grafici e dashboard (classifica, statistiche) | `dataviz` |
| Mockup prima di scrivere codice | `design` |

## Regole

- **Shell:** prefissa i comandi con `rtk` (vedi `.agents/rules/antigravity-rtk-rules.md`) — filtra l'output e risparmia il 60-90% di token. È installato.
- **Segreti:** `.env.local` contiene le chiavi Supabase e MailerLite. Mai committare, mai stampare in output.
- **Database:** le scritture su Supabase toccano dati veri di utenti reali. Prima di una migrazione o di una cancellazione, dichiara cosa cambierà e aspetta conferma.
- **Immagini:** ottimizzare prima di committare (`web-ready` o `optimize-jpeg`). Ci sono già PNG pesanti nella root del progetto.

## Legami col resto

- La newsletter viene pubblicata qui dalla skill `newsletter-weekly` che vive in `/Users/christianceresato/Documents/ChrispyBMX/.claude/skills/`
- Il calendario eventi è alimentato da `events-scraper`, sempre da lì
- Entrambe scrivono su Supabase: se cambi lo schema, avvisa quelle skill
