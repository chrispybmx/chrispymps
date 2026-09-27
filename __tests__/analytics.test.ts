import { describe, it, expect } from 'vitest';
import { pulisciEventoAnalytics } from '@/lib/analytics';
const evento = (url: string) => ({ type: 'pageview' as const, url });
describe('statistiche delle visite', () => {
  it('conta le pagine pubbliche senza parametri né frammento', () => expect(pulisciEventoAnalytics(evento('https://maps.chrispybmx.com/map/spot/roma?q=rail#commenti'))?.url).toBe('https://maps.chrispybmx.com/map/spot/roma'));
  it('conserva solo i parametri utm dei post', () => expect(pulisciEventoAnalytics(evento('https://maps.chrispybmx.com/map?utm_source=instagram&utm_campaign=reel&add=1'))?.url).toBe('https://maps.chrispybmx.com/map?utm_source=instagram&utm_campaign=reel'));
  it.each([
    'https://maps.chrispybmx.com/auth/confirm?token_hash=pkce_segreto&type=recovery',
    'https://maps.chrispybmx.com/auth/reset-password',
    'https://maps.chrispybmx.com/newsletter/conferma#f172f5326c6505813b84a4e0a2c5cf9e60f8ebcf7be4251274e7621d234db565',
    'https://maps.chrispybmx.com/admin',
  ])('non registra le pagine con token o riservate %s', url => expect(pulisciEventoAnalytics(evento(url))).toBeNull());
  it('scarta un indirizzo non leggibile invece di inviarlo', () => expect(pulisciEventoAnalytics(evento('non-un-url'))).toBeNull());
});
