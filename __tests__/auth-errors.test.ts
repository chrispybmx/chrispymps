import { describe, it, expect } from 'vitest';
import { authErrorMessage, AUTH_ERROR_PARAM } from '@/lib/auth-errors';

describe('authErrorMessage', () => {
  it('non dice niente quando non c\'è errore', () => {
    expect(authErrorMessage(null)).toBeNull();
    expect(authErrorMessage(undefined)).toBeNull();
    expect(authErrorMessage('')).toBeNull();
  });

  it('spiega i codici che generiamo noi', () => {
    expect(authErrorMessage('oauth_failed')).toContain('scambio');
    expect(authErrorMessage('no_session')).toContain('cookie');
    expect(authErrorMessage('profile_failed')).toContain('profilo');
  });

  it('riconosce l\'annullamento dell\'utente senza allarmare', () => {
    const m = authErrorMessage('access_denied')!;
    expect(m).toBe('Accesso annullato su Google.');
    expect(m).not.toContain('non riuscito');
  });

  it('mostra comunque i codici sconosciuti di Google invece di tacere', () => {
    const m = authErrorMessage('qualcosa_di_nuovo')!;
    expect(m).toContain('qualcosa_di_nuovo');
    expect(m).toContain('email e password');
  });

  it('ogni messaggio offre una via di uscita o una spiegazione', () => {
    for (const code of ['oauth_failed', 'no_code', 'no_session', 'profile_failed']) {
      const m = authErrorMessage(code)!;
      expect(m.length).toBeGreaterThan(20);
      expect(m).toMatch(/riprova|prova|scrivimi/i);
    }
  });

  it('il nome del parametro è quello usato nel callback', () => {
    expect(AUTH_ERROR_PARAM).toBe('auth_error');
  });
});
