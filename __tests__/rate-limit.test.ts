import { describe, it, expect } from 'vitest';
import { checkRateLimit } from '@/lib/rate-limit';

// Senza env Upstash → path in-memory (fixed window).

describe('checkRateLimit — fallback in-memory', () => {
  it('permette fino al limite, poi blocca', async () => {
    const key = `test-block-${Math.random()}`;
    const max = 3;
    const r1 = await checkRateLimit(key, max, 60_000);
    const r2 = await checkRateLimit(key, max, 60_000);
    const r3 = await checkRateLimit(key, max, 60_000);
    const r4 = await checkRateLimit(key, max, 60_000);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r4.allowed).toBe(false); // 4° supera max=3
  });

  it('decrementa remaining ad ogni richiesta', async () => {
    const key = `test-remaining-${Math.random()}`;
    const r1 = await checkRateLimit(key, 5, 60_000);
    const r2 = await checkRateLimit(key, 5, 60_000);
    expect(r1.remaining).toBe(4);
    expect(r2.remaining).toBe(3);
  });

  it('chiavi diverse sono indipendenti', async () => {
    const a = `test-a-${Math.random()}`;
    const b = `test-b-${Math.random()}`;
    await checkRateLimit(a, 1, 60_000); // esaurisce a
    const aBlocked = await checkRateLimit(a, 1, 60_000);
    const bFresh = await checkRateLimit(b, 1, 60_000);
    expect(aBlocked.allowed).toBe(false);
    expect(bFresh.allowed).toBe(true);
  });

  it('resetAt è nel futuro', async () => {
    const key = `test-reset-${Math.random()}`;
    const r = await checkRateLimit(key, 5, 60_000);
    expect(r.resetAt).toBeGreaterThan(Date.now());
  });
});
