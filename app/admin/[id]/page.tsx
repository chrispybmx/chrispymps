import { redirect, notFound } from 'next/navigation';
import { isAdminAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import AdminEditClient from './AdminEditClient';
import type { Spot } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Props { params: { id: string } }

export default async function AdminEditPage({ params }: Props) {
  if (!isAdminAuthenticated()) redirect('/admin/login');

  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from('spots')
    .select('*, spot_photos(*)')
    .eq('id', params.id)
    .single();

  if (!data) notFound();

  return <AdminEditClient spot={data as Spot} />;
}
