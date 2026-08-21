/**
 * Dati del rider: discipline, esperienza, età.
 *
 * Logica pura, senza dipendenze: la usano il form di registrazione, la
 * schermata "personalizza" e le API. Le regole sull'età stanno qui e in un
 * posto solo, perché una regola sui minorenni sparsa in tre file è una regola
 * che prima o poi viene applicata in due.
 */

/** Sotto questa età non parte nessuna comunicazione promozionale. */
export const ETA_MINIMA_MARKETING = 16;

export const DISCIPLINE = [
  { key: 'bmx',     label: 'BMX',     emoji: '🚲' },
  { key: 'skate',   label: 'Skate',   emoji: '🛹' },
  { key: 'scooter', label: 'Scooter', emoji: '🛴' },
  { key: 'altro',   label: 'Altro',   emoji: '✨' },
] as const;

export type DisciplinaKey = typeof DISCIPLINE[number]['key'];

const CHIAVI_DISCIPLINA: readonly string[] = DISCIPLINE.map(d => d.key);

/** Anno più lontano accettato come inizio: prima è quasi certamente un errore. */
export const ANNO_INIZIO_MINIMO = 1970;

/**
 * Età compiuta a una certa data.
 * @param birthDate 'YYYY-MM-DD' oppure Date
 * @returns anni compiuti, o null se la data non è leggibile
 */
export function calcolaEta(birthDate: string | Date | null | undefined, oggi: Date = new Date()): number | null {
  if (!birthDate) return null;
  const d = birthDate instanceof Date ? birthDate : new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() > oggi.getTime()) return null;

  let eta = oggi.getFullYear() - d.getFullYear();
  const compleannoPassato =
    oggi.getMonth() > d.getMonth() ||
    (oggi.getMonth() === d.getMonth() && oggi.getDate() >= d.getDate());
  if (!compleannoPassato) eta--;
  return eta;
}

/**
 * Può ricevere comunicazioni promozionali?
 * Data mancante o illeggibile → NO: nel dubbio non si spedisce.
 */
export function puoRicevereMarketing(birthDate: string | Date | null | undefined, oggi: Date = new Date()): boolean {
  const eta = calcolaEta(birthDate, oggi);
  if (eta === null) return false;
  return eta >= ETA_MINIMA_MARKETING;
}

/** Fascia d'età per le statistiche aggregate del media kit. */
export function fasciaEta(birthDate: string | Date | null | undefined, oggi: Date = new Date()): string | null {
  const eta = calcolaEta(birthDate, oggi);
  if (eta === null) return null;
  if (eta < 14) return 'under 14';
  if (eta <= 17) return '14-17';
  if (eta <= 24) return '18-24';
  if (eta <= 34) return '25-34';
  if (eta <= 44) return '35-44';
  return '45+';
}

/** Tiene solo le discipline valide, senza duplicati. Array vuoto → null. */
export function normalizzaDiscipline(input: unknown): DisciplinaKey[] | null {
  if (!Array.isArray(input)) return null;
  const pulite = [...new Set(
    input.filter((x): x is string => typeof x === 'string' && CHIAVI_DISCIPLINA.includes(x)),
  )] as DisciplinaKey[];
  return pulite.length ? pulite : null;
}

/**
 * Anno di inizio plausibile, altrimenti null.
 * Teniamo l'anno vero invece di una fascia: da un anno si ricava la fascia,
 * dalla fascia non si torna indietro.
 */
export function normalizzaAnnoInizio(input: unknown, oggi: Date = new Date()): number | null {
  const n = typeof input === 'number' ? input : Number.parseInt(String(input ?? ''), 10);
  if (!Number.isInteger(n)) return null;
  if (n < ANNO_INIZIO_MINIMO || n > oggi.getFullYear()) return null;
  return n;
}

/** Da quanti anni gira. Null se non l'ha detto. */
export function anniDiEsperienza(annoInizio: number | null | undefined, oggi: Date = new Date()): number | null {
  if (!annoInizio) return null;
  return Math.max(0, oggi.getFullYear() - annoInizio);
}

/** Raggruppamento per le statistiche aggregate. Il dato vero resta l'anno. */
export function fasciaEsperienza(annoInizio: number | null | undefined, oggi: Date = new Date()): string | null {
  const anni = anniDiEsperienza(annoInizio, oggi);
  if (anni === null) return null;
  if (anni < 1)  return 'meno di 1 anno';
  if (anni <= 3) return '1-3 anni';
  if (anni <= 10) return '3-10 anni';
  return 'oltre 10 anni';
}
