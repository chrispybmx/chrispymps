/**
 * Rate limiting con backing persistente opzionale.
 *
 * - Se UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN sono presenti,
 *   usa Upstash via REST API (fetch puro, edge-native) → il limite è condiviso
 *   fra tutte le istanze serverless.
 * - Altrimenti fallback in-memory (Map per-istanza), identico al comportamento
 *   storico. Su Redis error si ricade sul fallback: il rate limit non deve
 *   mai bloccare una richiesta legittima per colpa dell'infrastruttura.
 *
 * Algoritmo: finestra fissa (fixed window) in entrambi i path.
 * Nessuna dipendenza esterna: usa solo fetch (compatibile Edge Runtime).
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// ── Upstash REST (opzionale) ──
const REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const useRedis = Boolean(REST_URL && REST_TOKEN);

interface UpstashResult { result?: unknown; error?: string }

/** Esegue una pipeline di comandi Redis via REST. Lancia su errore di rete/HTTP. */
async function redisPipeline(commands: (string | number)[][]): Promise<UpstashResult[]> {
  const res = await fetch(`${REST_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return res.json() as Promise<UpstashResult[]>;
}

async function redisCheck(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`;
  // INCR (crea/incrementa) + PTTL (ms rimanenti) in un solo round-trip
  const [incr, pttl] = await redisPipeline([['INCR', redisKey], ['PTTL', redisKey]]);
  const count = Number(incr.result);
  const ttl = Number(pttl.result);

  let resetAt: number;
  if (count === 1 || ttl < 0) {
    // Prima richiesta della finestra (o chiave senza scadenza): imposta la finestra
    await redisPipeline([['PEXPIRE', redisKey, windowMs]]);
    resetAt = Date.now() + windowMs;
  } else {
    resetAt = Date.now() + ttl;
  }

  return {
    allowed: count <= maxRequests,
    remaining: Math.max(0, maxRequests - count),
    resetAt,
  };
}

// ── Fallback in-memory (per-istanza) ──
interface RateLimitEntry { count: number; resetAt: number }
const memStore = new Map<string, RateLimitEntry>();

function memCheck(key: string, maxRequests: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = memStore.get(key);

  if (!entry || now > entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

// Pulizia periodica del fallback in-memory (evita memory leak)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memStore.entries()) {
      if (now > entry.resetAt) memStore.delete(key);
    }
  }, 60_000);
}

/**
 * Controlla e incrementa il contatore per `key`.
 * Usa Upstash se configurato, altrimenti store in-memory.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (useRedis) {
    try {
      return await redisCheck(key, maxRequests, windowMs);
    } catch {
      // Redis non raggiungibile → fallback in-memory, non blocchiamo la richiesta
      return memCheck(key, maxRequests, windowMs);
    }
  }
  return memCheck(key, maxRequests, windowMs);
}
