import { describe, it, expect } from 'vitest';
import { TIPI_SPOT, TIPI_SPOT_SELEZIONABILI, TIPI_SPOT_TUTTI } from '@/lib/constants';

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

  it('transition e\' accettata — era il caso rotto', () => {
    expect(selezionabili).toContain('transition');
    expect(TIPI_SPOT_TUTTI).toContain('transition');
  });

  it('street resta valida lato server pur non essendo piu\' scegliibile', () => {
    /* 60 spot su 118 sono catalogati cosi'. Toglierla dalla validazione
       spaccherebbe ogni modifica futura di quegli spot. */
    expect(TIPI_SPOT_TUTTI).toContain('street');
    expect(selezionabili).not.toContain('street');
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
