import { describe, it, expect } from 'vitest';
import {
  calcolaEta,
  puoRicevereMarketing,
  fasciaEta,
  normalizzaDiscipline,
  normalizzaAnnoInizio,
  anniDiEsperienza,
  fasciaEsperienza,
  ETA_MINIMA_MARKETING,
} from '@/lib/rider-profile';

const OGGI = new Date('2026-08-21T12:00:00Z');

/** Data di nascita di chi compie `anni` esattamente oggi. */
function natoAnniFa(anni: number, spostaGiorni = 0): string {
  const d = new Date(OGGI);
  d.setFullYear(d.getFullYear() - anni);
  d.setDate(d.getDate() + spostaGiorni);
  return d.toISOString().slice(0, 10);
}

describe('calcolaEta', () => {
  it('conta gli anni compiuti', () => {
    expect(calcolaEta(natoAnniFa(20), OGGI)).toBe(20);
  });

  it('il giorno del compleanno l\'anno è già compiuto', () => {
    expect(calcolaEta(natoAnniFa(16), OGGI)).toBe(16);
  });

  it('il giorno prima del compleanno non lo è ancora', () => {
    expect(calcolaEta(natoAnniFa(16, 1), OGGI)).toBe(15);
  });

  it('data mancante o illeggibile → null', () => {
    expect(calcolaEta(null, OGGI)).toBeNull();
    expect(calcolaEta(undefined, OGGI)).toBeNull();
    expect(calcolaEta('non-una-data', OGGI)).toBeNull();
  });

  it('data nel futuro → null, non un\'età negativa', () => {
    expect(calcolaEta('2030-01-01', OGGI)).toBeNull();
  });
});

describe('puoRicevereMarketing', () => {
  it('a 16 anni compiuti sì', () => {
    expect(puoRicevereMarketing(natoAnniFa(ETA_MINIMA_MARKETING), OGGI)).toBe(true);
  });

  it('il giorno prima dei 16 no', () => {
    expect(puoRicevereMarketing(natoAnniFa(ETA_MINIMA_MARKETING, 1), OGGI)).toBe(false);
  });

  it('un tredicenne no', () => {
    expect(puoRicevereMarketing(natoAnniFa(13), OGGI)).toBe(false);
  });

  it('senza data di nascita NON si spedisce: nel dubbio si tace', () => {
    expect(puoRicevereMarketing(null, OGGI)).toBe(false);
    expect(puoRicevereMarketing('', OGGI)).toBe(false);
    expect(puoRicevereMarketing('spazzatura', OGGI)).toBe(false);
  });
});

describe('fasciaEta', () => {
  it('raggruppa come le userebbe uno sponsor', () => {
    expect(fasciaEta(natoAnniFa(12), OGGI)).toBe('under 14');
    expect(fasciaEta(natoAnniFa(15), OGGI)).toBe('14-17');
    expect(fasciaEta(natoAnniFa(21), OGGI)).toBe('18-24');
    expect(fasciaEta(natoAnniFa(30), OGGI)).toBe('25-34');
    expect(fasciaEta(natoAnniFa(40), OGGI)).toBe('35-44');
    expect(fasciaEta(natoAnniFa(52), OGGI)).toBe('45+');
  });

  it('senza data non inventa una fascia', () => {
    expect(fasciaEta(null, OGGI)).toBeNull();
  });
});

describe('normalizzaDiscipline', () => {
  it('tiene solo le discipline vere', () => {
    expect(normalizzaDiscipline(['bmx', 'skate'])).toEqual(['bmx', 'skate']);
  });

  it('scarta valori inventati', () => {
    expect(normalizzaDiscipline(['bmx', 'parkour', 42, null])).toEqual(['bmx']);
  });

  it('toglie i doppioni', () => {
    expect(normalizzaDiscipline(['bmx', 'bmx', 'skate'])).toEqual(['bmx', 'skate']);
  });

  it('niente di valido → null, non un array vuoto', () => {
    expect(normalizzaDiscipline([])).toBeNull();
    expect(normalizzaDiscipline(['boh'])).toBeNull();
    expect(normalizzaDiscipline('bmx')).toBeNull();
    expect(normalizzaDiscipline(null)).toBeNull();
  });
});

describe('anno di inizio — dato vero, non fascia', () => {
  it('accetta un anno plausibile, anche scritto come stringa', () => {
    expect(normalizzaAnnoInizio(2019, OGGI)).toBe(2019);
    expect(normalizzaAnnoInizio('2019', OGGI)).toBe(2019);
  });

  it('rifiuta il futuro e la preistoria', () => {
    expect(normalizzaAnnoInizio(2030, OGGI)).toBeNull();
    expect(normalizzaAnnoInizio(1950, OGGI)).toBeNull();
  });

  it('rifiuta ciò che non è un anno', () => {
    expect(normalizzaAnnoInizio('da sempre', OGGI)).toBeNull();
    expect(normalizzaAnnoInizio(null, OGGI)).toBeNull();
    expect(normalizzaAnnoInizio(2019.5, OGGI)).toBeNull();
  });

  it('calcola gli anni di esperienza', () => {
    expect(anniDiEsperienza(2019, OGGI)).toBe(7);
    expect(anniDiEsperienza(OGGI.getFullYear(), OGGI)).toBe(0);
    expect(anniDiEsperienza(null, OGGI)).toBeNull();
  });

  it('la fascia si ricava dall\'anno, non viceversa', () => {
    expect(fasciaEsperienza(OGGI.getFullYear(), OGGI)).toBe('meno di 1 anno');
    expect(fasciaEsperienza(2024, OGGI)).toBe('1-3 anni');
    expect(fasciaEsperienza(2019, OGGI)).toBe('3-10 anni');
    expect(fasciaEsperienza(2005, OGGI)).toBe('oltre 10 anni');
  });
});
