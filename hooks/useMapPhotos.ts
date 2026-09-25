'use client';
import { useEffect, useRef, useState } from 'react';
import { loadMapSpotPhotos } from '@/lib/map-spots';
import type { SpotMapPin } from '@/lib/types';

type PhotoData = Pick<SpotMapPin, 'id' | 'cover_url' | 'cover_source' | 'photo_urls' | 'photo_sources'>;
type Entry = { spot: PhotoData; full: boolean };
/** Keep photos off the marker/search critical path. Late cover responses must
 * never replace the full gallery of a selected spot. */
export function useMapPhotos(visibleIds: string[], selectedId: string | null) {
  const cache = useRef(new Map<string, Entry>());
  const [photos, setPhotos] = useState<Record<string, PhotoData>>({});
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const key = [...new Set(visibleIds)].sort().join(',');
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const store = (rows: SpotMapPin[], full: boolean, requested: string[]) => {
      if (!active) return;
      const received = new Map(rows.map(spot => [spot.id, spot]));
      for (const id of requested) {
        const spot: PhotoData = received.get(id) ?? {id,photo_urls:[]};
        const old = cache.current.get(spot.id);
        cache.current.delete(spot.id);
        cache.current.set(spot.id, old?.full && !full ? old : {spot, full});
      }
      // Covers are small, but keep long browsing sessions bounded too.
      const protectedIds = new Set([...key.split(','), selectedId]);
      for (const id of cache.current.keys()) {
        if (cache.current.size <= 256) break;
        if (!protectedIds.has(id)) cache.current.delete(id);
      }
      setPhotos(Object.fromEntries([...cache.current].map(([id, entry]) => [id, entry.spot])));
    };
    const run = async () => {
      if (document.visibilityState === 'hidden') return;
      setError(false);
      const jobs: Promise<void>[] = [];
      if (selectedId && !cache.current.get(selectedId)?.full) {
        jobs.push(loadMapSpotPhotos([selectedId], controller.signal, true).then(rows => store(rows, true, [selectedId])));
      }
      const missing = key.split(',').filter(id => id && id !== selectedId && !cache.current.has(id));
      for (let start = 0; start < missing.length; start += 32) {
        const batch = missing.slice(start, start + 32);
        jobs.push(loadMapSpotPhotos(batch, controller.signal).then(rows => store(rows, false, batch)));
      }
      const results = await Promise.allSettled(jobs);
      if (active && results.some(result => result.status === 'rejected')) setError(true);
    };
    const timer = window.setTimeout(run, 160);
    const onVisible = () => { if (document.visibilityState === 'visible') void run(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; clearTimeout(timer); controller.abort(); document.removeEventListener('visibilitychange', onVisible); };
  }, [key, selectedId, attempt]);
  return { photos, error, retry: () => setAttempt(value => value + 1) };
}
