import type { SiteLanguage } from '@/lib/language';
import type { SpotCondition } from '@/lib/types';

export interface SpotStatusHistoryItem {
  id: string;
  condition: SpotCondition;
  note: string | null;
  created_at: string;
  username: string | null;
}

/** The date stored with a photo records its upload, never its capture date. */
export function formatSpotDate(value: string | null | undefined, language: SiteLanguage = 'it'): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'it-IT', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(date);
}

export function conditionText(condition: SpotCondition, language: SiteLanguage = 'it'): string {
  const labels: Record<SpotCondition, [string, string]> = {
    alive: ['Praticabile', 'Rideable'], bustato: ['Bustato', 'Access issues'], demolito: ['Demolito', 'Demolished'],
  };
  return labels[condition]?.[language === 'en' ? 1 : 0] ?? condition;
}

export function difficultyText(value: string | null | undefined, language: SiteLanguage = 'it'): string | null {
  const labels: Record<string, [string, string]> = {
    beginner: ['Principiante', 'Beginner'], intermediate: ['Intermedio', 'Intermediate'], pro: ['Esperto', 'Advanced'],
  };
  return value ? (labels[value]?.[language === 'en' ? 1 : 0] ?? value) : null;
}
