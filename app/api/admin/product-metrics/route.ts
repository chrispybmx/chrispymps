import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
export const dynamic = 'force-dynamic';
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  if (!isAdminAuthenticated()) return NextResponse.json({ ok: false }, { status: 401, headers });
  if (process.env.PRODUCT_METRICS_ENABLED !== 'true') return NextResponse.json({ ok: true, enabled: false, rows: [] }, { headers });
  try {
    const since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const { data, error } = await supabaseAdmin().from('cm_product_metrics_daily')
      .select('day,event,source,total').gte('day', since).order('day', { ascending: false }).limit(300);
    if (error) throw error;
    return NextResponse.json({ ok: true, enabled: true, rows: data }, { headers });
  } catch { return NextResponse.json({ ok: false }, { status: 503, headers }); }
}
