import { NextRequest, NextResponse } from 'next/server';
import { getDiscoverPage } from '@/lib/discover-server';
import { parseDiscoverFilters } from '@/app/scopri/discover';
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const offset = Number(params.get('offset') ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) return NextResponse.json({ ok: false }, { status: 400 });
  try { return NextResponse.json({ ok: true, ...await getDiscoverPage(parseDiscoverFilters(params), offset) }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' } }); }
  catch { return NextResponse.json({ ok: false, error: 'Non riesco a caricare gli spot. Riprova.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
