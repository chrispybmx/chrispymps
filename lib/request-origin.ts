import type { NextRequest } from 'next/server';
/** Next's internal URL may use localhost behind a proxy; Host is the browser target. */
export function requestHasSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) return false;
    if (origin === req.nextUrl.origin) return true;
    if (url.protocol !== req.nextUrl.protocol) return false;
    const host = req.headers.get('host');
    // Host is not writable by cross-origin browser JavaScript. Do not accept a
    // client-supplied forwarding header as an additional origin allowlist.
    return !!host && new URL(`${url.protocol}//${host}`).origin === origin;
  } catch { return false; }
}
