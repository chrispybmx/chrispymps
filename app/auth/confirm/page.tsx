import Link from 'next/link';
import { safeAuthNext } from '@/lib/auth-navigation';
export default function ConfirmEmail({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const token = typeof searchParams.token_hash === 'string' && searchParams.token_hash.length <= 512 ? searchParams.token_hash : '';
  const type = typeof searchParams.type === 'string' && ['email','signup','recovery','email_change'].includes(searchParams.type) ? searchParams.type : '';
  const next = safeAuthNext(typeof searchParams.next === 'string' ? searchParams.next : null);
  const recovery = type === 'recovery';
  return <main style={{ maxWidth:480, margin:'10vh auto', padding:24 }}><Link href="/">Chrispy Maps</Link><h1>{recovery ? 'Recupera la password' : 'Conferma la tua email'}</h1>{token && type ? <><p>{recovery ? 'Continua per scegliere una nuova password.' : 'Conferma per completare l’accesso e tornare al sito.'}</p><form method="post" action="/auth/callback"><input type="hidden" name="token_hash" value={token}/><input type="hidden" name="type" value={type}/><input type="hidden" name="next" value={next}/><button className="btn-primary" type="submit">{recovery ? 'Continua' : 'Conferma email'}</button></form></> : <p>Il link non è completo. Richiedine uno nuovo dalla <Link href="/map?auth=1">schermata di accesso</Link>.</p>}</main>;
}
