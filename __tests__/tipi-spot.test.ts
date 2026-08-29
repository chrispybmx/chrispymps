import { describe, it, expect } from 'vitest';
import { TIPI_SPOT, TIPI_SPOT_SELEZIONABILI, TIPI_SPOT_TUTTI, OSTACOLI, OSTACOLI_TUTTI } from '@/lib/constants';

/**
 * Il selettore del modale e la validazione del server devono restare allineati.
 *
 * Il 19/08/2026 e' stata aggiunta la categoria `transition`. Il modale l'ha
 * mostrata subito, perche' legge TIPI_SPOT_SELEZIONABILI. Il server no, perche'
 * aveva l'elenco copiato a mano dentro submit-spot. Risultato: la PRIMA
 * categoria del selettore rispondeva 422 a ogni invio — con le foto gia'
 * caricate nello storage e un messaggio che non diceva quale campo fosse
 * sbagliato. Cinque giorni prima che qualcuno se ne accorgesse.
 *
 * Questi test non verificano una funzione: verificano che due elenchi non
 * possano divergere di nuovo.
 */

const selezionabili = TIPI_SPOT_SELEZIONABILI.map(([t]) => t);

describe('tipi spot — selettore e server allineati', () => {
  it('ogni categoria offerta dal modale e\' accettata dal server', () => {
    for (const t of selezionabili) {
      expect(TIPI_SPOT_TUTTI, `"${t}" e' scegliibile ma il server la rifiuterebbe`).toContain(t);
    }
  });

  it('transition resta valida lato server ma non e\' piu\' un contesto', () => {
    /* Era offerta come categoria e respinta dal server: il bug che ha aperto
       tutta questa storia. Ora non e' piu' una categoria affatto — un bank o
       una quarter sono OSTACOLI, e possono stare in street come in un park.
       Il valore resta accettato dal server perche' qualche spot potrebbe
       averlo, e toglierlo spaccherebbe ogni modifica a quegli spot. */
    expect(TIPI_SPOT_TUTTI).toContain('transition');
    expect(selezionabili).not.toContain('transition');
    expect(OSTACOLI_TUTTI).toContain('bank');
    expect(OSTACOLI_TUTTI).toContain('quarter');
  });

  it('street e\' scegliibile: e\' una macrocategoria, non un calderone', () => {
    /* Era stata tolta dal selettore leggendo «60 spot su 116» come pigrizia.
       Ma street contiene ledge, box, rail e scale: quei 60 sono semplicemente
       quanto street c'e' in giro. Toglierla obbligava chi aggiungeva un vero
       spot street a scegliere un ostacolo al suo posto. */
    expect(TIPI_SPOT_TUTTI).toContain('street');
    expect(selezionabili).toContain('street');
  });

  it('TIPI_SPOT_TUTTI copre davvero tutto, legacy compresi', () => {
    expect([...TIPI_SPOT_TUTTI].sort()).toEqual(Object.keys(TIPI_SPOT).sort());
  });

  it('nessuna categoria e\' dichiarata due volte', () => {
    expect(new Set(TIPI_SPOT_TUTTI).size).toBe(TIPI_SPOT_TUTTI.length);
  });
});

/**
 * Lo stesso elenco viveva ricopiato a mano in TRE rotte diverse:
 * submit-spot, admin/edit-spot e spots/[slug]. Tutte e tre respingevano
 * `transition` mentre le rispettive interfacce la offrivano — inclusa quella
 * admin, cioe' proprio lo strumento previsto per ricategorizzare i 60 spot
 * ancora marcati `street`.
 *
 * Questo test legge i file delle rotte e fallisce se qualcuno torna a
 * scrivere l'elenco a mano invece di derivarlo.
 */
describe('nessuna rotta ricopia gli elenchi a mano', () => {
  const ROTTE = [
    'app/api/submit-spot/route.ts',
    'app/api/admin/edit-spot/route.ts',
    'app/api/spots/[slug]/route.ts',
    'app/api/status-confirm/route.ts',
    'app/api/admin/update-status/route.ts',
  ];

  it.each(ROTTE)('%s deriva i valori validi da lib/constants', async (rotta) => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(rotta, 'utf8');

    /* Un z.enum([...]) con dentro delle stringhe letterali e' un elenco
       ricopiato. z.enum(COSTANTE) invece e' derivato. */
    const letterali = src.match(/z\.enum\(\s*\[\s*['"]/g);
    expect(letterali, `${rotta} ha un elenco scritto a mano dentro z.enum([...])`).toBeNull();
  });
});

/**
 * Il campo `type` faceva due domande insieme. Sui 118 spot pubblicati, 79
 * rispondevano a «dove sei» e 39 a «cosa c'e'» — e nessuno dei due gruppi
 * aveva l'altra meta'. Ora le domande sono due campi.
 */
describe('ostacoli — cosa c\'e\' sullo spot', () => {
  it('contiene i nomi che usano davvero i rider', () => {
    for (const o of ['rail', 'ledge', 'hubba', 'stairs', 'gap', 'bank',
                     'quarter', 'spine', 'box', 'kicker', 'manual_pad',
                     'wallride', 'pole_jam', 'curb', 'drop', 'flat']) {
      expect(OSTACOLI_TUTTI).toContain(o);
    }
  });

  it('ogni ostacolo ha etichetta ed emoji', () => {
    for (const o of OSTACOLI_TUTTI) {
      expect(OSTACOLI[o].label, `${o} senza etichetta`).toBeTruthy();
      expect(OSTACOLI[o].emoji, `${o} senza emoji`).toBeTruthy();
    }
  });

  it('nessun ostacolo duplicato', () => {
    expect(new Set(OSTACOLI_TUTTI).size).toBe(OSTACOLI_TUTTI.length);
  });

  it('i contesti non compaiono fra gli ostacoli', () => {
    /* `street` e `park` dicono dove sei, non cosa c'e'. Se finissero anche
       qui torneremmo alla confusione che stiamo smontando. */
    for (const c of ['street', 'park', 'plaza', 'diy', 'trail', 'pumptrack']) {
      expect(OSTACOLI_TUTTI).not.toContain(c);
    }
  });

  it('la migration sposta i 39 spot filati per ostacolo', async () => {
    /* La migration mappa rail/ledge/gap/bowl da `type` a `ostacoli`, e
       transition in bank+quarter. Tutti quei valori devono esistere fra gli
       ostacoli, altrimenti la migration scriverebbe dati non validi. */
    for (const o of ['rail', 'ledge', 'gap', 'bowl', 'bank', 'quarter']) {
      expect(OSTACOLI_TUTTI, `la migration scrive "${o}" ma non e' un ostacolo valido`).toContain(o);
    }
  });
});

/**
 * La schermata Contesti (components/AdminContesti.tsx) mostra un bottone per
 * ogni valore di TIPI_SPOT_SELEZIONABILI e scrive con /api/admin/edit-spot,
 * che valida su TIPI_SPOT_TUTTI.
 *
 * Se le due liste divergessero, un bottone della schermata darebbe errore al
 * clic — esattamente il bug del 19/08, ma dentro l'admin. Questo test lo
 * impedisce.
 */
describe('schermata Contesti — ogni bottone deve funzionare', () => {
  it('ogni contesto offerto e\' accettato da edit-spot', () => {
    for (const [t] of TIPI_SPOT_SELEZIONABILI) {
      expect(TIPI_SPOT_TUTTI, `il bottone "${t}" darebbe errore al clic`).toContain(t);
    }
  });

  it('i valori da sistemare esistono ancora, altrimenti la coda e\' sempre vuota', () => {
    /* La schermata cerca gli spot con questi `type`. Se venissero tolti da
       TIPI_SPOT prima di aver assegnato i contesti, la coda risulterebbe
       vuota e quei 39 spot resterebbero orfani senza che nessuno se ne
       accorga. */
    for (const t of ['rail', 'ledge', 'gap', 'bowl', 'transition']) {
      expect(TIPI_SPOT_TUTTI, `"${t}" tolto troppo presto`).toContain(t);
    }
  });
});
