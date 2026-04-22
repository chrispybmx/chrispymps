import { supabaseBrowser } from './supabase-browser';

export interface UserSession {
  id:          string;
  email:       string;
  username:    string;
  accessToken: string;
}

/** Controlla se uno username è disponibile */
export async function checkUsername(username: string): Promise<boolean> {
  const sb = supabaseBrowser();
  const { data } = await sb.from('profiles').select('id').eq('username', username).maybeSingle();
  return !data; // true = libero
}

/** Registra un nuovo utente */
export async function signUp(email: string, password: string, username: string): Promise<'ok' | 'confirm_email'> {
  const sb = supabaseBrowser();

  // 1. Username disponibile?
  const free = await checkUsername(username);
  if (!free) throw new Error('Username già in uso. Scegline un altro.');

  // 2. Crea account Supabase (username salvato anche in user_metadata per accesso rapido)
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { username } } });
  if (error) throw new Error(translateAuthError(error.message));
  if (!data.user) throw new Error('Errore nella registrazione. Riprova.');

  // 3. Crea profilo
  const { error: profileErr } = await sb
    .from('profiles')
    .insert({ id: data.user.id, username });
  if (profileErr) throw new Error(profileErr.message);

  // Se l'email è già confermata (email confirmation disabled in Supabase) → ok
  // Altrimenti → conferma email necessaria
  return data.session ? 'ok' : 'confirm_email';
}

/** Login */
export async function signIn(email: string, password: string): Promise<void> {
  const sb = supabaseBrowser();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(translateAuthError(error.message));
}

/** Logout */
export async function signOut(): Promise<void> {
  await supabaseBrowser().auth.signOut();
}

/** Carica il profilo di un utente */
export async function getProfile(userId: string): Promise<{ username: string } | null> {
  const sb = supabaseBrowser();
  const { data } = await sb.from('profiles').select('username').eq('id', userId).maybeSingle();
  return data ?? null;
}

/** Torna la sessione corrente con username */
export async function getCurrentUser(): Promise<UserSession | null> {
  const sb = supabaseBrowser();
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user) return null;
  const profile = await getProfile(session.user.id);
  if (!profile) return null;
  return {
    id:          session.user.id,
    email:       session.user.email ?? '',
    username:    profile.username,
    accessToken: session.access_token,
  };
}

function translateAuthError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Email o password errata.';
  if (msg.includes('Email not confirmed'))       return 'Devi confermare la tua email prima di accedere.';
  if (msg.includes('User already registered'))   return 'Questa email è già registrata. Prova ad accedere.';
  if (msg.includes('Password should be'))        return 'La password deve essere di almeno 6 caratteri.';
  return msg;
}
