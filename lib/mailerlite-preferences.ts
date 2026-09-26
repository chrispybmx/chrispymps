import { GROUP_BY_SOURCE } from './mailerlite';
const api = 'https://connect.mailerlite.com/api';
const newsletterGroup = () => process.env.MAILERLITE_NEWSLETTER_GROUP_ID || GROUP_BY_SOURCE.newsletter;
function config() {
  if (!process.env.MAILERLITE_API_KEY || (process.env.NEWSLETTER_PROVIDER && process.env.NEWSLETTER_PROVIDER !== 'mailerlite')) throw new Error('provider_unavailable');
  return { Authorization: `Bearer ${process.env.MAILERLITE_API_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' };
}
async function subscriber(email: string) {
  const res = await fetch(`${api}/subscribers/${encodeURIComponent(email)}`, { headers: config(), signal: AbortSignal.timeout(5000), cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('provider_unavailable');
  const { data } = await res.json();
  if (!data?.id || !data.status || !Array.isArray(data.groups)) throw new Error('provider_unavailable');
  return data as { id: string; status: string; groups: { id: string }[] };
}
export async function newsletterMembership(email: string) {
  const data = await subscriber(email);
  return { active: !!data && data.status === 'active' && data.groups.some(g => g.id === newsletterGroup()), suppressed: !!data && data.status !== 'active' };
}
export async function setNewsletterMembership(email: string, enabled: boolean) {
  const data = await subscriber(email);
  if (enabled && data && data.status !== 'active') throw new Error('provider_suppressed');
  if (!enabled && !data) return;
  const member = data?.groups.some(g => g.id === newsletterGroup());
  if (enabled && member || !enabled && !member) return;
  const path = data ? `/subscribers/${data.id}/groups/${newsletterGroup()}` : '/subscribers';
  const res = await fetch(api + path, { method: enabled ? 'POST' : 'DELETE', headers: config(),
    ...(data ? {} : { body: JSON.stringify({ email, groups: [newsletterGroup()] }) }), signal: AbortSignal.timeout(5000) });
  // A group deletion returning 404 needs verification, not blind success.
  if (!res.ok && !(res.status === 404 && !enabled)) throw new Error('provider_unavailable');
  const verified = await newsletterMembership(email);
  if (verified.active !== enabled) throw new Error('provider_unavailable');
}
