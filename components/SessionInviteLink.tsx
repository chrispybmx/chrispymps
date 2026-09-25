'use client';
import Link from 'next/link';
import { useUser } from '@/hooks/useUser';
import { SESSION_INVITES_PUBLIC } from '@/lib/session-invites';
import MapIcon from './MapIcon';

export default function SessionInviteLink({ recipient, spotId }: { recipient: string; spotId?: string }) {
  const user = useUser();
  if (!SESSION_INVITES_PUBLIC || user?.username.toLowerCase() === recipient.toLowerCase()) return null;
  const query = new URLSearchParams({ to: recipient });
  if (spotId) query.set('spot', spotId);
  return <Link href={'/messaggi?' + query.toString()} className="btn-secondary" style={{display:'inline-flex',alignItems:'center',gap:8,minHeight:44,marginBlock:12,textTransform:'none',letterSpacing:0}}>
    <MapIcon name="calendar" size={18} />Proponi una session
  </Link>;
}
