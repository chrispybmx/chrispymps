import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { TIPI_SPOT } from '@/lib/constants';
import type { SpotType } from '@/lib/types';
import ProfileClient from './ProfileClient';
import FavoritesSection from './FavoritesSection';

interface Profile {
  id:               string;
  username:         string;
  created_at:       string;
  bio?:             string | null;
  instagram_handle?: string | null;
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
    .select('id, username, created_at, bio, instagram_handle')
    .eq('username', username)
    .maybeSingle();
  if (!profile) return null;

  const [{ data: spots }, { data: riddenRaw }] = await Promise.all([
    sb
      .from('spots')
      .select('id, slug, name, type, city, condition, approved_at, spot_photos(url, position)')
      .eq('submitted_by_username', username)
      .eq('status', 'approved')
      .order('approved_at', { ascending: false }),
    /* Spot girati: join spot_riders → spots */
    sb
      .from('spot_riders')
      .select('spots(id, slug, name, type, city, condition, spot_photos(url, position))')
      .eq('user_id', profile.id)
      .limit(50),
  ]);

  /* Estrae i dati annidati da spot_riders → spots (Supabase returns array) */
  type RiddenRow = { spots: SpotCard[] | null };
  const ridden: SpotCard[] = (riddenRaw ?? [])
    .flatMap((r: RiddenRow) => r.spots ?? [])
    .filter((s): s is SpotCard => !!s);

  return {
    profile:    profile as Profile,
    spots:      (spots ?? []) as SpotCard[],
    ridden,
  };
}

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  return {
    title: `@${params.username} — Chrispy Maps`,
    description: `Profilo di @${params.username} su Chrispy Maps`,
  };
}

export const dynamic = 'force-dynamic';

export default async function UserProfilePage({ params }: { params: { username: string } }) {
  const data = await getData(params.username);
  if (!data) notFound();
  const { profile, spots, ridden } = data;
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
        <ProfileClient profile={profile} joinDate={joinDate} />

        {/* Stats strip */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--gray-700)', marginBottom: 24 }}>
          <StatPill value={spots.length}  label="📍 spot pubblicati" />
          <StatPill value={ridden.length} label="🛹 spot girati" last />
        </div>

        {/* Spot pubblicati */}
        {spots.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏴</div>
            <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--gray-400)', fontSize: 15 }}>Nessuno spot ancora.</p>
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

        {/* Spot girati — visibili a tutti, sezione pubblica */}
        {ridden.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: 'var(--gray-400)', textTransform: 'uppercase',
              letterSpacing: '0.08em', marginBottom: 14,
              borderTop: '1px solid var(--gray-700)', paddingTop: 24,
            }}>
              🛹 SPOT GIRATI ({ridden.length})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {ridden.map(spot => <SpotTile key={spot.id} spot={spot} />)}
            </div>
          </div>
        )}

        {/* Preferiti — visibili solo al proprietario del profilo */}
        <FavoritesSection
          profileUsername={profile.username}
          profileId={profile.id}
        />

      </div>
    </div>
  );
}

function SpotTile({ spot }: { spot: SpotCard }) {
  const tipo   = TIPI_SPOT[spot.type];
  const cover  = spot.spot_photos?.sort((a, b) => a.position - b.position)[0]?.url;
  const isDead = spot.condition !== 'alive';
  return (
    <Link href={`/map/spot/${spot.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{ background: 'var(--gray-800)', border: '1px solid var(--gray-700)', borderRadius: 8, overflow: 'hidden', opacity: isDead ? 0.65 : 1 }}>
        <div style={{ height: 110, background: 'var(--gray-700)', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {cover
            ? <img src={cover} alt={spot.name} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: isDead ? 'grayscale(0.5)' : 'none' }} loading="lazy" />
            : <span style={{ fontSize: 36 }}>{tipo.emoji}</span>}
          {isDead && (
            <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.7)', fontFamily: 'var(--font-mono)', fontSize: 9, color: '#aaa', padding: '2px 6px', borderRadius: 2, textTransform: 'uppercase' }}>
              {spot.condition}
            </div>
          )}
        </div>
        <div style={{ padding: '8px 10px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{spot.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: tipo.color }}>{tipo.emoji} {tipo.label}</span>
            {spot.city && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)' }}>· {spot.city}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

function StatPill({ value, label, last }: { value: number; label: string; last?: boolean }) {
  return (
    <div style={{
      flex: 1, textAlign: 'center', padding: '18px 0',
      borderRight: last ? 'none' : '1px solid var(--gray-700)',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, color: 'var(--orange)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}
