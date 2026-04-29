import type { Metadata } from 'next';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase';
import { TIPI_SPOT, CONDIZIONI } from '@/lib/constants';
import type { SpotType, SpotCondition } from '@/lib/types';
import BottomNav from '@/components/BottomNav';

export const metadata: Metadata = {
  title: 'Classifica Spot e Rider BMX Italia — Chrispy Maps',
  description: 'I migliori spot BMX, skatepark e park scooter in Italia per qualità e documentazione. Top rider e spot più fotografati.',
  alternates: { canonical: 'https://maps.chrispybmx.com/classifica' },
  keywords: ['classifica spot BMX', 'migliori skatepark Italia', 'top rider BMX', 'spot più fotografati'],
  openGraph: {
    title: 'Classifica — Chrispy Maps',
    description: 'Top spot e rider BMX in Italia.',
    url: 'https://maps.chrispybmx.com/classifica',
    siteName: 'Chrispy Maps',
    locale: 'it_IT',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', site: '@chrispy_bmx', title: 'Classifica — Chrispy Maps' },
};

export const revalidate = 600;

interface SpotRow {
  id: string; slug: string; name: string;
  type: SpotType; city?: string; condition: SpotCondition;
  cover_url?: string; photo_count: number;
}

interface RiderRow {
  username: string; spot_count: number; xp: number; level: string; level_image: string;
}

/* ── Level info (must match lib/xp.ts) ── */
const LEVELS = [
  { threshold: 2500, name: 'Chrispy Scout',  image: '/badges/level-7-chrispy-scout.png' },
  { threshold: 1000, name: 'City Legend',     image: '/badges/level-6-city-legend.png' },
  { threshold: 500,  name: 'Verified Rider',  image: '/badges/level-5-verified-rider.png' },
  { threshold: 200,  name: 'Local Scout',     image: '/badges/level-4-local-scout.png' },
  { threshold: 75,   name: 'Spot Hunter',     image: '/badges/level-3-spot-hunter.png' },
  { threshold: 25,   name: 'Local Rider',     image: '/badges/level-2-local-rider.png' },
  { threshold: 0,    name: 'Rookie',          image: '/badges/level-1-rookie.png' },
];

function getLevelForXP(xp: number) {
  for (const l of LEVELS) { if (xp >= l.threshold) return l; }
  return LEVELS[LEVELS.length - 1];
}

async function getData(): Promise<{ topSpots: SpotRow[]; topRiders: RiderRow[] }> {
  const supabase = supabaseServer();

  /* TOP SPOT */
  const { data: spotsRaw } = await supabase
    .from('spots')
    .select('id, slug, name, type, city, condition, spot_photos(url, position)')
    .eq('status', 'approved')
    .order('approved_at', { ascending: false })
    .limit(200);

  const topSpots: SpotRow[] = (spotsRaw ?? [])
    .map(s => {
      const photos = (s.spot_photos ?? []) as { url: string; position: number }[];
      return {
        id: s.id, slug: s.slug, name: s.name,
        type: s.type as SpotType,
        city: s.city ?? undefined,
        condition: s.condition as SpotCondition,
        cover_url: photos.sort((a, b) => a.position - b.position)[0]?.url,
        photo_count: photos.length,
      };
    })
    .sort((a, b) => b.photo_count - a.photo_count)
    .slice(0, 20);

  /* TOP RIDER — with XP from user_stats */
  const { data: ridersRaw } = await supabase
    .from('spots')
    .select('submitted_by_username')
    .eq('status', 'approved')
    .not('submitted_by_username', 'is', null);

  const riderMap = new Map<string, number>();
  (ridersRaw ?? []).forEach(s => {
    const un = s.submitted_by_username as string;
    riderMap.set(un, (riderMap.get(un) ?? 0) + 1);
  });

  // Get XP for all riders
  const usernames = Array.from(riderMap.keys());
  const { data: profiles } = await supabase
    .from('profiles')
    .select('username, id')
    .in('username', usernames);

  const userIds = (profiles ?? []).map(p => p.id);
  const { data: statsRaw } = userIds.length > 0
    ? await supabase.from('user_stats').select('user_id, lifetime_xp').in('user_id', userIds)
    : { data: [] };

  const xpMap = new Map<string, number>();
  (profiles ?? []).forEach(p => {
    const stat = (statsRaw ?? []).find(s => s.user_id === p.id);
    xpMap.set(p.username, stat?.lifetime_xp ?? 0);
  });

  const topRiders: RiderRow[] = Array.from(riderMap.entries())
    .map(([username, count]) => {
      const xp = xpMap.get(username) ?? 0;
      const level = getLevelForXP(xp);
      return { username, spot_count: count, xp, level: level.name, level_image: level.image };
    })
    .sort((a, b) => b.xp - a.xp || b.spot_count - a.spot_count)
    .slice(0, 15);

  return { topSpots, topRiders };
}

function Medal({ pos }: { pos: number }) {
  if (pos === 0) return <span style={{ fontSize: 20 }}>🥇</span>;
  if (pos === 1) return <span style={{ fontSize: 20 }}>🥈</span>;
  if (pos === 2) return <span style={{ fontSize: 20 }}>🥉</span>;
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-500)', width: 28, textAlign: 'center', display: 'inline-block' }}>
      {pos + 1}
    </span>
  );
}

export default async function ClassificaPage() {
  const { topSpots, topRiders } = await getData();

  return (
    <div style={{ background: 'var(--black)', minHeight: '100dvh', paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 8px)' }}>

      {/* Header */}
      <div style={{
        background: 'rgba(8,8,8,0.97)',
        borderBottom: '1px solid var(--gray-700)',
        padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 16px 14px',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, color: 'var(--orange)', letterSpacing: '0.04em' }}>
          🏆 CLASSIFICA
        </div>
      </div>

      <div style={{ padding: '0 0 8px' }}>

        {/* ══ TOP RIDER — FIRST, with badges ══ */}
        <div style={{ padding: '20px 16px 8px' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 13,
            color: 'var(--orange)', letterSpacing: '0.08em',
            textTransform: 'uppercase', marginBottom: 14,
          }}>
            🏴 TOP RIDER
          </div>
        </div>

        {topRiders.map((rider, i) => (
          <Link key={rider.username} href={`/u/${rider.username}`} style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              background: i < 3 ? `rgba(255,106,0,0.0${3 - i})` : 'transparent',
            }}>
              {/* Position */}
              <div style={{ width: 28, textAlign: 'center', flexShrink: 0 }}>
                <Medal pos={i} />
              </div>

              {/* Badge image */}
              <img
                src={rider.level_image}
                alt={rider.level}
                style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }}
              />

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 15,
                  color: i < 3 ? 'var(--bone)' : 'var(--gray-400)',
                  fontWeight: i < 3 ? 700 : 400,
                }}>
                  @{rider.username}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)', marginTop: 2 }}>
                  {rider.level} · {rider.xp} XP
                </div>
              </div>

              {/* Spot count */}
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: i < 3 ? 'var(--orange)' : 'var(--gray-600)', fontWeight: 700 }}>
                  {rider.spot_count}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--gray-600)' }}>spot</div>
              </div>
            </div>
          </Link>
        ))}

        {/* ══ TOP SPOT ══ */}
        <div style={{ padding: '28px 16px 8px' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 13,
            color: 'var(--orange)', letterSpacing: '0.08em',
            textTransform: 'uppercase', marginBottom: 14,
          }}>
            📍 TOP SPOT
          </div>
        </div>

        {topSpots.map((spot, i) => {
          const tipo = TIPI_SPOT[spot.type];
          const cond = CONDIZIONI[spot.condition];
          return (
            <Link key={spot.id} href={`/map/spot/${spot.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: i < 3 ? `rgba(255,106,0,0.0${3 - i})` : 'transparent',
              }}>
                <div style={{ width: 28, textAlign: 'center', flexShrink: 0 }}>
                  <Medal pos={i} />
                </div>

                <div style={{
                  width: 56, height: 56, flexShrink: 0,
                  borderRadius: 8,
                  border: `1px solid ${i < 3 ? 'rgba(255,106,0,0.3)' : 'var(--gray-700)'}`,
                  overflow: 'hidden',
                  background: 'var(--gray-800)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {spot.cover_url ? (
                    <img src={spot.cover_url} alt={spot.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  ) : (
                    <span style={{ fontSize: 22 }}>{tipo.emoji}</span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 14,
                    color: i < 3 ? 'var(--bone)' : 'var(--gray-400)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {spot.name}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: tipo.color }}>{tipo.emoji} {spot.type.toUpperCase()}</span>
                    {spot.city && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-600)' }}>· {spot.city}</span>}
                  </div>
                </div>

                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: i < 3 ? 'var(--orange)' : 'var(--gray-600)', fontWeight: 700 }}>
                    {spot.photo_count}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--gray-600)' }}>foto</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
