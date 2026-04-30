import type { Metadata } from 'next';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase';
import { CercaSpotBtn } from '@/components/CommunityActions';

export const metadata: Metadata = {
  title: 'Cerca Spot BMX, Skatepark e Street Spot',
  description: 'Chiedi alla community BMX italiana di aiutarti a trovare lo spot perfetto nella tua zona. Ledge, rail, park, bowl — qualcuno lo conosce.',
  alternates: { canonical: 'https://maps.chrispybmx.com/cerca-spot' },
  openGraph: {
    title: 'Cerca Spot — Chrispy Maps',
    description: 'La community ti aiuta a trovare spot BMX nella tua zona.',
    url: 'https://maps.chrispybmx.com/cerca-spot',
    siteName: 'Chrispy Maps',
    locale: 'it_IT',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', site: '@chrispy_bmx', title: 'Cerca Spot — Chrispy Maps' },
};

export const dynamic = 'force-dynamic';

interface RequestItem {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  request_city?: string;
  request_resolved?: boolean;
  published_at?: string;
  created_at: string;
  submitted_by_username?: string;
  tags?: string;
}

async function getRequests(): Promise<RequestItem[]> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('news')
    .select('id, slug, title, excerpt, request_city, request_resolved, published_at, created_at, submitted_by_username, tags')
    .eq('status', 'published')
    .eq('post_type', 'request')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[cerca-spot] Supabase error:', error.message);
    return [];
  }

  return (data ?? []) as RequestItem[];
}

export default async function CercaSpotPage() {
  const requests = await getRequests();

  const open = requests.filter(r => !r.request_resolved);
  const resolved = requests.filter(r => r.request_resolved);

  return (
    <div style={{ background: 'var(--black)', minHeight: '100dvh' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--gray-700)', background: 'rgba(10,10,10,0.98)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" style={{ color: 'var(--gray-400)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            ← Mappa
          </Link>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--orange)' }}>
            📍 CERCA SPOT
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px 60px' }}>

        {/* Hero */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,106,0,0.08) 0%, rgba(255,106,0,0.02) 100%)',
          border: '1px solid rgba(255,106,0,0.2)',
          borderRadius: 12, padding: '20px 18px', marginBottom: 20,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--bone)', marginBottom: 6, lineHeight: 1.3 }}>
            Non trovi lo spot giusto?
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', lineHeight: 1.6, marginBottom: 14 }}>
            Descrivi cosa cerchi e dove. La community ti aiuterà a trovarlo — o magari qualcuno lo aggiungerà alla mappa.
          </div>
          <CercaSpotBtn />
        </div>

        {/* Open requests */}
        {open.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              🔍 RICHIESTE APERTE ({open.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {open.map((item, i) => <RequestRow key={item.id} item={item} isFirst={i === 0} />)}
            </div>
          </div>
        )}

        {/* Resolved */}
        {resolved.length > 0 && (
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              ✅ RISOLTE ({resolved.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {resolved.map(item => <RequestRow key={item.id} item={item} resolved />)}
            </div>
          </div>
        )}

        {/* Empty */}
        {requests.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 50 }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>📍</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--bone)', marginBottom: 8 }}>
              Nessuna richiesta ancora
            </div>
            <div style={{ color: 'var(--gray-400)', fontSize: 13, marginBottom: 20 }}>
              Sii il primo a chiedere aiuto alla community!
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Request row ── */
function RequestRow({ item, isFirst, resolved }: { item: RequestItem; isFirst?: boolean; resolved?: boolean }) {
  const date = item.published_at
    ? new Date(item.published_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
    : '';
  const author = item.submitted_by_username;

  return (
    <Link href={`/news/${item.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
      <article style={{
        display: 'flex', gap: 12, alignItems: 'center',
        padding: '14px 14px',
        background: isFirst && !resolved ? 'rgba(255,106,0,0.04)' : 'transparent',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        borderLeft: isFirst && !resolved ? '3px solid var(--orange)' : '3px solid transparent',
        opacity: resolved ? 0.6 : 1,
        cursor: 'pointer',
      }}>
        {/* Icon */}
        <div style={{
          width: 44, height: 44, borderRadius: 10, flexShrink: 0,
          background: resolved ? 'rgba(0,200,81,0.1)' : 'rgba(255,106,0,0.1)',
          border: `1px solid ${resolved ? 'rgba(0,200,81,0.3)' : 'rgba(255,106,0,0.3)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>
          {resolved ? '✅' : '📍'}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--bone)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginBottom: 3,
          }}>
            {item.title}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {item.request_city && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)' }}>
                📍 {item.request_city}
              </span>
            )}
            {author && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)' }}>
                @{author}
              </span>
            )}
            {date && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-600)' }}>
                {date}
              </span>
            )}
          </div>
        </div>

        <span style={{ color: 'var(--gray-600)', fontSize: 16, flexShrink: 0 }}>›</span>
      </article>
    </Link>
  );
}
