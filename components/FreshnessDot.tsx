import { getFreshness } from '@/lib/freshness';
import { CONDIZIONI } from '@/lib/constants';
import type { SpotCondition } from '@/lib/types';

interface Props {
  condition: SpotCondition;
  updatedAt?: string | null;
  /** `dot` = solo pallino colorato (griglie fitte). `label` = pallino + testo breve. */
  variant?: 'dot' | 'label';
}

/**
 * Segnale di stato di uno spot su una card.
 *
 * Sostituisce il pallino verde fisso: il colore ora invecchia col tempo
 * trascorso dall'ultima conferma (vedi lib/freshness.ts), così un verde
 * significa davvero "ci passa gente" invece di valere per ogni spot.
 * Spot bustati o demoliti restano un badge testuale, come prima.
 */
export default function FreshnessDot({ condition, updatedAt, variant = 'dot' }: Props) {
  const fresh = getFreshness(condition, updatedAt);

  if (condition !== 'alive') {
    const cond = CONDIZIONI[condition];
    return (
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 9,
        background: cond.bg, color: cond.color,
        padding: '2px 6px', borderRadius: 3, whiteSpace: 'nowrap',
      }}>
        {cond.label.toUpperCase()}
      </span>
    );
  }

  const dot = (
    <span
      aria-hidden="true"
      style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: fresh.color, boxShadow: `0 0 6px ${fresh.color}`,
        display: 'inline-block',
      }}
    />
  );

  if (variant === 'dot') {
    return <span title={fresh.label} style={{ display: 'inline-flex' }}>{dot}</span>;
  }

  return (
    <span
      title={fresh.label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontFamily: 'var(--font-mono)', fontSize: 9,
        color: fresh.color, background: 'rgba(0,0,0,0.6)',
        padding: '2px 7px', borderRadius: 3, whiteSpace: 'nowrap',
      }}
    >
      {dot}
      {fresh.short}
    </span>
  );
}
