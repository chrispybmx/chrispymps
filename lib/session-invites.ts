/** Shared API contracts; no private credentials or server imports. */
export type SessionInviteStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired' | 'blocked';
export interface SessionInvite {
  id: string; sender_id: string; recipient_id: string;
  sender_username: string; recipient_username: string;
  sender_avatar: string | null; recipient_avatar: string | null;
  spot_id: string; spot_name: string; spot_slug: string; spot_city: string | null;
  starts_at: string; time_zone: string; note: string; status: SessionInviteStatus;
  created_at: string; updated_at: string; unread: boolean;
}
export interface SessionMessage {
  id: number; invite_id: string; sender_id: string; body: string; client_id: string; created_at: string;
}
export interface SessionInbox {
  unreadCount?: number;
  data: SessionInvite[]; emailEnabled: boolean; blockedUsers: { id: string; username: string }[];
  hasMore: boolean; nextBefore: string | null;
}
export interface SessionThread {
  invite: SessionInvite; messages: SessionMessage[]; blocked: boolean; hasMore: boolean;
}
export const SESSION_INVITES_PUBLIC = process.env.NEXT_PUBLIC_SESSION_INVITES_ENABLED === 'true';
export const SESSION_STATUS_LABELS: Record<SessionInviteStatus,string> = {
  pending: 'In attesa', accepted: 'Accettata', declined: 'Rifiutata', cancelled: 'Annullata', expired: 'Scaduta', blocked: 'Conversazione chiusa',
};
