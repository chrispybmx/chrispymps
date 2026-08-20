import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import EditProfileClient from './EditProfileClient';
import BottomNav from '@/components/BottomNav';

/* Pagina privata: non deve finire nell'indice né nelle anteprime. */
export const metadata: Metadata = {
  title: 'Modifica profilo',
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export const dynamic = 'force-dynamic';

interface Props { params: { username: string } }

export default async function ModificaProfiloPage({ params }: Props) {
  const sb = supabaseAdmin();
  const { data: profile } = await sb
    .from('profiles')
    .select('id, username, bio, instagram_handle, avatar_url')
    .eq('username', params.username)
    .maybeSingle();

  if (!profile) notFound();

  return (
    <main style={{
      background: 'var(--black)', minHeight: '100dvh',
      maxWidth: 680, margin: '0 auto',
      paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--gray-700)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link
          href={`/u/${profile.username}`}
          style={{ color: 'var(--gray-400)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: 13 }}
        >
          ← Profilo
        </Link>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)' }}>
          Modifica profilo
        </span>
      </div>

      <EditProfileClient
        profile={{
          id: profile.id,
          username: profile.username,
          bio: profile.bio,
          instagram_handle: profile.instagram_handle,
          avatar_url: profile.avatar_url,
        }}
      />

      <BottomNav />
    </main>
  );
}
