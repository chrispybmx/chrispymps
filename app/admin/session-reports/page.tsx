import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { z } from 'zod';
import { isAdminAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { SESSION_STATUS_LABELS, SessionInviteStatus } from '@/lib/session-invites';
import styles from './reports.module.css';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const metadata = {
  title: 'Segnalazioni session · Chrispy Maps',
  alternates: { canonical: null },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

const cursorSchema = z.tuple([z.string().datetime({ offset: true }), z.string().uuid()]);
const snapshotSchema = z.object({
  invite: z.object({
    sender_id: z.string(), recipient_id: z.string(),
    sender_username: z.string(), recipient_username: z.string(),
    spot_name: z.string(), spot_slug: z.string().nullable(), spot_city: z.string().nullable(),
    starts_at: z.string(), time_zone: z.string(), status: z.string(), note: z.string(),
  }),
  messages: z.array(z.object({ id: z.number(), sender_id: z.string(), body: z.string(), created_at: z.string() })).max(20),
});
type Snapshot = z.infer<typeof snapshotSchema>;
interface Report { id: string; reporter_id: string; reported_id: string; reason: string; created_at: string; snapshot: unknown }
interface PageProps { searchParams?: { before?: string | string[] } }

function dateLabel(value: string, timeZone = 'Europe/Rome'): string {
  try {
    return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(value));
  } catch { return 'Data non disponibile'; }
}

function riderName(snapshot: Snapshot | null, id: string): string {
  if (id === snapshot?.invite.sender_id) return snapshot.invite.sender_username;
  if (id === snapshot?.invite.recipient_id) return snapshot.invite.recipient_username;
  return 'Rider';
}

function Rider({ name }: { name: string }) {
  return /^[a-zA-Z0-9_-]{3,30}$/.test(name)
    ? <Link href={`/u/${encodeURIComponent(name)}`} prefetch={false}>@{name}</Link>
    : <span>{name}</span>;
}

function ReportItem({ report }: { report: Report }) {
  const parsed = snapshotSchema.safeParse(report.snapshot);
  const snapshot = parsed.success ? parsed.data : null;
  const invite = snapshot?.invite;
  const messages = snapshot?.messages ?? [];
  return (
    <article className={styles.report}>
      <div className={styles.reportTop}>
        <p className={styles.people}><Rider name={riderName(snapshot, report.reporter_id)} /> <span>segnala</span> <Rider name={riderName(snapshot, report.reported_id)} /></p>
        <time dateTime={report.created_at}>{dateLabel(report.created_at)} · Roma</time>
      </div>
      <h2 className={styles.label}>Motivo della segnalazione</h2>
      <p className={styles.reason}>{report.reason}</p>
      {invite ? <>
        <div className={styles.context}>
          <p>{invite.spot_slug
            ? <Link href={`/map/spot/${encodeURIComponent(invite.spot_slug)}`} prefetch={false}>{invite.spot_name}</Link>
            : <strong>{invite.spot_name}</strong>}{invite.spot_city ? ` · ${invite.spot_city}` : ''}</p>
          <p>Session del {dateLabel(invite.starts_at, invite.time_zone)} · {invite.time_zone}</p>
        </div>
        <details className={styles.evidence}>
          <summary>Contesto e messaggi allegati ({messages.length})</summary>
          <div className={styles.evidenceBody}>
            <p className={styles.muted}>Copia acquisita al momento della segnalazione. Stato dell’invito: {SESSION_STATUS_LABELS[invite.status as SessionInviteStatus] ?? invite.status}.</p>
            <h3>Messaggio dell’invito</h3>
            <p className={styles.messageBody}>{invite.note || 'Nessun messaggio nell’invito.'}</p>
            <h3>Ultimi messaggi disponibili</h3>
            {messages.length === 0 ? <p className={styles.muted}>La segnalazione non contiene messaggi della chat.</p> :
              <ol className={styles.messages}>
                {messages.map(message => <li key={message.id}>
                  <div className={styles.messageTop}><strong>{riderName(snapshot, message.sender_id)}</strong><time dateTime={message.created_at}>{dateLabel(message.created_at)} · Roma</time></div>
                  <p className={styles.messageBody}>{message.body}</p>
                </li>)}
              </ol>}
          </div>
        </details>
      </> : <p className={styles.muted}>Il contesto allegato non è disponibile in un formato leggibile.</p>}
    </article>
  );
}

export default async function SessionReportsPage({ searchParams }: PageProps) {
  // Authenticate before constructing the service client or reading any report.
  if (!isAdminAuthenticated()) redirect('/admin/login');
  noStore();
  let reports: Report[] = [];
  let errorMessage = '';
  let hasMore = false;
  let nextCursor: string | null = null;
  const enabled = process.env.SESSION_INVITES_ENABLED === 'true';
  const cursorValue = searchParams?.before;
  const parsedCursor = typeof cursorValue === 'string' ? cursorSchema.safeParse(cursorValue.split('|')) : null;

  if (!enabled) errorMessage = 'Le session private non sono ancora attive.';
  else if (cursorValue !== undefined && (!parsedCursor || !parsedCursor.success)) errorMessage = 'Il collegamento alla pagina non è valido. Torna alle segnalazioni più recenti.';
  else {
    try {
      let query = supabaseAdmin().from('cm_session_reports')
        .select('id,reporter_id,reported_id,reason,created_at,snapshot')
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(41);
      if (parsedCursor?.success) {
        const [time, id] = parsedCursor.data;
        // Both components are strictly validated before entering the PostgREST filter.
        query = query.or(`created_at.lt.${time},and(created_at.eq.${time},id.lt.${id})`);
      }
      const { data, error } = await query;
      if (error) errorMessage = 'Non è stato possibile caricare le segnalazioni. Riprova tra poco.';
      else {
        const rows = (data ?? []) as Report[];
        hasMore = rows.length > 40;
        reports = rows.slice(0, 40);
        const last = reports[reports.length - 1];
        if (hasMore && last) nextCursor = `${last.created_at}|${last.id}`;
      }
    } catch { errorMessage = 'Non è stato possibile caricare le segnalazioni. Riprova tra poco.'; }
  }

  return <main className={styles.page}>
    <header className={styles.header}><div>
      <Link href="/admin" prefetch={false}>← Pannello admin</Link>
      <span>Chrispy Maps</span>
    </div></header>
    <div className={styles.content}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Moderazione</p>
        <h1>Segnalazioni session</h1>
        <p>Segnalazioni inviate dai rider, con il contesto e gli ultimi 20 messaggi acquisiti al momento dell’invio.</p>
        <p className={styles.muted}>Questa pagina permette la consultazione delle segnalazioni. Non applica sanzioni né modifica le conversazioni.</p>
      </div>
      {errorMessage ? <div className={styles.notice} role="status"><p>{errorMessage}</p><Link href="/admin/session-reports" prefetch={false}>Ricarica le segnalazioni più recenti</Link></div> :
        reports.length === 0 ? <div className={styles.notice}><h2>{cursorValue ? 'Non ci sono altre segnalazioni' : 'Nessuna segnalazione'}</h2><p>{cursorValue ? 'Hai raggiunto la fine dell’elenco.' : 'Le segnalazioni dei rider compariranno qui.'}</p></div> :
          <section aria-label="Segnalazioni ricevute">{reports.map(report => <ReportItem key={report.id} report={report} />)}</section>}
      <nav className={styles.pagination} aria-label="Pagine delle segnalazioni">
        {cursorValue && <Link href="/admin/session-reports" prefetch={false}>Torna alle più recenti</Link>}
        {nextCursor && <Link href={`/admin/session-reports?before=${encodeURIComponent(nextCursor)}`} prefetch={false}>Segnalazioni precedenti →</Link>}
      </nav>
    </div>
  </main>;
}
