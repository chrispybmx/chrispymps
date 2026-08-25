import { describe, it, expect } from 'vitest';
import {
  TIPI_SPOT,
  TIPI_SPOT_SELEZIONABILI,
  CONDIZIONI,
  DIFFICOLTA,
  PALETTE,
  APP_CONFIG,
  DEBOUNCE_SEARCH_MS,
  DEBOUNCE_USERNAME_MS,
  GPS_TIMEOUT_MS,
  APPROVE_TOKEN_EXPIRES_HOURS,
} from '@/lib/constants';

describe('TIPI_SPOT', () => {
  it('contiene tutti i tipi attesi', () => {
    const tipi = Object.keys(TIPI_SPOT);
    expect(tipi).toContain('street');
    expect(tipi).toContain('transition');
    expect(tipi).toContain('park');
    expect(tipi).toContain('diy');
    expect(tipi).toContain('bowl');
    expect(tipi).toContain('pumptrack');
    expect(tipi).toHaveLength(11);
  });

  it('ogni tipo ha label, emoji e color', () => {
    for (const [, info] of Object.entries(TIPI_SPOT)) {
      expect(info.label).toBeTruthy();
      expect(info.emoji).toBeTruthy();
      expect(info.color).toMatch(/^#[0-9a-fA-F]{3,6}$/);
    }
  });
});

describe('CONDIZIONI', () => {
  it('ha alive, bustato, demolito', () => {
    expect(Object.keys(CONDIZIONI)).toEqual(['alive', 'bustato', 'demolito']);
  });
});

describe('DIFFICOLTA', () => {
  it('ha beginner, intermediate, pro in ordine', () => {
    expect(DIFFICOLTA.map(d => d.value)).toEqual(['beginner', 'intermediate', 'pro']);
  });
});

describe('PALETTE', () => {
  it('orange è #ff6a00', () => {
    expect(PALETTE.orange).toBe('#ff6a00');
  });
});

describe('APP_CONFIG', () => {
  it('url è il dominio di produzione', () => {
    expect(APP_CONFIG.url).toBe('https://maps.chrispybmx.com');
  });

  it('mapCenter è Italia (circa)', () => {
    const [lat, lon] = APP_CONFIG.mapCenter;
    expect(lat).toBeCloseTo(42.5, 0);
    expect(lon).toBeCloseTo(12.5, 0);
  });
});

describe('Timing constants', () => {
  it('DEBOUNCE_SEARCH_MS è 380', () => {
    expect(DEBOUNCE_SEARCH_MS).toBe(380);
  });

  it('DEBOUNCE_USERNAME_MS è 600', () => {
    expect(DEBOUNCE_USERNAME_MS).toBe(600);
  });

  it('GPS_TIMEOUT_MS è 10000', () => {
    expect(GPS_TIMEOUT_MS).toBe(10_000);
  });

  it('APPROVE_TOKEN_EXPIRES_HOURS è 72', () => {
    expect(APPROVE_TOKEN_EXPIRES_HOURS).toBe(72);
  });
});

describe('TIPI_SPOT_SELEZIONABILI', () => {
  /* Questo test difendeva la scelta opposta: «non offre street». Era nato da
     una diagnosi sbagliata — 60 spot su 116 marcati street letti come pigrizia
     invece che come la quantita' di street che semplicemente esiste. Street e'
     una macrocategoria come Park, e dentro ci stanno ledge, box, rail e scale.
     Toglierla dal selettore costringeva chi aggiungeva un vero spot street a
     scegliere un ostacolo al suo posto. */
  it('offre street: e\' una macrocategoria, non un ripiego', () => {
    const chiavi = TIPI_SPOT_SELEZIONABILI.map(([k]) => k);
    expect(chiavi).toContain('street');
  });

  it('offre solo contesti, non ostacoli', () => {
    /* `rail`, `bowl` e `transition` erano offerti come categorie. Ma sono
       ostacoli: dicono cosa c'e', non dove sei. Ora stanno nel campo
       `ostacoli`, e qui restano solo le risposte a «dove si gira». */
    const chiavi = TIPI_SPOT_SELEZIONABILI.map(([k]) => k);
    expect(chiavi).toEqual(['street', 'park', 'plaza', 'diy', 'trail', 'pumptrack']);
  });

  it('esclude esattamente i valori senza contesto: true', () => {
    /* I valori senza `contesto` sono ostacoli rimasti nel campo `type` di 39
       spot. Restano in TIPI_SPOT per non far esplodere TIPI_SPOT[spot.type],
       ma non si possono piu' scegliere. */
    const senzaContesto = (Object.entries(TIPI_SPOT) as [string, { contesto?: boolean }][])
      .filter(([, i]) => i.contesto !== true).map(([k]) => k);
    expect(senzaContesto).toEqual(['transition', 'rail', 'ledge', 'gap', 'bowl']);
    expect(TIPI_SPOT_SELEZIONABILI).toHaveLength(Object.keys(TIPI_SPOT).length - senzaContesto.length);
    for (const k of senzaContesto) {
      expect(TIPI_SPOT_SELEZIONABILI.map(([x]) => x)).not.toContain(k);
    }
  });

  it('street resta valido per gli spot già catalogati e per i filtri', () => {
    expect(TIPI_SPOT.street).toBeDefined();
    expect(TIPI_SPOT.street.label).toBe('Street');
  });
});
