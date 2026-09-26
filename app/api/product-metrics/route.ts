import { NextRequest, NextResponse } from 'next/server';
import { validMetric } from '@/lib/product-metrics';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { requestHasSameOrigin } from '@/lib/request-origin';
import { APP_CONFIG } from '@/lib/constants';
export const dynamic = 'force-dynamic';
const response = (status: number) => new NextResponse(null, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: NextRequest) {
  if (process.env.PRODUCT_METRICS_ENABLED !== 'true') return response(204);
  const origin = req.headers.get('origin');
  if (!requestHasSameOrigin(req) && origin !== new URL(APP_CONFIG.url).origin) return response(403);
  if (req.headers.get('sec-fetch-site') === 'cross-site') return response(403);
  if (req.headers.get('dnt') === '1' || req.headers.get('sec-gpc') === '1') return response(204);
  if (!req.headers.get('content-type')?.startsWith('application/json')) return response(415);
  // Global abuse budget. No visitor key/IP is sent to Redis or stored for analytics.
  if (!(await checkRateLimit('product-metrics:global', 300, 60_000)).allowed) return response(429);
  const reader = req.body?.getReader();
  if (!reader) return response(400);
  let size = 0;
  const parts: Uint8Array[] = [];
  let body: unknown;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 160) { await reader.cancel(); return response(413); }
      parts.push(value);
    }
    body = JSON.parse(Buffer.concat(parts).toString('utf8'));
  } catch { return response(400); }
  if (!validMetric(body)) return response(400);
  try {
    const { error } = await supabaseAdmin().rpc('cm_increment_product_metric', {
      p_event: body.event, p_source: body.source,
    }).abortSignal(AbortSignal.timeout(2000));
    return response(error ? 503 : 204);
  } catch { return response(503); }
}
