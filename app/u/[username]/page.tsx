import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { TIPI_SPOT } from '@/lib/constants';
import type { SpotType } from '@/lib/types';

interface Profile {
  id:         string;
  username:   string;
  created_at: string;
}

interface SpotCard {
  id:        string;
  slug:      string;
  name:      string;
  type:      SpotType;
  city?:     string;
  condition: string;
  approved_at?: string;
  spot_photos?: { url: string; position: number }[];
}

async function getData(username: string) {
  const sb = supabaseAdmin();

  const { data: profile } = await sb
    .from('profiles')
    .select('id, username, created_at')
    .eq('username', username)
    .maybeSingle();

  if (!profile) return null;

  const { data: spots } = await sb
    .from('spots')
    .select('id, slug, name, type, city, condition, approved_at, spot_photos(url, position)')
    .eq('submitted_by_username', username)
    .eq('status', 'approved')
    .order('approved_at', { ascending: false });

  return { profile: profile as Profile, spots: (spots ?? []) as SpotCard[] };
}

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  return {
    title: `@${params.username} — Chrispy Maps`,
    description: `Spot BMX aggiunti da @${params.username} su Chrispy Maps`,
  };
}

export const dynamic = 'force-dynamic';

export default async function UserProfilePage({ params }: { params: { username: string } }) {
  const data = await getData(params.username);
  if (!data) notFound();

  const { profile, spots } = data;
  const joinDate = new Date(profile.created_at).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  return (
    <div style={{ background: 'var(--black)', minHeight: '100dvh' }}>
      {/* Sticky header */}
      <div style={{ borderBottom: '1px solid var(--gray-700)', background: 'rgba(10,10,10,0.98)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/map" style={{ color: 'var(--gray-400)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            ← Mappa
          </Link>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--orange)' }}>🏴 PROFILO</span>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px 60px' }}>

        {/* Profile hero */}
        <div style={{ padding: '28px 0 24px', borderBottom: '1px solid var(--gray-700)', display: 'flex', alignItems: 'center', gap: 18 }}>
          {/* Avatar */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--orange)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 32, color: '#000',
            flexShrink: 0, border: '3px solid var(--gray-700)',
          }}>
            {profile.username[0].toUpperCase()}
          </div>

          <div>
            <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 26, color: 'var(--bone)', margin: '0 0 4px' }}>
              @{profile.username}
            </h1>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)' }}>
              Community BMX · dal {joinDate}
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--gray-700)', marginBottom: 24 }}>
          <StatPill value={spots.length} label="spot" />
          <StatPill value={spots.filter(s => s.condition === 'alive').length}    label="alive" />
          <StatPill value={spots.filter(s => s.condition !== 'alive').length}    label="bustati" />
        </div>

        {spots.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏴</div>
            <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--gray-400)', fontSize: 15 }}>
              Nessuno spot ancora.
            </p>
          </div>
        ) : (
          <>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
              📍 SPOT DI @{profile.username.toUpperCase()}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {spots.map(spot => <SpotTile key={spot.id} spot={spot} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SpotTile({ spot }: { spot: SpotCard }) {
  const tipo  = TIPI_SPOT[spot.type];
  const cover = spot.spot_photos?.sort((a, b) => a.position - b.position)[0]?.url;
  const isDead = spot.condition !== 'alive';

  return (
    <Link href={`/map/spot/${spot.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        background: 'var(--gray-800)',
        border: '1px solid var(--gray-700)',
        borderRadius: 8,
        overflow: 'hidden',
        opacity: isDead ? 0.65 : 1,
        transition: 'border-color 0.15s',
      }}>
        {/* Cover */}
        <div style={{ height: 110, background: 'var(--gray-700)', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {cover
            ? <img src={cover} alt={spot.name} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: isDead ? 'grayscale(0.5)' : 'none' }} loading="lazy" />
            : <span style={{ fontSize: 36 }}>{tipo.emoji}</span>
          }
          {isDead && (
            <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.7)', fontFamily: 'var(--font-mono)', fontSize: 9, color: '#aaa', padding: '2px 6px', borderRadius: 2, textTransform: 'uppercase' }}>
              {spot.condition}
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ padding: '8px 10px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
            {spot.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: tipo.color }}>{tipo.emoji} {tipo.label}</span>
            {spot.city && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)' }}>· {spot.city}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '16px 0', borderRight: '1px solid var(--gray-700)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, color: 'var(--orange)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginTop: 3, textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}
