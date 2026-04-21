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
    const sb = supabaseBrowser();

    async function fromSession(session: { user: { id: string; email?: string }; access_token: string } | null) {
      if (!session?.user) { setUser(null); return; }
      const profile = await getProfile(session.user.id);
      if (!profile) { setUser(null); return; }
      setUser({
        id:          session.user.id,
        email:       session.user.email ?? '',
        username:    profile.username,
        accessToken: session.access_token,
      });
    }

    // Sessione iniziale
    sb.auth.getSession().then(({ data: { session } }) => fromSession(session));

    // Ascolta i cambiamenti (login / logout)
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, session) => fromSession(session));

    return () => subscription.unsubscribe();
  }, []);

  return user;
}
