import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminAuthenticated } from '@/lib/auth';
import { fasciaEta, fasciaEsperienza, anniDiEsperienza } from '@/lib/rider-profile';

/**
 * GET /api/admin/export/riders?tipo=aggregato|completo
 *
 * Due file diversi, per due usi diversi:
 *
 *   aggregato (default) — conteggi per regione, disciplina, fascia d'età.
 *     Nessuna riga è una persona. È il file che si manda a uno sponsor, si
 *     allega a un media kit, si lascia su un desktop senza pensarci.
 *
 *   completo — l'anagrafica: email, data di nascita, regione. Serve di rado, e
 *     ogni copia che esce è una responsabilità che ti porti dietro. Va chiesto
 *     esplicitamente e cancellato quando hai finito.
 *
 * Il default è aggregato di proposito: lo scaricamento distratto deve produrre
 * il file innocuo, non quello pericoloso.
 */

export const dynamic = 'force-dynamic';

/** Neutralizza le formule: un campo che inizia con = + - @ viene eseguito da Excel. */
function cellaCsv(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n\r;]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(intestazioni: string[], righe: unknown[][]): string {
  const linee = [intestazioni.map(cellaCsv).join(',')];
  for (const r of righe) linee.push(r.map(cellaCsv).join(','));
  /* BOM: senza, Excel su Windows sbaglia gli accenti. */
  return '﻿' + linee.join('\r\n');
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const tipo = req.nextUrl.searchParams.get('tipo') === 'completo' ? 'completo' : 'aggregato';
  const sb   = supabaseAdmin();
  const oggi = new Date().toISOString().slice(0, 10);

  const { data, error } = await sb
    .from('rider_details')
    .select('user_id, birth_date, region, disciplines, riding_since_year, setup_brand, newsletter_opt_in, created_at');

  if (error) {
    console.error('[export/riders]', error.message);
    return NextResponse.json({ ok: false, error: 'Lettura non riuscita' }, { status: 500 });
  }

  type Riga = {
    user_id: string; birth_date: string | null; region: string | null;
    disciplines: string[] | null; riding_since_year: number | null;
    setup_brand: string | null; newsletter_opt_in: boolean; created_at: string;
  };
  const righe = (data ?? []) as Riga[];

  let csv: string;
  let nomeFile: string;

  if (tipo === 'aggregato') {
    /* Conteggi. Nessun identificatore, nessuna data di nascita: solo fasce.
       Il separatore della chiave non puo' essere uno spazio: "Valle d'Aosta" e
       "meno di 1 anno" finirebbero spezzate su piu' colonne al momento di
       ricomporre la riga. */
    const SEP = '\u0001';
    const conta = new Map<string, number>();
    for (const r of righe) {
      const fascia     = fasciaEta(r.birth_date) ?? 'non dichiarata';
      const esperienza = fasciaEsperienza(r.riding_since_year) ?? 'non dichiarata';
      const discipline = r.disciplines?.length ? r.disciplines : ['non dichiarata'];
      for (const d of discipline) {
        const chiave = [r.region ?? 'non dichiarata', d, fascia, esperienza].join(SEP);
        conta.set(chiave, (conta.get(chiave) ?? 0) + 1);
      }
    }
    const out = [...conta.entries()]
      .map(([k, n]) => [...k.split(SEP), n])
      .sort((a, b) => Number(b[4]) - Number(a[4]));

    csv = toCsv(['regione', 'disciplina', 'fascia_eta', 'esperienza', 'rider'], out);
    nomeFile = `chrispymaps-aggregato-${oggi}.csv`;
  } else {
    /* Anagrafica. L'email va presa da auth.users, non è in rider_details. */
    const { data: utenti } = await sb.auth.admin.listUsers({ perPage: 1000 });
    const emailPerId = new Map((utenti?.users ?? []).map(u => [u.id, u.email ?? '']));

    const out = righe.map(r => [
      emailPerId.get(r.user_id) ?? '',
      r.birth_date ?? '',
      fasciaEta(r.birth_date) ?? '',
      r.region ?? '',
      (r.disciplines ?? []).join(' '),
      r.riding_since_year ?? '',
      anniDiEsperienza(r.riding_since_year) ?? '',
      r.setup_brand ?? '',
      r.newsletter_opt_in ? 'si' : 'no',
      r.created_at.slice(0, 10),
    ]);

    csv = toCsv(
      ['email', 'data_nascita', 'fascia_eta', 'regione', 'discipline', 'inizio_anno', 'anni_esperienza', 'setup', 'newsletter', 'iscritto_il'],
      out,
    );
    nomeFile = `chrispymaps-ANAGRAFICA-${oggi}.csv`;
  }

  /* Traccia di chi esce e quando: se un file gira, si sa da dove è partito. */
  await sb.from('admin_export_log').insert({
    tipo,
    righe: righe.length,
    user_agent: req.headers.get('user-agent'),
  }).then(({ error: e }) => { if (e) console.error('[export/riders] log:', e.message); });

  return new NextResponse(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nomeFile}"`,
      /* Mai in cache: né nel browser, né in mezzo. */
      'Cache-Control':       'no-store, no-cache, must-revalidate, private',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
