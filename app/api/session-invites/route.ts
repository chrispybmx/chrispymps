import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { SessionInbox } from '@/lib/session-invites';
import { inboxCursor, inviteSchema, preferenceSchema, privateJson, sessionBody, sessionEndpoint, sessionRpc } from '@/lib/session-invites-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return sessionEndpoint(req, async ({ admin, actor }) => {
    const result = await sessionRpc<SessionInbox>(admin, 'cm_session_inbox', { actor, ...inboxCursor(req.nextUrl.searchParams.get('before')) });
    return privateJson({ ok: true, ...result });
  });
}

export async function POST(req: NextRequest) {
  return sessionEndpoint(req, async ({ admin, actor }) => {
    const input = inviteSchema.parse(await sessionBody(req));
    const rate = await checkRateLimit(`session-invite:${actor}`, 5, 60 * 60 * 1000);
    // A rate-limited retry can still retrieve its already committed invite.
    const result = await sessionRpc<{ id: string; recipientId: string; created: boolean }>(admin, 'cm_session_create_invite', {
      actor, recipient: input.recipient, spot: input.spotId, starts: input.startsAt,
      zone: input.timeZone, invitation_note: input.note, client: input.clientId, allow_new: rate.allowed,
    });
    // The durable outbox is drained by the internal worker; delivery never delays the UI.
    return privateJson({ ok: true, id: result.id }, result.created ? 201 : 200);
  });
}

export async function PATCH(req: NextRequest) {
  return sessionEndpoint(req, async ({ admin, actor }) => {
    const input = preferenceSchema.parse(await sessionBody(req));
    if ('emailEnabled' in input) await sessionRpc(admin, 'cm_session_set_preference', { actor, enabled: input.emailEnabled });
    else await sessionRpc(admin, 'cm_session_unblock_user', { actor, blocked_user: input.unblockUserId });
    return privateJson({ ok: true });
  });
}
