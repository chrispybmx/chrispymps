import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import AdminDashboard from './AdminDashboard';
import type { Spot } from '@/lib/types';
import type { PhotoCheck } from '@/lib/photo-check';

export const dynamic = 'force-dynamic';

async function getPendingSpots(): Promise<Spot[]> {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from('spots')
    .select('*, spot_photos(id, url, position)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  return (data ?? []) as Spot[];
}

/* Query separata e tollerante: se la tabella non esiste ancora (migration non
   eseguita) la coda deve caricarsi lo stesso, solo senza etichette. */
async function getPhotoChecks(spotIds: string[]): Promise<Record<string, PhotoCheck[]>> {
  if (spotIds.length === 0) return {};
  const { data, error } = await supabaseAdmin()
    .from('spot_photo_checks')
    .select('spot_id, position, has_gps, distance_m, taken_at, has_camera')
    .in('spot_id', spotIds)
    .order('position', { ascending: true });
  if (error || !data) return {};
  const bySpot: Record<string, PhotoCheck[]> = {};
  for (const row of data) (bySpot[row.spot_id] ??= []).push(row);
  return bySpot;
}

export default async function AdminPage() {
  if (!isAdminAuthenticated()) {
    redirect('/admin/login');
  }

  const pendingSpots = await getPendingSpots();
  const photoChecks = await getPhotoChecks(pendingSpots.map((s) => s.id));

  return <>{process.env.SESSION_INVITES_ENABLED === 'true' && <nav style={{padding:'14px 24px',borderBottom:'1px solid #383634'}}><Link href="/admin/session-reports" prefetch={false} style={{color:'var(--orange)'}}>Segnalazioni session →</Link></nav>}<AdminDashboard initialSpots={pendingSpots} photoChecks={photoChecks} /></>;
}
