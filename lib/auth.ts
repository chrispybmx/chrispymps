import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';

const SESSION_COOKIE = 'cmps_admin_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 giorni

function getSecret(): string {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error('ADMIN_SECRET non impostato nelle variabili di ambiente');
  return secret;
}

function getAdminPassword(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) throw new Error('ADMIN_PASSWORD non impostata nelle variabili di ambiente');
  return pw;
}

/** Genera un token HMAC firmato con timestamp */
function generateToken(): string {
  const timestamp = Date.now().toString();
  const hmac = createHmac('sha256', getSecret())
    .update(timestamp)
    .digest('hex');
  return `${timestamp}.${hmac}`;
}

/** Verifica che un token HMAC sia valido e non scaduto */
function verifyToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [timestamp, signature] = parts;

  // Controlla scadenza (7 giorni)
  const age = Date.now() - parseInt(timestamp);
  if (age > SESSION_MAX_AGE * 1000) return false;

  // Verifica firma — timing-safe per evitare timing attacks
  const expected = createHmac('sha256', getSecret())
    .update(timestamp)
    .digest('hex');

  try {
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Controlla se la richiesta corrente ha una sessione admin valida.
 * Da usare nelle Server Components e Route Handlers.
 */
export function isAdminAuthenticated(): boolean {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return false;
    return verifyToken(token);
  } catch {
    return false;
  }
}

/**
 * Verifica la password e, se corretta, imposta il cookie sessione.
 * Restituisce true se ok.
 */
export function loginAdmin(password: string): { success: boolean; token?: string } {
  const adminPw = getAdminPassword();

  // Confronto timing-safe: i buffer DEVONO avere la stessa lunghezza
  // altrimenti timingSafeEqual lancia eccezione, rivelando la lunghezza attesa
  let match = false;
  const bufA = Buffer.from(password);
  const bufB = Buffer.from(adminPw);
  if (bufA.length === bufB.length) {
    try {
      match = timingSafeEqual(bufA, bufB);
    } catch {
      match = false;
    }
  }
  // Se le lunghezze differiscono: match resta false
  // Non usare return anticipato: manteniamo il tempo di esecuzione costante
  if (!match) return { success: false };

  const token = generateToken();
  return { success: true, token };
}

/** Header per impostare il cookie admin */
export function adminSessionCookieHeader(token: string): string {
  const maxAge = SESSION_MAX_AGE;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

/** Header per cancellare il cookie admin */
export function clearAdminCookieHeader(): string {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

/**
 * Genera un token di approvazione spot (link email).
 * Il token contiene: spotId + timestamp, firmato HMAC.
 */
export function generateApproveToken(spotId: string): string {
  const timestamp = Date.now().toString();
  const payload = `${spotId}:${timestamp}`;
  const sig = createHmac('sha256', getSecret()).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

/**
 * Verifica e decodifica un token di approvazione.
 * Restituisce lo spotId se valido, null altrimenti.
 */
export function verifyApproveToken(token: string, maxHours = 72): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const parts = decoded.split(':');
    if (parts.length !== 3) return null;
    const [spotId, timestamp, sig] = parts;

    // Scadenza
    const age = (Date.now() - parseInt(timestamp)) / (1000 * 60 * 60);
    if (age > maxHours) return null;

    // Verifica firma
    const payload = `${spotId}:${timestamp}`;
    const expected = createHmac('sha256', getSecret()).update(payload).digest('hex');
    if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;

    return spotId;
  } catch {
    return null;
  }
}
