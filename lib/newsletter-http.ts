import { NextRequest } from 'next/server';
import { supabaseAdmin } from './supabase';
import { requestHasSameOrigin } from './request-origin';
import { APP_CONFIG } from './constants';
export const newsletterOrigins = new Set([new URL(process.env.NEWSLETTER_SITE_URL || APP_CONFIG.url).origin,new URL(APP_CONFIG.url).origin,'https://chrispybmx.com','https://www.chrispybmx.com']);
export function allowedNewsletterOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  return requestHasSameOrigin(req) || (!!origin && newsletterOrigins.has(origin));
}
export async function newsletterUser(req: NextRequest) {
  const bearer = req.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await supabaseAdmin().auth.getUser(bearer.slice(7));
  return !error && user?.email && user.email_confirmed_at ? user : null;
}
export async function newsletterBody(req: NextRequest) {
  const reader = req.body?.getReader();
  if (!reader) throw new Error('empty');
  const chunks: Uint8Array[] = []; let size=0;
  while (true) {
    const {done,value} = await reader.read(); if(done) break;
    size+=value.byteLength; if(size>2048){ await reader.cancel(); throw new Error('large'); } chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}
