/**
 * Livelli rider — sorgente unica.
 *
 * Pure: nessun import server. Usabile da client component, server component e
 * dall'XP engine. Prima di questo file le soglie erano duplicate in tre posti
 * (lib/xp.ts, app/classifica, components/ProfileGamification) e già divergevano.
 *
 * Taratura (2026-08-19): le soglie precedenti (0/50/130/340/890/2330/6100) erano
 * pensate per un'app con volumi molto più alti di quelli reali. Dopo un trimestre
 * il rider #1 era a 240 XP: i livelli 5, 6 e 7 richiedevano rispettivamente ~89,
 * ~233 e ~610 spot approvati, quindi la barra di progresso smetteva di muoversi
 * proprio per chi contribuiva di più. Le soglie qui sotto sono ricalibrate sui
 * numeri osservati, mantenendo i nomi e l'ordine dei badge.
 */

export interface Level {
  threshold: number;
  name:      string;
  key:       string;
  image:     string;
}

/** Ordine DECRESCENTE — il lookup prende il primo livello raggiunto. */
export const LEVELS: Level[] = [
  { threshold: 1400, name: 'Chrispy Scout',  key: 'chrispy-scout',  image: '/badges/level-7-chrispy-scout.png' },
  { threshold: 750,  name: 'City Legend',    key: 'city-legend',    image: '/badges/level-6-city-legend.png' },
  { threshold: 380,  name: 'Verified Rider', key: 'verified-rider', image: '/badges/level-5-verified-rider.png' },
  { threshold: 180,  name: 'Local Scout',    key: 'local-scout',    image: '/badges/level-4-local-scout.png' },
  { threshold: 80,   name: 'Spot Hunter',    key: 'spot-hunter',    image: '/badges/level-3-spot-hunter.png' },
  { threshold: 30,   name: 'Local Rider',    key: 'local-rider',    image: '/badges/level-2-local-rider.png' },
  { threshold: 0,    name: 'Rookie',         key: 'rookie',         image: '/badges/level-1-rookie.png' },
];

export function calculateLevel(xp: number): string {
  for (const level of LEVELS) {
    if (xp >= level.threshold) return level.name;
  }
  return 'Rookie';
}

export interface LevelInfo {
  current:  Level;
  next:     Level | null;
  /** Soglia del livello successivo; se sei al massimo, la soglia corrente. */
  nextThreshold: number;
  /** 0–100 all'interno del livello corrente. */
  progress: number;
  /** XP che mancano al livello successivo; 0 se sei al massimo. */
  remaining: number;
}

export function getLevelInfo(xp: number): LevelInfo {
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].threshold) {
      const current = LEVELS[i];
      const next    = i > 0 ? LEVELS[i - 1] : null;
      const nextThreshold = next?.threshold ?? current.threshold;
      const progress = next
        ? Math.min(100, Math.max(0, ((xp - current.threshold) / (nextThreshold - current.threshold)) * 100))
        : 100;
      return {
        current,
        next,
        nextThreshold,
        progress,
        remaining: next ? Math.max(0, nextThreshold - xp) : 0,
      };
    }
  }
  const last = LEVELS[LEVELS.length - 1];
  return { current: last, next: LEVELS[LEVELS.length - 2], nextThreshold: LEVELS[LEVELS.length - 2].threshold, progress: 0, remaining: LEVELS[LEVELS.length - 2].threshold - xp };
}
