import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { isAdminAuthenticated } from '@/lib/auth';

/**
 * POST /api/admin/send-welcome
 * Manda manualmente l'email di benvenuto Chrispy BMX a una lista di destinatari.
 * Bypassa MailerLite (usa Resend transazionale).
 *
 * Body: { recipients: string[] }
 * Auth: cookie admin (HMAC).
 */

const Schema = z.object({
  recipients: z.array(z.string().email()).min(1).max(50),
});

const WELCOME_HTML = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" border="0" style="background:#141414;border-radius:12px;border:1px solid #2a2a2a;">
      <tr><td style="padding:32px 32px 8px;">
        <div style="font-family:ui-monospace,SF Mono,Menlo,monospace;font-size:11px;color:#ff6a00;text-transform:uppercase;letter-spacing:0.16em;margin-bottom:8px;">CHRISPY BMX · NEWSLETTER</div>
        <h1 style="font-size:26px;color:#f5f5dc;margin:0 0 4px 0;line-height:1.25;font-weight:700;">Bella! Sei dentro.</h1>
      </td></tr>
      <tr><td style="padding:16px 32px 8px;color:#d4d4d4;font-size:16px;line-height:1.65;">
        <p style="margin:0 0 16px 0;">Ciao, sono Christian — in giro mi chiamano <strong style="color:#ff6a00;">Chrispy</strong>.</p>
        <p style="margin:0 0 16px 0;">Giro BMX street, faccio video sul canale YouTube e ora ho deciso di mandare anche una newsletter. Si chiama <strong>Cinque cose dal mondo BMX</strong> e arriva <strong>ogni lunedì mattina</strong>.</p>
        <p style="margin:0 0 16px 0;">Cinque cose che valgono — eventi, video, drop, gente — raccontate da uno che la BMX la mastica tutti i giorni.</p>
        <p style="margin:0 0 24px 0;color:#a3a3a3;font-size:14px;">Tre minuti di lettura. Niente spam, mai.</p>
      </td></tr>
      <tr><td style="padding:0 32px 24px;" align="center">
        <a href="https://maps.chrispybmx.com" style="display:inline-block;background:#ff6a00;color:#000;font-family:ui-monospace,SF Mono,Menlo,monospace;font-size:14px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:8px;letter-spacing:0.04em;">🗺️ APRI LA MAPPA SPOT</a>
      </td></tr>
      <tr><td style="padding:0 32px;"><div style="height:1px;background:#2a2a2a;"></div></td></tr>
      <tr><td style="padding:24px 32px 8px;color:#d4d4d4;font-size:15px;line-height:1.6;">
        <div style="font-family:ui-monospace,SF Mono,Menlo,monospace;font-size:11px;color:#ff6a00;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:12px;">DENTRO IL MONDO CHRISPY</div>
        <ul style="margin:0;padding:0 0 0 18px;color:#d4d4d4;">
          <li style="margin-bottom:8px;"><strong>Mappa spot Italia</strong> — <a href="https://maps.chrispybmx.com" style="color:#ff6a00;text-decoration:underline;">maps.chrispybmx.com</a></li>
          <li style="margin-bottom:8px;"><strong>Canale YouTube</strong> — <a href="https://youtube.com/@chrispy_bmx" style="color:#ff6a00;text-decoration:underline;">@chrispy_bmx</a></li>
          <li style="margin-bottom:8px;"><strong>Instagram</strong> — <a href="https://instagram.com/chriceresato" style="color:#ff6a00;text-decoration:underline;">@chriceresato</a></li>
        </ul>
      </td></tr>
      <tr><td style="padding:24px 32px 32px;color:#d4d4d4;font-size:16px;line-height:1.65;">
        <p style="margin:0 0 4px 0;">Ci si vede in jam.</p>
        <p style="margin:0;font-family:ui-monospace,SF Mono,Menlo,monospace;color:#ff6a00;">— Chrispy</p>
      </td></tr>
    </table>
    <table width="560" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
      <tr><td style="padding:0 32px;text-align:center;color:#737373;font-size:12px;line-height:1.6;">
        Ricevi questa email perché ti sei iscritto su <a href="https://maps.chrispybmx.com" style="color:#a3a3a3;text-decoration:underline;">maps.chrispybmx.com</a>.
      </td></tr>
    </table>
  </td></tr>
</table>`;

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Recipients invalido' }, { status: 400 });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, error: 'RESEND_API_KEY mancante' }, { status: 500 });
  }

  const resend = new Resend(key);
  const results: Array<{ to: string; ok: boolean; id?: string; error?: string }> = [];

  for (const to of parsed.data.recipients) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'Chrispy <christian@chrispybmx.com>',
        to: [to],
        subject: 'Bella! Grazie per esserti iscritto a Chrispy BMX',
        html: WELCOME_HTML,
      });
      if (error) {
        results.push({ to, ok: false, error: error.message });
      } else {
        results.push({ to, ok: true, id: data?.id });
      }
    } catch (e) {
      results.push({
        to,
        ok: false,
        error: e instanceof Error ? e.message : 'unknown',
      });
    }
    // pausa per non martellare Resend
    await new Promise((r) => setTimeout(r, 150));
  }

  return NextResponse.json({ ok: true, results });
}
