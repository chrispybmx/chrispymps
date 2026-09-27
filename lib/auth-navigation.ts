/** Only local app destinations may survive an authentication round trip. */
export function safeAuthNext(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/map';
  try {
    const url = new URL(value, 'https://maps.chrispybmx.com');
    if (url.origin !== 'https://maps.chrispybmx.com' || (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/api/'))) return '/map';
    return url.pathname + url.search + url.hash;
  } catch { return '/map'; }
}
export function requestSignIn() {
  window.dispatchEvent(new Event('chrispy:sign-in'));
}
export function authReturnUrl(next?: string): string {
  const target = safeAuthNext(next ?? window.location.pathname + window.location.search + window.location.hash);
  return `${window.location.origin}/auth/callback?flow=email&next=${encodeURIComponent(target)}`;
}
