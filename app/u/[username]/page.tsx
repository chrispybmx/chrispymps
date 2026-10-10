import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { TIPI_SPOT, APP_CONFIG } from '@/lib/constants';
import type { SpotType } from '@/lib/types';
import ProfileClient from './ProfileClient';
import { RiderHistory } from '@/components/RiderSessions';
import { RiderPublicStats } from '@/components/RiderProfileStats';
import FavoritesSection from './FavoritesSection';
import ProfileGamification from '@/components/ProfileGamification';
import BottomNav from '@/components/BottomNav';
import { headers } from 'next/headers';
import { localSessionPreview } from '@/lib/rider-preview-server';
import { PREVIEW_ACTOR } from '@/lib/rider-preview';

interface Profile {
  id:               string;
  username:         string;
  created_at:       string;
  bio?:             string | null;
  instagram_handle?: string | null;
  avatar_url?:      string | null;
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
    .select('id, username, created_at, bio, instagram_handle, avatar_url')
    .eq('username', username)
    .maybeSingle();
  if (!profile) return null;

  const { data: spots } = await sb
      .from('spots')
      .select('id, slug, name, type, city, condition, approved_at, spot_photos(url, position)')
      .eq('submitted_by_username', username)
      .eq('status', 'approved')
      .order('approved_at', { ascending: false, nullsFirst: false });

  return {
    profile:  profile as Profile,
    spots:    (spots ?? []) as SpotCard[],
  };
}

export const revalidate = 300;

export async function generateMetadata(props: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const params = await props.params;
  if(params.username==='rider_demo'&&localSessionPreview((await headers()).get('host')))return {title:'Il tuo profilo · demo locale',robots:{index:false,follow:false},alternates:{canonical:null}};
  const sb = supabaseAdmin();
  const { data: profile } = await sb
    .from('profiles')
    .select('username, bio')
    .eq('username', params.username)
    .maybeSingle();

  const { count: spotsCount } = await sb
    .from('spots')
    .select('id', { count: 'exact', head: true })
    .eq('submitted_by_username', params.username)
    .eq('status', 'approved');

  if (!profile) {
    return { title: `Profilo non trovato — Chrispy Maps` };
  }

  const url         = `${APP_CONFIG.url}/u/${profile.username}`;
  const title       = `@${profile.username} — Profilo Rider`;
  const spotsStr    = spotsCount ? `${spotsCount} spot pubblicati` : '';
  const bioStr      = profile.bio ? ` · ${profile.bio}` : '';
  const description = `Profilo di @${profile.username} su Chrispy Maps.${spotsStr ? ` ${spotsStr}.` : ''}${bioStr} Spot BMX, skate e scooter in Italia.`;

  return {
    title,
    description,
    robots: { index: false, follow: true }, // profile pages not indexed
    alternates: { canonical: url },
    keywords: [
      `@${profile.username}`, `${profile.username} BMX`,
      `rider BMX Italia`, `spot BMX`, `Chrispy Maps rider`,
    ],
    openGraph: {
      type:        'profile',
      url,
      title,
      description,
      siteName:    'Chrispy Maps',
      locale:      'it_IT',
      images: [{
        url:    '/opengraph-image',
        width:  1200,
        height: 630,
        alt:    `Profilo di @${profile.username} su Chrispy Maps`,
      }],
    },
    twitter: {
      card:        'summary',
      site:        '@chrispy_bmx',
      title,
      description,
    },
  };
}

export default async function UserProfilePage(
  props: { params: Promise<{ username: string }>; searchParams?: Promise<{ view?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  if(params.username==='rider_demo'&&localSessionPreview((await headers()).get('host')))return <>
    <main style={{maxWidth:720,margin:'0 auto',padding:'24px 20px 80px',minHeight:'100dvh',boxSizing:'border-box'}}>
      <Link href="/" style={{color:'var(--gray-400)'}}>Torna alla mappa</Link>
      <header style={{padding:'28px 0 20px',borderBottom:'1px solid var(--gray-700)'}}>
        <h1 style={{fontSize:28,margin:'0 0 8px'}}>{searchParams?.view==='public'?'Profilo rider':'Il tuo profilo'}</h1>
        <p style={{margin:0,color:'var(--gray-400)'}}>@rider_demo · Account di prova locale</p>
      </header>
      {searchParams?.view==='public'?<RiderPublicStats ownerId={PREVIEW_ACTOR} endpoint="/api/rider-stats-preview"/>:<>
       <Link href="/?session=1" className="btn-primary" style={{display:'inline-flex',marginTop:20}}>Vai in sessione</Link>
       <RiderHistory ownerId={PREVIEW_ACTOR} compact/>
      </>}
    </main><BottomNav/>
  </>;
  const data = await getData(params.username);
  if (!data) notFound();
  const { profile, spots } = data;
  const joinDate = new Date(profile.created_at).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  return (
    <div style={{ background: 'var(--black)', minHeight: '100dvh' }}>
      {/* Sticky header */}
      <div style={{ borderBottom: '1px solid var(--gray-700)', background: 'rgba(10,10,10,0.98)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" style={{ color: 'var(--gray-400)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            ← Mappa
          </Link>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--orange)' }}>🏴 PROFILO</span>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px calc(60px + env(safe-area-inset-bottom, 0px) + 8px)' }}>

        {/* Profile hero — badge in top-right via ProfileGamification */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, paddingTop: 24, paddingBottom: 20, borderBottom: '1px solid var(--gray-700)', marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <ProfileClient profile={profile} joinDate={joinDate} />
          </div>
          <ProfileGamification username={profile.username} />
        </div>

        <RiderHistory ownerId={profile.id} compact />
        <RiderPublicStats ownerId={profile.id} />
        {/* Spot pubblicati */}
        {spots.length > 0 && (
          <details style={{borderTop:'1px solid var(--gray-700)',padding:'16px 0'}}>
            <summary style={{minHeight:44,cursor:'pointer'}}>Spot pubblicati ({spots.length})</summary>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {spots.map(spot => <SpotTile key={spot.id} spot={spot} username={profile.username} />)}
            </div>
          </details>
        )}

        {/* Preferiti — visibili solo al proprietario del profilo */}
        <FavoritesSection
          profileUsername={profile.username}
          profileId={profile.id}
        />

      </div>

      <BottomNav />
    </div>
  );
}

function SpotTile({ spot, username }: { spot: SpotCard; username: string }) {
  const tipo   = TIPI_SPOT[spot.type];
  const cover  = spot.spot_photos?.sort((a, b) => a.position - b.position)[0]?.url;
  const isDead = spot.condition !== 'alive';
  return (
    <Link href={`/map/spot/${spot.slug}?from=/u/${username}`} style={{ textDecoration: 'none', display: 'block', minWidth: 0 }}>
      <div style={{ background: 'var(--gray-800)', border: '1px solid var(--gray-700)', borderRadius: 8, overflow: 'hidden', opacity: isDead ? 0.65 : 1 }}>
        <div style={{ width: '100%', paddingBottom: '100%', background: 'var(--gray-700)', overflow: 'hidden', position: 'relative' }}>
          {cover
            ? <img src={cover} alt={spot.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: isDead ? 'grayscale(0.5)' : 'none' }} loading="lazy" />
            : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 36 }}>{tipo.emoji}</span></div>}
          {isDead && (
            <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.7)', fontFamily: 'var(--font-mono)', fontSize: 9, color: '#aaa', padding: '2px 6px', borderRadius: 2, textTransform: 'uppercase' }}>
              {spot.condition}
            </div>
          )}
        </div>
        <div style={{ padding: '8px 10px', height: 52, overflow: 'hidden' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--bone)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{spot.name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tipo.emoji} {tipo.label}{spot.city ? ` · ${spot.city}` : ''}
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
