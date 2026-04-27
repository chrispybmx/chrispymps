import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'News BMX — Chrispy Maps',
  description: 'Ultime notizie, aggiornamenti spot e contenuti dalla community BMX italiana.',
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
            📰 NEWS
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 60px' }}>
        {news.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📰</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--bone)', marginBottom: 8 }}>Nessuna news ancora</div>
            <div style={{ color: 'var(--gray-400)', fontSize: 14 }}>Torna presto per aggiornamenti!</div>
            <Link href="/" style={{ display: 'inline-block', marginTop: 24, fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--orange)', textDecoration: 'none', border: '1px solid var(--orange)', padding: '10px 20px', borderRadius: 4 }}>
              ← Torna alla mappa
            </Link>
          </div>
        ) : (
          news.map((item, i) => <NewsCard key={item.id} item={item} featured={i === 0} />)
        )}
      </div>
    </div>
  );
}

function NewsCard({ item, featured }: { item: NewsItem; featured?: boolean }) {
  const date = item.published_at
    ? new Date(item.published_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const tags = item.tags ? item.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  return (
    <Link href={`/news/${item.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
      <article style={{
        background: 'var(--gray-800)',
        border: `1px solid ${featured ? 'var(--orange)' : 'var(--gray-700)'}`,
        borderRadius: 10, overflow: 'hidden',
        marginBottom: 14, cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.1s',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--orange)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = featured ? 'var(--orange)' : 'var(--gray-700)'; (e.currentTarget as HTMLElement).style.transform = ''; }}
      >
        {item.cover_url && (
          <div style={{ height: featured ? 220 : 160, overflow: 'hidden' }}>
            <img src={item.cover_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
          </div>
        )}
        <div style={{ padding: featured ? '18px 18px' : '14px 16px' }}>
          {featured && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              ⭐ ULTIMO ARTICOLO
            </div>
          )}
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: featured ? 20 : 17, color: 'var(--bone)', margin: '0 0 6px', lineHeight: 1.3 }}>
            {item.title}
          </h2>
          {item.excerpt && (
            <p style={{ color: 'var(--gray-400)', fontSize: 14, lineHeight: 1.5, margin: '0 0 10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {item.excerpt}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {date && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-400)' }}>{date}</span>}
            {tags.map(t => (
              <span key={t} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)', border: '1px solid rgba(255,106,0,0.3)', borderRadius: 10, padding: '1px 7px' }}>
                #{t}
              </span>
            ))}
            <span style={{ marginLeft: 'auto', color: 'var(--orange)', fontSize: 16 }}>→</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
