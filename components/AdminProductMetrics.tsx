'use client';
import { useEffect, useState } from 'react';
import { METRIC_LABELS, type MetricEvent } from '@/lib/product-metrics';
type Report = { enabled: boolean; rows: { event: MetricEvent; total: number }[] };
export default function AdminProductMetrics() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch('/api/admin/product-metrics', { cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => { if (!data.ok) throw new Error(); setReport(data); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [retry]);
  return <section aria-label="Utilizzo del prodotto" style={{ borderBottom: '1px solid var(--gray-700)', paddingBottom: 20 }}>
    <h2 style={{ fontSize: 20 }}>Come viene usata la mappa</h2>
    {error ? <p role="status">Metriche non disponibili. <button onClick={() => setRetry(value => value + 1)}>Riprova</button></p>
      : !report ? <p role="status">Caricamento metriche…</p>
      : !report.enabled ? <p>Raccolta disattivata. Nessun nuovo evento viene registrato.</p>
      : <><p>Ultimi 30 giorni UTC, oggi incluso. Conteggi di azioni: non persone uniche né session realmente svolte.</p>
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          {Object.entries(METRIC_LABELS).map(([event, label]) => <div key={event}>
            <dt>{label}</dt><dd style={{ margin: '6px 0', fontSize: 26, fontVariantNumeric: 'tabular-nums' }}>{report.rows.filter(row => row.event === event).reduce((sum, row) => sum + Number(row.total), 0).toLocaleString('it-IT')}</dd>
          </div>)}
        </dl><p>Rilevazione parziale: blocchi del browser, rete e limiti di frequenza possono escludere eventi. Le due ricerche misurano la selezione di un risultato sulla mappa e l’invio del modulo in Scopri.</p></>}
  </section>;
}
