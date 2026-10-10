'use client';
import { useEffect, useState } from 'react';
import { saveAnalyticsChoice, analyticsAllowed } from '@/lib/analytics-consent';

export default function AnalyticsPreferences() {
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setEnabled(analyticsAllowed()); }, []);
  function change(accepted: boolean) {
    try {
      if (!saveAnalyticsChoice(accepted)) throw new Error('Storage unavailable');
      // Reload also unloads a previously started third-party SDK on withdrawal.
      window.location.reload();
    } catch { setError('Impossibile salvare la scelta su questo dispositivo.'); }
  }
  return <div>
    <label style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44 }}>
      <input type="checkbox" checked={enabled} onChange={event => change(event.target.checked)} />
      Statistiche anonime delle visite su questo dispositivo
    </label>
    {error && <p role="alert">{error}</p>}
  </div>;
}
