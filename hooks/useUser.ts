'use client';

import { useState, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { getProfile, type UserSession } from '@/lib/auth-client';

/**
 * Hook per la sessione utente.
 * - `undefined`    = caricamento in corso
 * - `null`         = non loggato
 * - `UserSession`  = loggato
 */
export function useUser(): UserSession | null | undefined {
  const [user, setUser] = useState<UserSession | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function fromSession(session: { user: { id: string; email?: string; user_metadata?: Record<string, string> }; access_token: string } | null) {
      if (cancelled) return;
      if (!session?.user) { setUser(null); return; }

      const uid = session.user.id;
      const cacheKey = `cmaps_un_${uid}`;

      // 1. Fast path: username nel JWT user_metadata (nessuna richiesta DB)
      const metaUsername = session.user.user_metadata?.username as string | undefined;
      if (metaUsername) {
        try { localStorage.setItem(cacheKey, metaUsername); } catch {}
        setUser({ id: uid, email: session.user.email ?? '', username: metaUsername, accessToken: session.access_token });
        return;
      }

      // 2. Cache localStorage (istantaneo per utenti già loggati)
      let cachedUsername: string | null = null;
      try { cachedUsername = localStorage.getItem(cacheKey); } catch {}
      if (cachedUsername) {
        setUser({ id: uid, email: session.user.email ?? '', username: cachedUsername, accessToken: session.access_token });
        // Aggiorna cache in background senza bloccare
        getProfile(uid).then(p => { if (p) try { localStorage.setItem(cacheKey, p.username); } catch {} }).catch(() => {});
        return;
      }

      // 3. Fallback DB (solo al primo login assoluto)
      try {
        const profile = await getProfile(uid);
        if (cancelled) return;
        if (!profile) { setUser(null); return; }
        try { localStorage.setItem(cacheKey, profile.username); } catch {}
        setUser({ id: uid, email: session.user.email ?? '', username: profile.username, accessToken: session.access_token });
      } catch {
        if (!cancelled) setUser(null);
      }
    }

    // Safety timeout: se dopo 5s è ancora undefined, forza null (mostra login)
    const timeout = setTimeout(() => {
      if (!cancelled) setUser(prev => prev === undefined ? null : prev);
    }, 5000);

    let sb: ReturnType<typeof supabaseBrowser>;
    try {
      sb = supabaseBrowser();
    } catch (err) {
      console.error('[useUser] supabaseBrowser() error:', err);
      clearTimeout(timeout);
      setUser(null);
      return;
    }

    // Sessione iniziale
    sb.auth.getSession()
      .then(({ data: { session } }) => fromSession(session))
      .catch((err) => {
        console.error('[useUser] getSession() error:', err);
        if (!cancelled) setUser(null);
      });

    // Ascolta i cambiamenti (login / logout)
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, session) => fromSession(session));

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  return user;
}
