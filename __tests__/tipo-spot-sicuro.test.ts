import { describe, expect, it } from 'vitest';
import { tipoSpot, condizioneSpot, TIPI_SPOT, CONDIZIONI } from '@/lib/constants';

describe('lettura sicura di tipo e condizione', () => {
  it('restituisce il valore vero per i tipi esistenti', () => {
    expect(tipoSpot('trail')).toBe(TIPI_SPOT.trail);
    expect(condizioneSpot('alive')).toBe(CONDIZIONI.alive);
  });

  it('non va in crash con un tipo che non esiste piu', () => {
    // Lo spot di prova `race` del 13 ottobre bloccava tutta la dashboard admin.
    expect(tipoSpot('race').color).toBeTruthy();
    expect(tipoSpot('race').label).toBe('Sconosciuto');
    expect(tipoSpot(undefined).label).toBe('Sconosciuto');
    expect(condizioneSpot('boh').bg).toBeTruthy();
    expect(condizioneSpot(null).label).toBe('Sconosciuta');
  });
});
