/* Campi di `spots` che non devono mai uscire dal server: le note di
   moderazione e l'id del contributor (riga con email in `contributors`).
   Le query pubbliche usano select('*') perché lo schema in produzione può
   essere indietro rispetto alle migration: togliere qui i campi interni è
   più sicuro che elencare colonne che potrebbero non esistere. */
const PRIVATE_SPOT_FIELDS = ['reviewer_notes', 'submitted_by'] as const;

type PrivateSpotField = typeof PRIVATE_SPOT_FIELDS[number];

export function toPublicSpot<T extends object>(row: T): Omit<T, PrivateSpotField> {
  const copy = { ...row } as Record<string, unknown>;
  for (const field of PRIVATE_SPOT_FIELDS) delete copy[field];
  return copy as Omit<T, PrivateSpotField>;
}
