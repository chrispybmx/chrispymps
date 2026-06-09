/**
 * Guardie anti-SSRF.
 * Usate prima di ogni fetch server-side verso host risolti via DNS,
 * per evitare che un redirect punti a indirizzi interni/privati.
 */

/** True se l'IP (v4 o v6) è loopback, link-local o in un range privato. */
export function isPrivateIp(ip: string): boolean {
  // IPv6 loopback e link-local
  if (ip === '::1') return true;
  if (ip.toLowerCase().startsWith('fe80')) return true;
  // fc00::/7 → fc or fd prefix
  if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) return true;

  // IPv4
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p))) return false;

  const [a, b] = parts;
  if (a === 10) return true;                        // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true;          // 192.168.0.0/16
  if (a === 127) return true;                       // 127.0.0.0/8
  if (a === 169 && b === 254) return true;          // 169.254.0.0/16
  if (a === 0) return true;                         // 0.0.0.0/8

  return false;
}
