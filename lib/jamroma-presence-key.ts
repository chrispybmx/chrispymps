import { createHash } from 'node:crypto';

/* L'id vero di una riga anonima serve a cancellarla (DELETE ?id=): e' la sola
   prova che la riga appartiene a chi la chiede. Il GET pubblico quindi mostra
   un hash, utile solo come chiave di lista, da cui l'id non si ricava. */
export function publicPresenceKey(id: string): string {
  return createHash('sha256').update(`jamroma-presence:${id}`).digest('hex').slice(0, 16);
}
