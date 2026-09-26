import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const supplied = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  if (!secret || Buffer.byteLength(supplied) !== Buffer.byteLength(expected)
    || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return new NextResponse(null, { status: 401 });
  try {
    const { error } = await supabaseAdmin().rpc('cm_purge_product_metrics');
    return NextResponse.json({ ok: !error }, { status: error ? 503 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ ok: false }, { status: 503 }); }
}
