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
    description: 'Top spot e rider BMX in Italia. Classifica basata su foto e contributi della community.',
    url: 'https://maps.chrispybmx.com/classifica',
    siteName: 'Chrispy Maps',
    locale: 'it_IT',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', site: '@chrispy_bmx', title: 'Classifica — Chrispy Maps' },
};

export const revalidate = 600;

/* ── tipi locali ── */
interface SpotRow {
  id: string; slug: string; name: string;
  type: SpotType; city?: string; condition: SpotCondition;
  cover_url?: string; photo_count: number;
}

interface RiderRow {
  username: string; spot_count: number; latest_spot?: string;
}

async function getData(): Promise<{ topSpots: SpotRow[]; topRiders: RiderRow[] }> {
  const supabase = supabaseServer();

  /* TOP SPOT: spot con più foto (= più documentati e verificati) */
  const { data: spotsRaw } = await supabase
    .from('spots')
    .select('id, slug, name, type, city, condition, spot_photos(url, position)')
    .eq('status', 'approved')
    .order('approved_at', { ascending: false })
    .limit(200); // fetch abbondante, poi ordiniamo lato server

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

  /* TOP RIDER: group by submitted_by_username */
  const { data: ridersRaw } = await supabase
    .from('spots')
    .select('submitted_by_username, name')
    .eq('status', 'approved')
    .not('submitted_by_username', 'is', null)
    .order('approved_at', { ascending: false });

  const riderMap = new Map<string, { count: number; latest: string }>();
  (ridersRaw ?? []).forEach(s => {
    const un = s.submitted_by_username as string;
    if (!riderMap.has(un)) riderMap.set(un, { count: 0, latest: s.name });
    riderMap.get(un)!.count++;
  });

  const topRiders: RiderRow[] = Array.from(riderMap.entries())
    .map(([username, { count, latest }]) => ({ username, spot_count: count, latest_spot: latest }))
    .sort((a, b) => b.spot_count - a.spot_count)
    .slice(0, 15);

  return { topSpots, topRiders };
}

/* ── Medaglia per posizione ── */
function Medal({ pos }: { pos: number }) {
  if (pos === 0) return <span style={{ fontSize: 18 }}>🥇</span>;
  if (pos === 1) return <span style={{ fontSize: 18 }}>🥈</span>;
  if (pos === 2) return <span style={{ fontSize: 18 }}>🥉</span>;
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 13,
      color: 'var(--gray-500)', width: 24, textAlign: 'center', display: 'inline-block',
    }}>
      {pos + 1}
    </span>
  );
}

export default async function ClassificaPage() {
  const { topSpots, topRiders } = await getData();

  return (
    <div style={{ background: 'var(--black)', minHeight: '100dvh', paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 8px)' }}>

      {/* ── Header ── */}
      <div style={{
        background: 'rgba(8,8,8,0.97)',
        borderBottom: '1px solid var(--gray-700)',
        padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 16px 14px',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, color: 'var(--orange)', letterSpacing: '0.04em' }}>
          CLASSIFICA
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>
          Spot più documentati · Rider più attivi
        </div>
      </div>

      <div style={{ padding: '0 0 8px' }}>

        {/* ══ TOP SPOT ══ */}
        <div style={{ padding: '20px 16px 8px' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 13,
            color: 'var(--gray-400)', letterSpacing: '0.08em',
            textTransform: 'uppercase', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>TOP SPOT</span>
            <div style={{ flex: 1, height: 1, background: 'var(--gray-700)' }} />
            <span style={{ fontSize: 10, color: 'var(--gray-600)' }}>per foto verificate</span>
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

                {/* Posizione */}
                <div style={{ width: 28, textAlign: 'center', flexShrink: 0 }}>
                  <Medal pos={i} />
                </div>

                {/* Thumbnail */}
                <div style={{
                  width: 56, height: 56, flexShrink: 0,
                  borderRadius: 8,
                  border: `1px solid ${i < 3 ? 'rgba(255,106,0,0.3)' : 'var(--gray-700)'}`,
                  overflow: 'hidden',
                  background: 'var(--gray-800)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {spot.cover_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={spot.cover_url} alt={spot.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  ) : (
                    <span style={{ fontSize: 22 }}>{tipo.emoji}</span>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 14,
                    color: i < 3 ? 'var(--bone)' : 'var(--gray-400)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {spot.name}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: tipo.color }}>{spot.type.toUpperCase()}</span>
                    {spot.city && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-600)' }}>· {spot.city}</span>}
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9,
                      padding: '1px 5px', borderRadius: 8,
                      background: `${cond.bg}22`, color: cond.bg,
                      border: `1px solid ${cond.bg}44`,
                    }}>{cond.label.toUpperCase()}</span>
                  </div>
                </div>

                {/* Foto count */}
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

        {/* ══ TOP RIDER ══ */}
        <div style={{ padding: '28px 16px 8px' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 13,
            color: 'var(--gray-400)', letterSpacing: '0.08em',
            textTransform: 'uppercase', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>TOP RIDER</span>
            <div style={{ flex: 1, height: 1, background: 'var(--gray-700)' }} />
            <span style={{ fontSize: 10, color: 'var(--gray-600)' }}>spot approvati</span>
          </div>
        </div>

        {topRiders.map((rider, i) => (
          <Link key={rider.username} href={`/u/${rider.username}`} style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>

              {/* Posizione */}
              <div style={{ width: 28, textAlign: 'center', flexShrink: 0 }}>
                <Medal pos={i} />
              </div>

              {/* Avatar iniziale */}
              <div style={{
                width: 42, height: 42, flexShrink: 0,
                borderRadius: '50%',
                background: i < 3 ? 'var(--orange)' : 'var(--gray-700)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 18,
                color: i < 3 ? '#000' : 'var(--gray-400)',
              }}>
                {rider.username[0].toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 14,
                  color: i < 3 ? 'var(--bone)' : 'var(--gray-400)',
                }}>
                  @{rider.username}
                </div>
                {rider.latest_spot && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-600)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    ultimo: {rider.latest_spot}
                  </div>
                )}
              </div>

              {/* Spot count */}
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: i < 3 ? 'var(--orange)' : 'var(--gray-600)', fontWeight: 700 }}>
                  {rider.spot_count}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--gray-600)' }}>spot</div>
              </div>

            </div>
          </Link>
        ))}

      </div>

      <BottomNav />
    </div>
  );
}
