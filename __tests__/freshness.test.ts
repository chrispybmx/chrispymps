import { describe, it, expect } from 'vitest';
import { getFreshness, needsConfirmation } from '@/lib/freshness';

const NOW = new Date('2026-08-19T12:00:00Z');

/** ISO di `days` giorni prima di NOW. */
function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

describe('getFreshness — condizioni dichiarate', () => {
  it('demolito non invecchia', () => {
    const f = getFreshness('demolito', daysAgo(900), NOW);
    expect(f.tone).toBe('dead');
    expect(f.label).toBe('Demolito');
    expect(f.days).toBeNull();
  });

  it('bustato non invecchia', () => {
    const f = getFreshness('bustato', daysAgo(400), NOW);
    expect(f.tone).toBe('stale');
    expect(f.label).toBe('Bustato');
  });
});

describe('getFreshness — decadimento di uno spot alive', () => {
  it('oggi', () => {
    expect(getFreshness('alive', daysAgo(0), NOW).label).toBe('Confermato oggi');
  });

  it('ieri', () => {
    expect(getFreshness('alive', daysAgo(1), NOW).label).toBe('Confermato ieri');
  });

  it('entro due settimane resta fresh', () => {
    const f = getFreshness('alive', daysAgo(9), NOW);
    expect(f.tone).toBe('fresh');
    expect(f.label).toBe('Confermato 9 giorni fa');
    expect(f.short).toBe('9g');
  });

  it('un mese → settimane, tono ok', () => {
    const f = getFreshness('alive', daysAgo(28), NOW);
    expect(f.tone).toBe('ok');
    expect(f.label).toBe('Confermato 4 settimane fa');
  });

  it('tre mesi → aging', () => {
    const f = getFreshness('alive', daysAgo(90), NOW);
    expect(f.tone).toBe('aging');
    expect(f.label).toBe('Ultima conferma 3 mesi fa');
  });

  it('otto mesi → stale, il testo cambia registro', () => {
    const f = getFreshness('alive', daysAgo(240), NOW);
    expect(f.tone).toBe('stale');
    expect(f.label).toBe('Nessuno conferma da 8 mesi');
  });

  it('oltre un anno → dead', () => {
    const f = getFreshness('alive', daysAgo(500), NOW);
    expect(f.tone).toBe('dead');
    expect(f.label).toBe('Nessuno passa da oltre un anno');
  });

  it('oltre due anni pluralizza gli anni', () => {
    expect(getFreshness('alive', daysAgo(800), NOW).label).toBe('Nessuno passa da oltre 2 anni');
  });

  it('singolare corretto a una settimana e a un mese', () => {
    expect(getFreshness('alive', daysAgo(16), NOW).label).toBe('Confermato 2 settimane fa');
    expect(getFreshness('alive', daysAgo(63), NOW).label).toBe('Ultima conferma 2 mesi fa');
  });
});

describe('getFreshness — input mancante o rotto', () => {
  it('data assente', () => {
    const f = getFreshness('alive', null, NOW);
    expect(f.label).toBe('Stato non confermato');
    expect(f.days).toBeNull();
  });

  it('data non parsabile', () => {
    expect(getFreshness('alive', 'non-una-data', NOW).tone).toBe('dead');
  });

  it('data nel futuro non produce giorni negativi', () => {
    const future = new Date(NOW.getTime() + 5 * 86_400_000).toISOString();
    expect(getFreshness('alive', future, NOW).days).toBe(0);
  });
});

describe('needsConfirmation', () => {
  it('non chiede conferma su spot freschi', () => {
    expect(needsConfirmation(getFreshness('alive', daysAgo(3), NOW))).toBe(false);
    expect(needsConfirmation(getFreshness('alive', daysAgo(30), NOW))).toBe(false);
  });

  it('chiede conferma da tre mesi in poi', () => {
    expect(needsConfirmation(getFreshness('alive', daysAgo(120), NOW))).toBe(true);
    expect(needsConfirmation(getFreshness('alive', daysAgo(400), NOW))).toBe(true);
  });
});
