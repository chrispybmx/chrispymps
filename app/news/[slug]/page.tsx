import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  body?: string;
  cover_url?: string;
  tags?: string;
  published_at?: string;
  created_at: string;
}

async function getArticle(slug: string): Promise<NewsArticle | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://chrispybmx.com';
    const res = await fetch(`${baseUrl}/api/news/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const article = await getArticle(params.slug);
  if (!article) return { title: 'Non trovato — Chrispy Maps' };
  return {
    title: `${article.title} — Chrispy Maps`,
    description: article.excerpt ?? 'Leggi su Chrispy Maps',
    openGraph: article.cover_url ? { images: [article.cover_url] } : undefined,
  };
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const article = await getArticle(params.slug);
  if (!article) notFound();

  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const tags = article.tags ? article.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  // Parse body — support simple markdown-like: **bold**, *italic*, # headings, - lists, blank lines = paragraphs
  const renderBody = (text: string) => {
    return text
      .split('\n\n')
      .map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Heading
        if (trimmed.startsWith('# ')) return (
          <h2 key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--orange)', margin: '28px 0 10px', lineHeight: 1.3 }}>
            {trimmed.slice(2)}
          </h2>
        );
        if (trimmed.startsWith('## ')) return (
          <h3 key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--bone)', margin: '22px 0 8px', lineHeight: 1.3 }}>
            {trimmed.slice(3)}
          </h3>
        );

        // Bullet list
        if (trimmed.split('\n').every(l => l.startsWith('- '))) {
          const items = trimmed.split('\n').map(l => l.slice(2));
          return (
            <ul key={i} style={{ margin: '0 0 16px', paddingLeft: 20 }}>
              {items.map((item, j) => (
                <li key={j} style={{ color: 'var(--bone)', fontSize: 16, lineHeight: 1.7, marginBottom: 4 }}
                  dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
              ))}
            </ul>
          );
        }

        // Regular paragraph
        return (
          <p key={i} style={{ color: 'var(--bone)', fontSize: 16, lineHeight: 1.8, margin: '0 0 18px' }}
            dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed.replace(/\n/g, '<br/>')) }} />
        );
      });
  };

  const inlineFormat = (text: string) =>
    text
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--orange)">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');

  return (
    <div style={{ background: 'var(--black)', minHeight: '100dvh' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--gray-700)', background: 'rgba(10,10,10,0.98)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/news" style={{ color: 'var(--gray-400)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            ← News
          </Link>
          <div style={{ flex: 1 }} />
          <Link href="/map" style={{ color: 'var(--gray-400)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            🗺️ Mappa
          </Link>
        </div>
      </div>

      {/* Cover */}
      {article.cover_url && (
        <div style={{ width: '100%', maxHeight: 420, overflow: 'hidden', position: 'relative' }}>
          <img
            src={article.cover_url}
            alt={article.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, var(--black) 100%)' }} />
        </div>
      )}

      {/* Content */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: article.cover_url ? '0 20px 60px' : '32px 20px 60px' }}>

        {/* Meta */}
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {date && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-400)', textTransform: 'capitalize' }}>
              {date}
            </span>
          )}
          {tags.map(t => (
            <span key={t} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--orange)', border: '1px solid rgba(255,106,0,0.3)', borderRadius: 10, padding: '1px 7px' }}>
              #{t}
            </span>
          ))}
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'clamp(22px, 5vw, 32px)',
          color: 'var(--bone)',
          margin: '0 0 12px',
          lineHeight: 1.25,
        }}>
          {article.title}
        </h1>

        {/* Excerpt (lead) */}
        {article.excerpt && (
          <p style={{
            fontSize: 18,
            color: 'var(--gray-400)',
            lineHeight: 1.6,
            margin: '0 0 28px',
            borderLeft: '3px solid var(--orange)',
            paddingLeft: 14,
          }}>
            {article.excerpt}
          </p>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--gray-700)', marginBottom: 28 }} />

        {/* Body */}
        <div>
          {article.body
            ? renderBody(article.body)
            : <p style={{ color: 'var(--gray-400)', fontFamily: 'var(--font-mono)', fontSize: 15 }}>Nessun contenuto disponibile.</p>
          }
        </div>

        {/* Footer nav */}
        <div style={{ marginTop: 48, paddingTop: 20, borderTop: '1px solid var(--gray-700)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/news" style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--orange)', textDecoration: 'none' }}>
            ← Tutte le news
          </Link>
          <Link href="/map" style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)', textDecoration: 'none', border: '1px solid var(--gray-700)', padding: '8px 16px', borderRadius: 4 }}>
            🗺️ Vai alla mappa
          </Link>
        </div>
      </div>
    </div>
  );
}
