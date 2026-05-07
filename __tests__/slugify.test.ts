import { describe, it, expect } from 'vitest';
import { slugify, spotSlug, citySlug } from '@/lib/slugify';

describe('slugify', () => {
  it('lowercase e spazi → trattini', () => {
    expect(slugify('Piazza Bra')).toBe('piazza-bra');
  });

  it('caratteri italiani rimossi correttamente', () => {
    expect(slugify('Reggio Emilià')).toBe('reggio-emilia');
    expect(slugify('Città di Verona')).toBe('citta-di-verona');
    expect(slugify('Èspresso')).toBe('espresso');
    expect(slugify('Ùltimo')).toBe('ultimo');
  });

  it('trattini multipli → singolo', () => {
    expect(slugify('hello---world')).toBe('hello-world');
  });

  it('trattini iniziali/finali rimossi', () => {
    expect(slugify('  hello  ')).toBe('hello');
  });

  it('caratteri speciali rimossi', () => {
    expect(slugify('hello!@#world')).toBe('helloworld');
  });

  it('stringa vuota → stringa vuota', () => {
    expect(slugify('')).toBe('');
  });

  it('numeri preservati', () => {
    expect(slugify('spot 42')).toBe('spot-42');
  });
});

describe('spotSlug', () => {
  it('formato nome-città-id6char', () => {
    const result = spotSlug('Piazza Bra', 'Verona', '3f2a1c-0000-0000-0000-000000000000');
    expect(result).toBe('piazza-bra-verona-3f2a1c');
  });

  it('senza città → usa "italy"', () => {
    const result = spotSlug('Spot Test', undefined, 'abcdef-0000-0000-0000-000000000000');
    expect(result).toBe('spot-test-italy-abcdef');
  });

  it('id con trattini → rimossi per la parte id', () => {
    const result = spotSlug('Rail spot', 'Milano', 'aa-bb-cc-dd-ee');
    expect(result).toMatch(/^rail-spot-milano-/);
    // parte id = 'aabbccddeee'.slice(0,6) = 'aabbcc'
    expect(result).toBe('rail-spot-milano-aabbcc');
  });
});

describe('citySlug', () => {
  it('Reggio Calabria → reggio-calabria', () => {
    expect(citySlug('Reggio Calabria')).toBe('reggio-calabria');
  });

  it("Valle d'Aosta → valle-daosta", () => {
    expect(citySlug("Valle d'Aosta")).toBe('valle-daosta');
  });
});
