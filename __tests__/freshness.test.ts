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

describe('getFreshness — uno spot fisico non scade in pochi mesi', () => {
  it('appena confermato', () => {
    expect(getFreshness('alive', daysAgo(0), NOW).label).toBe('Confermato da poco');
  });

  it('entro il mese resta verde', () => {
    const f = getFreshness('alive', daysAgo(20), NOW);
    expect(f.tone).toBe('fresh');
    expect(f.label).toBe('Confermato 20 giorni fa');
  });

  it('a tre mesi NON e\' un allarme: un ledge sta li\'', () => {
    const f = getFreshness('alive', daysAgo(90), NOW);
    expect(f.tone).toBe('ok');
    expect(f.label).toBe('Confermato 3 mesi fa');
  });

  it('a undici mesi ancora nessun allarme', () => {
    expect(getFreshness('alive', daysAgo(330), NOW).tone).toBe('ok');
  });

  it('oltre l\'anno comincia a invecchiare', () => {
    const f = getFreshness('alive', daysAgo(400), NOW);
    expect(f.tone).toBe('aging');
    expect(f.label).toBe('Confermato piu\' di un anno fa');
  });

  it('oltre i due anni chiede davvero una conferma', () => {
    const f = getFreshness('alive', daysAgo(800), NOW);
    expect(f.tone).toBe('stale');
    expect(f.label).toContain('2 anni');
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
  it('non chiede conferma per mesi: non ci sarebbe niente da confermare', () => {
    expect(needsConfirmation(getFreshness('alive', daysAgo(3), NOW))).toBe(false);
    expect(needsConfirmation(getFreshness('alive', daysAgo(90), NOW))).toBe(false);
    expect(needsConfirmation(getFreshness('alive', daysAgo(330), NOW))).toBe(false);
  });

  it('chiede conferma oltre l\'anno', () => {
    expect(needsConfirmation(getFreshness('alive', daysAgo(400), NOW))).toBe(true);
    expect(needsConfirmation(getFreshness('alive', daysAgo(800), NOW))).toBe(true);
  });
});
