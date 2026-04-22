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

      // Fast path: username nel JWT (nessuna richiesta DB extra)
      const metaUsername = session.user.user_metadata?.username as string | undefined;
      if (metaUsername) {
        setUser({
          id:          session.user.id,
          email:       session.user.email ?? '',
          username:    metaUsername,
          accessToken: session.access_token,
        });
        return;
      }

      // Fallback: query profilo (utenti vecchi senza user_metadata)
      try {
        const profile = await getProfile(session.user.id);
        if (cancelled) return;
        if (!profile) { setUser(null); return; }
        setUser({
          id:          session.user.id,
          email:       session.user.email ?? '',
          username:    profile.username,
          accessToken: session.access_token,
        });
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
