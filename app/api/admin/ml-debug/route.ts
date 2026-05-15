import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';

/**
 * GET /api/admin/ml-debug?groupId=...
 * Interroga MailerLite Connect API per:
 *   - dettaglio group
 *   - automations attive
 *   - forms collegati
 *   - campaigns spedite verso quel group
 * Auth: cookie admin.
 */

const ML = 'https://connect.mailerlite.com/api';

async function ml<T = unknown>(path: string, key: string): Promise<{ ok: boolean; status: number; data: T | null }> {
  const r = await fetch(`${ML}${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  const data = (await r.json().catch(() => null)) as T | null;
  return { ok: r.ok, status: r.status, data };
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }
  const key = process.env.MAILERLITE_API_KEY;
  if (!key) return NextResponse.json({ ok: false, error: 'MAILERLITE_API_KEY mancante' }, { status: 500 });

  // Modalità "single automation": ?automationId=XYZ → dettaglio completo
  const automationId = req.nextUrl.searchParams.get('automationId');
  if (automationId) {
    const detail = await ml(`/automations/${automationId}`, key);
    return NextResponse.json({ ok: true, automation: detail.data });
  }

  const groupId = req.nextUrl.searchParams.get('groupId') || process.env.MAILERLITE_GROUP_ID;
  if (!groupId) return NextResponse.json({ ok: false, error: 'groupId mancante' }, { status: 400 });

  const [group, automations, forms, campaigns] = await Promise.all([
    ml(`/groups/${groupId}`, key),
    ml(`/automations?limit=50`, key),
    ml(`/forms/popup?limit=50`, key),
    ml(`/campaigns?limit=50&filter[status]=sent`, key),
  ]);

  return NextResponse.json({
    ok: true,
    groupId,
    group: group.data,
    automations: automations.data,
    formsPopup: forms.data,
    campaignsSent: campaigns.data,
  });
}
