import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { SessionMessage, SessionThread } from '@/lib/session-invites';
import { actionSchema, messageCursor, messageSchema, privateJson, sessionBody, sessionEndpoint, sessionIdSchema, sessionRpc } from '@/lib/session-invites-server';

export const dynamic = 'force-dynamic';
type Context = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Context) {
  return sessionEndpoint(req, async ({ admin, actor }) => {
    const invitation = sessionIdSchema.parse(params.id);
    const data = await sessionRpc<SessionThread>(admin, 'cm_session_thread', { actor, invitation, ...messageCursor(req.nextUrl.searchParams) });
    return privateJson({ ok: true, data });
  });
}

export async function POST(req: NextRequest, { params }: Context) {
  return sessionEndpoint(req, async ({ admin, actor }) => {
    const invitation = sessionIdSchema.parse(params.id);
    const input = messageSchema.parse(await sessionBody(req));
    const rate = await checkRateLimit(`session-message:${actor}`, 30, 60 * 1000);
    const data = await sessionRpc<SessionMessage>(admin, 'cm_session_send_message', {
      actor, invitation, message_body: input.body, client: input.clientId, allow_new: rate.allowed,
    });
    return privateJson({ ok: true, data });
  });
}

export async function PATCH(req: NextRequest, { params }: Context) {
  return sessionEndpoint(req, async ({ admin, actor }) => {
    const invitation = sessionIdSchema.parse(params.id);
    const input = actionSchema.parse(await sessionBody(req));
    await sessionRpc(admin, 'cm_session_action', { actor, invitation, requested_action: input.action, report_reason: input.reason ?? null, read_through: input.readThrough ?? null });
    return privateJson({ ok: true });
  });
}
