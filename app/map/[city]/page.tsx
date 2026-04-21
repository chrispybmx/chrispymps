import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase';
import { CITTA_ITALIANE, TIPI_SPOT, CONDIZIONI, APP_CONFIG } from '@/lib/constants';
import type { Spot } from '@/lib/types';

export const revalidate = 3600; // 1 ora

interface Props { params: { city: string } }

function getCityLabel(slug: string): string {
  return CITTA_ITALIANE.find((c) => c.value === slug)?.label ?? slug;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cityLabel = getCityLabel(params.city);
  return {
    title:       `Spot BMX ${cityLabel}`,
    description: `Mappa spot BMX a ${cityLabel}. Trova i migliori posti dove girare in città.`,
    openGraph: {
      title:       `Spot BMX ${cityLabel} — ChrispyMPS`,
      description: `Trova i migliori spot BMX a ${cityLabel}.`,
      url:         `${APP_CONFIG.url}/map/${params.city}`,
    },
  };
}

export async function generateStaticParams() {
  return CITTA_ITALIANE.map((c) => ({ city: c.value }));
}

async function getCitySpots(city: string): Promise<Spot[]> {
  const supabase = supabaseServer();
  const { data } = await supabase
    .from('spots')
    .select('*, spot_photos(url, position)')
    .eq('status', 'approved')
    .eq('city', city)
    .order('approved_at', { ascending: false });
  return (data ?? []) as Spot[];
}

export default async function CityPage({ params }: Props) {
  const cityLabel = getCityLabel(params.city);
  if (!CITTA_ITALIANE.find((c) => c.value === params.city)) notFound();

  const spots = await getCitySpots(params.city);

  return (
    <main style={{
      background: 'var(--black)',
      minHeight: '100dvh',
      paddingTop: 'var(--topbar-height)',
      paddingBottom: 'calc(var(--strip-height) + 24px)',
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 20px 16px',
        borderBottom: '1px solid var(--gray-700)',
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', marginBottom: 4 }}>
          <Link href="/map" style={{ color: 'var(--orange)', textDecoration: 'none' }}>← MAPPA</Link>
          {' / '}
          {cityLabel.toUpperCase()}
        </div>
        <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 34, color: 'var(--orange)', margin: '4px 0 8px' }}>
          SPOT BMX {cityLabel.toUpperCase()}
        </h1>
        <p style={{ color: 'var(--gray-400)', fontSize: 15 }}>
          {spots.length === 0
            ? 'Nessuno spot approvato ancora. Sii il primo a segnalarne uno!'
            : `${spots.length} spot ${spots.length === 1 ? 'verificato' : 'verificati'}`}
        </p>
      </div>

      {/* Grid spot */}
      <div style={{ padding: '16px 20px' }}>
        {spots.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏴</div>
            <p style={{ color: 'var(--bone)', marginBottom: 20 }}>
              Conosci qualche spot a {cityLabel}?
            </p>
            <Link href="/map?add=1" className="btn-primary" style={{ textDecoration: 'none', padding: '12px 24px' }}>
              Aggiungi il primo spot
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {spots.map((spot) => {
              const photos = (spot.spot_photos ?? []) as { url: string; position: number }[];
              const cover  = photos.sort((a, b) => a.position - b.position)[0]?.url;
              const tipo   = TIPI_SPOT[spot.type];
              const cond   = CONDIZIONI[spot.condition];
              return (
                <Link
                  key={spot.id}
                  href={`/map/spot/${spot.slug}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div className="vhs-card" style={{ overflow: 'hidden', transition: 'border-color 0.15s' }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = 'var(--orange)'}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = 'var(--gray-700)'}
                  >
                    {/* Cover */}
                    <div style={{ height: 160, background: 'var(--gray-700)', position: 'relative', overflow: 'hidden' }}>
                      {cover
                        ? <img src={cover} alt={spot.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                        : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 40 }}>{tipo.emoji}</div>
                      }
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        background: cond.bg, color: cond.color,
                        fontFamily: 'var(--font-mono)', fontSize: 11,
                        padding: '2px 8px', borderRadius: 2, textTransform: 'uppercase',
                      }}>
                        {cond.label}
                      </div>
                    </div>
                    {/* Info */}
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--orange)', marginBottom: 4 }}>
                        {spot.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: tipo.color, fontFamily: 'var(--font-mono)', fontSize: 12, border: `1px solid ${tipo.color}`, padding: '1px 6px', borderRadius: 2 }}>
                          {tipo.emoji} {tipo.label}
                        </span>
                        {spot.difficulty && (
                          <span style={{ color: 'var(--gray-400)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                            {spot.difficulty}
                          </span>
                        )}
                      </div>
                      {spot.description && (
                        <p className="truncate-2" style={{ color: 'var(--gray-400)', fontSize: 13, marginTop: 8, lineHeight: 1.4 }}>
                          {spot.description}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
