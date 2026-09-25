import { describe, expect, it } from 'vitest';
import { formatSpotDate, difficultyText, conditionText } from '@/lib/spot-trust';
import { getFreshness } from '@/lib/freshness';
const NOW = new Date('2026-09-25T12:00:00Z');
const ago = (days: number) => new Date(NOW.getTime() - days * 86400000).toISOString();
describe('honest, readable spot dates', () => {
  it('omits dates that are missing or unreadable', () => {
    expect(formatSpotDate(null)).toBeNull(); expect(formatSpotDate('invalid')).toBeNull(); expect(formatSpotDate(undefined)).toBeNull();
  });
  it('uses a stable upload date across server/browser time zones, in the chosen language', () => {
    expect(formatSpotDate('2026-09-25T23:30:00-04:00')).toBe('26 set 2026');
    expect(formatSpotDate('2026-09-25T23:30:00-04:00', 'en')).toBe('26 Sept 2026');
  });
  it('never abbreviates months as m or years as a', () => {
    expect(getFreshness('alive', ago(150), NOW).short).toBe('5 mesi fa');
    expect(getFreshness('alive', ago(150), NOW, 'en').short).toBe('5 months ago');
    expect(getFreshness('alive', ago(400), NOW).short).toBe('oltre un anno fa');
    expect(getFreshness('alive', ago(800), NOW).short).toBe('2 anni fa');
  });
  it('distinguishes missing confirmation from today and uses singular day correctly', () => {
    expect(getFreshness('alive', null, NOW).short).toBe('Da confermare');
    expect(getFreshness('alive', ago(0), NOW).short).toBe('oggi');
    expect(getFreshness('alive', ago(1), NOW).short).toBe('1 giorno fa');
    expect(getFreshness('alive', ago(1), NOW, 'en').short).toBe('1 day ago');
  });
  it('localizes known conditions/difficulties without inventing missing facts', () => {
    expect(difficultyText(undefined)).toBeNull(); expect(difficultyText('intermediate', 'en')).toBe('Intermediate');
    expect(conditionText('alive', 'en')).toBe('Rideable'); expect(difficultyText('local-value')).toBe('local-value');
  });
});
