'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useUser } from './useUser';
import { createFavoritesStore, EMPTY_FAVORITES, favoritesScope } from '@/lib/favorites-store';

const store = createFavoritesStore({
  storage: () => typeof window === 'undefined' ? null : window.localStorage,
  fetch: (...args) => fetch(...args),
});
let connections = 0;
const onStorage = (event: StorageEvent) => store.storageChanged(event.key, event.newValue);

/** All mounted controls share one account-scoped store; refreshes update the token. */
export function useFavorites() {
  const user = useUser();
  const scope = favoritesScope(user);
  const subscribe = useCallback((callback: () => void) => store.subscribe(scope, callback), [scope]);
  const getSnapshot = useCallback(() => store.snapshot(scope), [scope]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_FAVORITES);
  useEffect(() => { store.configure(user); }, [user?.id, user?.accessToken, user]);
  useEffect(() => {
    if (connections++ === 0) window.addEventListener('storage', onStorage);
    return () => { if (--connections === 0) window.removeEventListener('storage', onStorage); };
  }, []);
  const toggleFav = useCallback((id: string): boolean => {
    const adding = store.toggle(scope, id);
    if (scope !== 'loading') navigator.vibrate?.(adding ? 12 : 6);
    return adding;
  }, [scope]);
  const setFav = useCallback((id: string, saved: boolean) => store.set(scope, id, saved), [scope]);
  const isFav = useCallback((id: string) => snapshot.favIds.has(id), [snapshot.favIds]);
  const reload = useCallback(() => store.reload(scope), [scope]);
  const importLegacy = useCallback((ids: string[]) => store.importLegacy(scope, ids), [scope]);
  return { ...snapshot, isFav, toggleFav, setFav, scope, reload, importLegacy, legacyIds: store.legacyIds };
}
