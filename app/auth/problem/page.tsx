import Link from 'next/link';
export default function AuthProblem() {
  return <main style={{ maxWidth: 480, margin: '10vh auto', padding: 24 }}><h1>Non riesco a completare l’accesso</h1><p>Il link potrebbe essere scaduto o già utilizzato. Se hai già confermato l’email, accedi con la tua password. Altrimenti richiedi un nuovo link dalla schermata di accesso.</p><p>Per un vecchio link, prova anche il browser in cui hai iniziato la registrazione.</p><Link className="btn-primary" href="/map?auth=1">Apri accesso</Link><p><Link href="/map">Torna alla mappa</Link></p></main>;
}
