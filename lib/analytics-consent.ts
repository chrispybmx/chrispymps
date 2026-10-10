export const ANALYTICS_CONSENT_KEY = 'cmaps_analytics_consent_v1';
export const ANALYTICS_CONSENT_EVENT = 'cmaps:analytics-choice';
const MAX_AGE = 180 * 24 * 60 * 60 * 1000;

export function analyticsChoice(raw: string | null, now = Date.now()): boolean | null {
  try {
    const value = JSON.parse(raw || 'null');
    // A refusal never expires; a saved acceptance only hides the notice for a while.
    return typeof value?.accepted === 'boolean' && Number.isFinite(value.at)
      && value.at <= now && (value.accepted === false || now - value.at < MAX_AGE) ? value.accepted : null;
  } catch { return null; }
}

export function hasAnalyticsChoice(): boolean {
  try { return analyticsChoice(window.localStorage.getItem(ANALYTICS_CONSENT_KEY)) !== null; }
  catch { return false; }
}

export function saveAnalyticsChoice(accepted: boolean): boolean {
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, JSON.stringify({accepted, at: Date.now()}));
    window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
    return true;
  } catch { return false; }
}

/** Cookieless, aggregate statistics run by default; a refusal saved on this
 *  device, Do Not Track or Global Privacy Control turn them off. */
export function analyticsAllowed(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return false;
  try { return analyticsChoice(window.localStorage.getItem(ANALYTICS_CONSENT_KEY)) !== false; }
  catch { return false; }
}
