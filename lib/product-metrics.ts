/** Fixed vocabulary only: never add query text, URLs, rider IDs or coordinates. */
export const METRIC_LABELS = {
  search_used: 'Ricerche confermate',
  spot_view: 'Aperture schede spot',
  directions_open: 'Click su indicazioni',
  contribution_open: 'Aperture aggiungi spot',
  contribution_sent: 'Invii spot riusciti',
} as const;
export type MetricEvent = keyof typeof METRIC_LABELS;
export type MetricSource = 'map' | 'discover' | 'detail' | 'add';
const sources: Record<MetricEvent, readonly MetricSource[]> = {
  search_used: ['map', 'discover'], spot_view: ['detail'],
  directions_open: ['map', 'detail'], contribution_open: ['add'], contribution_sent: ['add'],
};
export function validMetric(body: unknown): body is { event: MetricEvent; source: MetricSource } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const value = body as Record<string, unknown>;
  return Object.keys(value).length === 2 && typeof value.event === 'string'
    && Object.hasOwn(sources, value.event) && typeof value.source === 'string'
    && sources[value.event as MetricEvent].includes(value.source as MetricSource);
}

/** Best effort; no cookies, storage, identifiers, referrer or blocking navigation. */
export function trackMetric(event: MetricEvent, source: MetricSource) {
  if (process.env.NEXT_PUBLIC_PRODUCT_METRICS_ENABLED !== 'true' || typeof window === 'undefined') return;
  if (navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
  try {
    void fetch('/api/product-metrics', {
      method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, source }),
      keepalive: true, signal: AbortSignal.timeout(2500),
    }).catch(() => {});
  } catch { /* Measurement must never break a rider action. */ }
}
