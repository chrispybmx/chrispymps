'use client';
import { useEffect } from 'react';
import { trackMetric } from '@/lib/product-metrics';
export default function MetricClicks() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_PRODUCT_METRICS_ENABLED !== 'true') return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || (event.type === 'auxclick' && event.button !== 1)) return;
      const link = event.target instanceof Element ? event.target.closest('a[data-metric-directions]') : null;
      const source = link?.getAttribute('data-metric-directions');
      if (source === 'map' || source === 'detail') trackMetric('directions_open', source);
    };
    document.addEventListener('click', onClick);
    document.addEventListener('auxclick', onClick);
    return () => { document.removeEventListener('click', onClick); document.removeEventListener('auxclick', onClick); };
  }, []);
  return null;
}
