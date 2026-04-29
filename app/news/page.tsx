import type { Metadata } from 'next';
import Link from 'next/link';
import { ScriviPostBtn } from '@/components/CommunityActions';

export const metadata: Metadata = {
  title: 'News BMX Italia — Aggiornamenti Spot e Community | Chrispy Maps',
  description: 'Ultime notizie, aggiornamenti spot, nuovi skatepark e contenuti dalla community BMX italiana su Chrispy Maps.',
  alternates: { canonical: 'https://maps.chrispybmx.com/news' },
  keywords: ['news BMX Italia', 'aggiornamenti skatepark', 'community BMX', 'nuovi spot BMX'],
  openGraph: {
    title: 'News BMX — Chrispy Maps',
    description: 'Ultime notizie dalla community BMX italiana.',
    url: 'https://maps.chrispybmx.com/news',
    siteName: 'Chrispy Maps',
    locale: 'it_IT',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', site: '@chrispy_bmx', title: 'News BMX — Chrispy Maps' },
};

export const dynamic = 'force-dynamic';

interface NewsItem {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  cover_url?: string;
  tags?: string;
  published_at?: string;
  created_at: string;
  submitted_by_username?: string;
}

async function getNews(): Promise<NewsItem[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://chrispybmx.com';
    const res = await fetch(`${baseUrl}/api/news`, { cache: 'no-store' });
    const json = await res.json();
    return json.data ?? [];
  } catch { return []; }
}

export default async function NewsPage() {
  const news = await getNews();

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
            📰 COMMUNITY
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px 60px' }}>

        {/* CTA */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <ScriviPostBtn />
        </div>

        {news.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--bone)', marginBottom: 8 }}>Nessun post ancora</div>
            <div style={{ color: 'var(--gray-400)', fontSize: 13, marginBottom: 20 }}>Sii il primo a scrivere!</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {news.map((item, i) => <ForumRow key={item.id} item={item} isFirst={i === 0} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Forum-style row ── */
function ForumRow({ item, isFirst }: { item: NewsItem; isFirst: boolean }) {
  const date = item.published_at
    ? new Date(item.published_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
    : '';
  const tags = item.tags ? item.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const author = item.submitted_by_username;

  return (
    <Link href={`/news/${item.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
      <article style={{
        display: 'flex', gap: 12, alignItems: 'center',
        padding: '14px 14px',
        background: isFirst ? 'rgba(255,106,0,0.04)' : 'transparent',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        borderLeft: isFirst ? '3px solid var(--orange)' : '3px solid transparent',
        transition: 'background 0.1s, border-color 0.1s',
        cursor: 'pointer',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,106,0,0.06)'; (e.currentTarget as HTMLElement).style.borderLeftColor = 'var(--orange)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isFirst ? 'rgba(255,106,0,0.04)' : 'transparent'; (e.currentTarget as HTMLElement).style.borderLeftColor = isFirst ? 'var(--orange)' : 'transparent'; }}
      >
        {/* Thumbnail or emoji */}
        {item.cover_url ? (
          <div style={{
            width: 52, height: 52, borderRadius: 6, overflow: 'hidden',
            flexShrink: 0, background: 'var(--gray-800)',
          }}>
            <img src={item.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
          </div>
        ) : (
          <div style={{
            width: 52, height: 52, borderRadius: 6, flexShrink: 0,
            background: 'var(--gray-800)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>
            📝
          </div>
        )}

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
            {author && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)' }}>
                @{author}
              </span>
            )}
            {date && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gray-500)' }}>
                {date}
              </span>
            )}
            {tags.slice(0, 2).map(t => (
              <span key={t} style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--gray-400)',
                border: '1px solid var(--gray-700)', borderRadius: 8, padding: '1px 6px',
              }}>
                #{t}
              </span>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <span style={{ color: 'var(--gray-600)', fontSize: 16, flexShrink: 0 }}>›</span>
      </article>
    </Link>
  );
}
