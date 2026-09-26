import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
/** Retired endpoint: old browser builds must not keep collecting attempts/errors. */
export async function POST() {
  return new NextResponse(null, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}
