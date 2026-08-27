import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createHmac } from 'node:crypto';

// next/headers importa 'server-only' → mockiamo cookies() per poter testare in node.
const { cookieGet } = vi.hoisted(() => ({ cookieGet: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: () => ({ get: cookieGet }),
}));

import {
  loginAdmin,
  isAdminAuthenticated,
  adminSessionCookieHeader,
  clearAdminCookieHeader,
  generateApproveToken,
  verifyApproveToken,
  generateRejectToken,
  verifyRejectToken,
} from '@/lib/auth';

const PASSWORD = 'correct-horse-battery';
const UUID = '123e4567-e89b-12d3-a456-426614174000';

beforeAll(() => {
  process.env.ADMIN_SECRET = 'test-secret-at-least-32-characters-long-000';
  process.env.ADMIN_PASSWORD = PASSWORD;
});

describe('loginAdmin', () => {
  it('accetta la password corretta e ritorna un token', () => {
    const res = loginAdmin(PASSWORD);
    expect(res.success).toBe(true);
    expect(res.token).toMatch(/^\d+\.[0-9a-f]{64}$/); // timestamp.hmac
  });

  it('rifiuta password sbagliata (stessa lunghezza)', () => {
    expect(loginAdmin('correct-horse-XXXXXXX').success).toBe(false);
  });

  it('rifiuta password di lunghezza diversa (no timing leak)', () => {
    expect(loginAdmin('x').success).toBe(false);
    expect(loginAdmin('').success).toBe(false);
  });
});

describe('isAdminAuthenticated', () => {
  it('false se manca il cookie', () => {
    cookieGet.mockReturnValueOnce(undefined);
    expect(isAdminAuthenticated()).toBe(false);
  });

  it('false se il cookie è spazzatura', () => {
    cookieGet.mockReturnValueOnce({ value: 'garbage.token' });
    expect(isAdminAuthenticated()).toBe(false);
  });

  it('true con un token di sessione valido appena emesso', () => {
    const { token } = loginAdmin(PASSWORD);
    cookieGet.mockReturnValueOnce({ value: token });
    expect(isAdminAuthenticated()).toBe(true);
  });
});

describe('cookie headers', () => {
  it('il cookie sessione è HttpOnly + SameSite=Strict', () => {
    const h = adminSessionCookieHeader('abc.def');
    expect(h).toContain('cmps_admin_session=abc.def');
    expect(h).toContain('HttpOnly');
    expect(h).toContain('SameSite=Strict');
    expect(h).toContain('Path=/');
  });

  it('clear azzera il Max-Age', () => {
    expect(clearAdminCookieHeader()).toContain('Max-Age=0');
  });
});

describe('approve token', () => {
  it('round-trip: genera e verifica lo stesso spotId', () => {
    const token = generateApproveToken(UUID);
    expect(verifyApproveToken(token)).toBe(UUID);
  });

  it('rifiuta un token manomesso', () => {
    const token = generateApproveToken(UUID);
    const tampered = token.slice(0, -4) + 'AAAA';
    expect(verifyApproveToken(tampered)).toBeNull();
  });

  it('rifiuta un token scaduto', () => {
    const token = generateApproveToken(UUID);
    expect(verifyApproveToken(token, -1)).toBeNull();
  });

  it('rifiuta spazzatura', () => {
    expect(verifyApproveToken('not-a-token')).toBeNull();
  });
});

describe('reject token', () => {
  it('round-trip: genera e verifica lo stesso spotId', () => {
    const token = generateRejectToken(UUID);
    expect(verifyRejectToken(token)).toBe(UUID);
  });

  it('rifiuta un token manomesso', () => {
    const token = generateRejectToken(UUID);
    const tampered = token.slice(0, -4) + 'AAAA';
    expect(verifyRejectToken(tampered)).toBeNull();
  });

  it('rifiuta un token scaduto', () => {
    const token = generateRejectToken(UUID);
    expect(verifyRejectToken(token, -1)).toBeNull();
  });
});

describe('approve/reject token non sono intercambiabili (regression)', () => {
  it('un approve token non passa come reject e viceversa', () => {
    const approve = generateApproveToken(UUID);
    const reject = generateRejectToken(UUID);
    expect(verifyRejectToken(approve)).toBeNull();
    expect(verifyApproveToken(reject)).toBeNull();
  });
});

/**
 * Trovati da una revisione fatta con Codex il 26/08/2026.
 *
 * Il controllo della scadenza guardava solo `age > maxHours`. Mancavano due
 * casi che non rendono il token falsificabile — serve comunque il segreto —
 * ma allargano la finestra oltre quanto dichiarato.
 */
describe('scadenza token — casi limite', () => {
  const SEGRETO = 'test-secret-at-least-32-characters-long-000';

  it('un timestamp nel futuro non allunga la validita\'', () => {
    /* Un orologio sballato produrrebbe eta' negativa, che con il solo
       `age > maxHours` passava sempre. */
    const fraUnAnno = Date.now() + 365 * 24 * 60 * 60 * 1000;
    const payload = `11111111-1111-1111-1111-111111111111:${fraUnAnno}`;
    const sig = createHmac('sha256', SEGRETO)
      .update(payload).digest('hex');
    const token = Buffer.from(`${payload}:${sig}`).toString('base64url');
    expect(verifyApproveToken(token)).toBeNull();
  });

  it('un timestamp non numerico non passa', () => {
    /* parseInt('domani') da' NaN, e ogni confronto con NaN e' falso: il
       controllo `age > maxHours` lasciava quindi passare. */
    const payload = '11111111-1111-1111-1111-111111111111:domani';
    const sig = createHmac('sha256', SEGRETO)
      .update(payload).digest('hex');
    const token = Buffer.from(`${payload}:${sig}`).toString('base64url');
    expect(verifyApproveToken(token)).toBeNull();
  });
});
