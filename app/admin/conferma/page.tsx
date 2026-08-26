import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyApproveToken, verifyRejectToken, verifyEventActionToken } from '@/lib/auth';
import { TIPI_SPOT } from '@/lib/constants';
import type { Spot } from '@/lib/types';
import ConfermaClient from './ConfermaClient';

export const dynamic = 'force-dynamic';

/* Una pagina di moderazione non deve finire nell'indice di nessuno. */
export const metadata = {
  title: 'Conferma moderazione',
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: { token?: string; rifiuta?: string; evento?: string; azione?: string };
}

/**
 * Pagina di conferma per i link di moderazione via email.
 *
 * Perché esiste: prima il link nell'email approvava lo spot al solo essere
 * aperto, perché era una GET. Ma i link nelle email li aprono anche gli
 * antivirus della posta, i filtri aziendali e i generatori di anteprima —
 * e lo spot «Thermal forum» risulta infatti approvato 24 secondi dopo
 * l'invio, contro i 3 minuti / 25 ore di tutti gli altri.
 *
 * Ora il link porta qui: si vede cosa si sta approvando, con le foto, e si
 * decide con un tap. Il cambio di stato è una POST, che nessuna macchina fa
 * per sbaglio seguendo un link.
 *
 * Non serve il login: il token È la credenziale, ed è quello il senso del
 * link — poter moderare dal telefono senza entrare nella dashboard.
 */
export default async function ConfermaPage({ searchParams }: Props) {
  /* Gli eventi passano di qui con un token diverso: stesso difetto, stesso
     rimedio. Vedi app/api/admin/events/moderate. */
  if (searchParams.evento) {
    return <ConfermaEvento token={searchParams.evento} azione={searchParams.azione ?? ''} />;
  }

  const tokenApprova = searchParams.token;
  const tokenRifiuta = searchParams.rifiuta;

  const spotId = tokenApprova
    ? verifyApproveToken(tokenApprova)
    : tokenRifiuta
      ? verifyRejectToken(tokenRifiuta)
      : null;

  if (!spotId) return <Scaduto />;

  const { data } = await supabaseAdmin()
    .from('spots')
    .select('*, spot_photos(url, position)')
    .eq('id', spotId)
    .single();

  if (!data) notFound();

  const spot = data as unknown as Spot;
  const foto = (spot.spot_photos ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(p => p.url);

  return (
    <ConfermaClient
      spotId={spotId}
      nome={spot.name}
      slug={spot.slug}
      citta={spot.city ?? null}
      tipo={TIPI_SPOT[spot.type]?.label ?? spot.type}
      emoji={TIPI_SPOT[spot.type]?.emoji ?? '📍'}
      descrizione={spot.description ?? null}
      autore={spot.submitted_by_username ?? null}
      stato={spot.status}
      foto={foto}
      lat={spot.lat}
      lon={spot.lon}
      tokenApprova={tokenApprova ?? null}
      tokenRifiuta={tokenRifiuta ?? null}
    />
  );
}

function Scaduto() {
  return (
    <main style={{
      background: 'var(--black)', minHeight: '100dvh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', maxWidth: 380 }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>⌛</div>
        <h1 style={{ color: 'var(--orange)', fontSize: 20, margin: '0 0 10px' }}>
          Link scaduto
        </h1>
        <p style={{ color: 'var(--gray-400)', fontSize: 14, lineHeight: 1.6, margin: '0 0 22px' }}>
          I link di moderazione valgono 72 ore. Questo è scaduto, oppure è già
          stato usato.
        </p>
        <a href="/admin" style={{
          display: 'inline-block', background: 'var(--orange)', color: '#000',
          padding: '11px 22px', borderRadius: 8, textDecoration: 'none',
          fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
        }}>
          APRI LA DASHBOARD
        </a>
      </div>
    </main>
  );
}

/** Conferma per la moderazione di un evento inviato dalla community. */
async function ConfermaEvento({ token, azione }: { token: string; azione: string }) {
  if (azione !== 'approve' && azione !== 'reject') return <Scaduto />;

  const eventId = verifyEventActionToken(token, azione);
  if (!eventId) return <Scaduto />;

  const { data } = await supabaseAdmin()
    .from('events')
    .select('id, title, event_date, city, description, moderation_status')
    .eq('id', eventId)
    .maybeSingle();

  if (!data) notFound();

  const e = data as {
    title: string; event_date: string | null; city: string | null;
    description: string | null; moderation_status: string | null;
  };

  return (
    <ConfermaClient
      spotId={eventId}
      nome={e.title}
      slug=""
      citta={e.city}
      tipo="Evento"
      emoji="📅"
      descrizione={e.description}
      autore={null}
      stato={e.moderation_status === 'pending' ? 'pending' : 'approved'}
      foto={[]}
      lat={0}
      lon={0}
      tokenApprova={null}
      tokenRifiuta={null}
      evento={{ token, azione: azione as 'approve' | 'reject', quando: e.event_date }}
    />
  );
}
