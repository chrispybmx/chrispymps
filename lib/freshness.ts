/**
 * Freschezza dello stato di uno spot — logica pura, nessun side effect.
 *
 * Perché esiste: `condition` da sola non porta informazione. Al 19/08/2026
 * tutti e 116 gli spot pubblicati erano marcati `alive`, quindi il pallino
 * verde valeva 116 su 116 — decorazione, non segnale. La domanda vera del
 * rider prima di prendere la bici è «ci passa ancora qualcuno?», e a quella
 * risponde il TEMPO trascorso dall'ultima conferma, che è un dato che
 * abbiamo già (`spots.condition_updated_at`) e che si aggiorna da solo.
 *
 * Qui la condizione dichiarata e la freschezza vengono combinate in un solo
 * segnale mostrabile ovunque: pin, card, scheda spot.
 */

import type { SpotCondition } from './types';

export type FreshnessTone = 'fresh' | 'ok' | 'aging' | 'stale' | 'dead';

export interface Freshness {
  /** Etichetta lunga, per la scheda spot. Es. "Confermato 3 giorni fa". */
  label: string;
  /** Etichetta compatta, per card e badge. Es. "3g". */
  short: string;
  /** Colore del segnale. */
  color: string;
  tone: FreshnessTone;
  /** Giorni dall'ultima conferma; null se la data manca o è illeggibile. */
  days: number | null;
}

const COLORS: Record<FreshnessTone, string> = {
  fresh: '#00c851',
  ok:    '#7cc47c',
  aging: '#ffce4d',
  stale: '#ff6a00',
  dead:  '#6b6b6b',
};

function plural(n: number, one: string, many: string): string {
  return n === 1 ? `1 ${one}` : `${n} ${many}`;
}

/**
 * @param condition  stato dichiarato dello spot
 * @param updatedAt  ISO timestamp di `condition_updated_at` (o null)
 * @param now        iniettabile per i test
 */
export function getFreshness(
  condition: SpotCondition,
  updatedAt?: string | null,
  now: Date = new Date(),
): Freshness {
  /* Uno spot dichiarato bustato o demolito non "invecchia": la notizia
     è quella, e resta valida finché qualcuno non la smentisce. */
  if (condition === 'demolito') {
    return { label: 'Demolito', short: 'demolito', color: COLORS.dead, tone: 'dead', days: null };
  }
  if (condition === 'bustato') {
    return { label: 'Bustato', short: 'bustato', color: COLORS.stale, tone: 'stale', days: null };
  }

  const ts = updatedAt ? Date.parse(updatedAt) : NaN;
  if (Number.isNaN(ts)) {
    return { label: 'Stato non confermato', short: '—', color: COLORS.dead, tone: 'dead', days: null };
  }

  const days = Math.max(0, Math.floor((now.getTime() - ts) / 86_400_000));

  /* Orizzonte di due anni.
     Uno spot fisico non e' informazione deperibile: un ledge, un rail, una
     scalinata restano dove sono per anni. Quello che cambia davvero — una
     recinzione, una demolizione, un guardiano — succede su scala di anni, non
     di mesi. Con soglie brevi il pallino diventava arancione per il solo
     passare del tempo, e un segnale che si allarma da solo smette di essere
     un segnale. */
  if (days <= 30) {
    return { label: days <= 1 ? 'Confermato da poco' : `Confermato ${days} giorni fa`, short: `${days}g`, color: COLORS.fresh, tone: 'fresh', days };
  }
  if (days <= 365) {
    const m = Math.round(days / 30);
    return { label: `Confermato ${plural(m, 'mese', 'mesi')} fa`, short: `${m}m`, color: COLORS.ok, tone: 'ok', days };
  }
  if (days <= 730) {
    return { label: 'Confermato piu\' di un anno fa', short: '1a+', color: COLORS.aging, tone: 'aging', days };
  }

  const y = Math.floor(days / 365);
  return {
    label: `Nessuno conferma da ${y} anni`,
    short: `${y}a+`,
    color: COLORS.stale,
    tone: 'stale',
    days,
  };
}

/** Vero quando lo spot merita un invito esplicito a confermare lo stato. */
export function needsConfirmation(f: Freshness): boolean {
  /* Si chiede conferma solo oltre l'anno: prima non c'e' niente da confermare,
     lo spot e' quasi certamente ancora li'. */
  return f.tone === 'aging' || f.tone === 'stale';
}
