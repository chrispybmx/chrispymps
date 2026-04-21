'use client';

/**
 * Overlay VHS scanlines + noise — fixed, pointer-events:none.
 * Montato in RootLayout, appare su tutte le pagine.
 */
export default function VhsOverlay() {
  return <div className="vhs-overlay" aria-hidden="true" />;
}
