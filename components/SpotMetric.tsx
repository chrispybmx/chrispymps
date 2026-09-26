'use client';
import { useEffect, useRef } from 'react';
import { trackMetric } from '@/lib/product-metrics';
/** Mount only after a real public spot was loaded; no prefetch/404 page views. */
export default function SpotMetric() {
  const counted = useRef(false);
  useEffect(() => {
    if (counted.current) return;
    counted.current = true;
    trackMetric('spot_view', 'detail');
  }, []);
  return null;
}
