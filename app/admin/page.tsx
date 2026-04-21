import { redirect } from 'next/navigation';
import { isAdminAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import AdminDashboard from './AdminDashboard';
import type { Spot } from '@/lib/types';

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

export default async function AdminPage() {
  if (!isAdminAuthenticated()) {
    redirect('/admin/login');
  }

  const pendingSpots = await getPendingSpots();

  return <AdminDashboard initialSpots={pendingSpots} />;
}
