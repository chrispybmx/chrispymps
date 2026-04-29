'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from './useUser';

const FAVS_KEY = 'cmaps_favs_v1';

/* Read from localStorage */
function readLocal(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(FAVS_KEY) ?? '[]') as string[]); }
  catch { return new Set(); }
}

/* Write to localStorage */
function writeLocal(ids: Set<string>) {
  try { localStorage.setItem(FAVS_KEY, JSON.stringify([...ids])); } catch {}
}

/**
 * Centralized favorites hook.
 * - Logged in → syncs with Supabase via /api/favorites
 * - Guest → localStorage only
 * - Optimistic updates for instant UI feedback
 */
export function useFavorites() {
  const user = useUser();
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const pendingRef = useRef<Set<string>>(new Set()); // IDs with in-flight API calls

  /* Load favorites on mount / auth change */
  useEffect(() => {
    if (user === undefined) return; // still loading auth

    if (user) {
      // Logged in → fetch from Supabase
      fetch('/api/favorites', {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      })
        .then(r => r.json())
        .then(j => {
          if (j.ok && j.ids) {
            const serverIds = new Set<string>(j.ids);
            setFavIds(serverIds);
            writeLocal(serverIds); // keep localStorage in sync
          }
        })
        .catch(() => {
          // Fallback to localStorage if API fails
          setFavIds(readLocal());
        })
        .finally(() => setLoaded(true));
    } else {
      // Guest → localStorage
      setFavIds(readLocal());
      setLoaded(true);
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isFav = useCallback((id: string) => favIds.has(id), [favIds]);

  const toggleFav = useCallback((id: string): boolean => {
    const adding = !favIds.has(id);

    // Optimistic update
    setFavIds(prev => {
      const next = new Set(prev);
      if (adding) next.add(id); else next.delete(id);
      writeLocal(next);
      return next;
    });

    // Haptic feedback
    navigator.vibrate?.(adding ? 12 : 6);

    // API sync for logged-in users
    if (user && !pendingRef.current.has(id)) {
      pendingRef.current.add(id);
      fetch('/api/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.accessToken}`,
        },
        body: JSON.stringify({ spot_id: id }),
      })
        .catch(() => {
          // Revert on failure
          setFavIds(prev => {
            const reverted = new Set(prev);
            if (adding) reverted.delete(id); else reverted.add(id);
            writeLocal(reverted);
            return reverted;
          });
        })
        .finally(() => {
          pendingRef.current.delete(id);
        });
    }

    return adding;
  }, [favIds, user]);

  return { isFav, toggleFav, favIds, loaded };
}
