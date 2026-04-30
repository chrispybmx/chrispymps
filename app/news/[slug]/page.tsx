import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { APP_CONFIG } from '@/lib/constants';
import NewsComments from '@/components/NewsComments';
import { supabaseServer } from '@/lib/supabase';

interface NewsPhoto {
  id: string;
  url: string;
  position: number;
  caption?: string | null;
}

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
  news_photos?: NewsPhoto[];
}

async function getArticle(slug: string): Promise<NewsArticle | null> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('news')
    .select('id, slug, title, excerpt, body, cover_url, tags, published_at, created_at, news_photos(id, url, position, caption)')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error) {
    console.error('[news/slug] Supabase error:', error.message);
    return null;
  }

  if (data?.news_photos) {
    data.news_photos.sort((a: { position: number }, b: { position: number }) => a.position - b.position);
  }
  return data as NewsArticle | null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const article = await getArticle(params.slug);
  if (!article) return { title: 'Non trovato — Chrispy Maps' };

  const url         = `${APP_CONFIG.url}/news/${article.slug}`;
  const title       = `${article.title} | Chrispy Maps`;
  const description = article.excerpt ?? `Leggi "${article.title}" su Chrispy Maps — news BMX, skate e scooter dall'Italia.`;
  const tags        = article.tags ? article.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const coverImg    = article.cover_url ?? '/opengraph-image';
  const publishedAt = article.published_at ?? article.created_at;

  return {
    title,
    description,
    alternates: { canonical: url },
    keywords: [
      ...tags,
      'news BMX', 'notizie skate', 'BMX Italia', 'Chrispy BMX',
      'scooter freestyle', 'street BMX', 'skatepark Italia',
    ],
    authors: [{ name: 'Chrispy BMX', url: APP_CONFIG.url }],
    openGraph: {
      type:          'article',
      url,
      title,
      description,
      siteName:      'Chrispy Maps',
      locale:        'it_IT',
      publishedTime: publishedAt,
      modifiedTime:  article.created_at,
      authors:       ['Chrispy BMX'],
      tags,
      images: [{
        url:    coverImg,
        width:  1200,
        height: 630,
        alt:    article.title,
      }],
    },
    twitter: {
      card:        'summary_large_image',
      site:        '@chrispy_bmx',
      creator:     '@chrispy_bmx',
      title,
      description,
      images: [coverImg],
    },
  };
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const article = await getArticle(params.slug);
  if (!article) notFound();

  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const tags = article.tags ? article.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  const articleJsonLd = {
    '@context':        'https://schema.org',
    '@type':           'NewsArticle',
    headline:          article.title,
    description:       article.excerpt ?? '',
    url:               `${APP_CONFIG.url}/news/${article.slug}`,
    datePublished:     article.published_at ?? article.created_at,
    dateModified:      article.created_at,
    inLanguage:        'it-IT',
    image:             article.cover_url ? [article.cover_url] : [`${APP_CONFIG.url}/opengraph-image`],
    author: [{
      '@type': 'Person',
      name:    'Christian Ceresato',
      url:     'https://www.instagram.com/chrispy_bmx',
      alternateName: 'Chrispy BMX',
    }],
    publisher: {
      '@type': 'Organization',
      name:    'Chrispy Maps',
      url:     APP_CONFIG.url,
      logo: {
        '@type': 'ImageObject',
        url:     `${APP_CONFIG.url}/opengraph-image`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id':   `${APP_CONFIG.url}/news/${article.slug}`,
    },
    keywords: tags.join(', '),
    about: {
      '@type': 'Thing',
      name:    'BMX, Skateboarding, Scooter Freestyle',
    },
  };

  // YouTube URL → embed video ID extraction
  const YT_RE = /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})(?:[&?].*)?$/;

  const getYouTubeId = (url: string): string | null => {
    const m = url.match(YT_RE);
    return m ? m[1] : null;
  };

  // Parse body — support simple markdown-like: **bold**, *italic*, # headings, - lists, blank lines = paragraphs, YouTube embeds
  const renderBody = (text: string) => {
    return text
      .split('\n\n')
      .map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // YouTube embed — standalone URL on its own block
        const ytId = getYouTubeId(trimmed);
        if (ytId) return (
          <div key={i} style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 8, margin: '0 0 18px' }}>
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?rel=0`}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Video"
              loading="lazy"
            />
          </div>
        );

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
            dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed) }} />
        );
      });
  };

  const escapeHtml = (text: string) =>
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const inlineFormat = (text: string) =>
    escapeHtml(text)
      .replace(/\n/g, '<br/>')
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--orange)">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/https?:\/\/[^\s<&]+/g, (url) => {
        const decoded = url.replace(/&amp;/g, '&');
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:var(--orange);text-decoration:underline">${decoded}</a>`;
      });

  return (
    <div style={{ background: 'var(--black)', minHeight: '100dvh' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--gray-700)', background: 'rgba(10,10,10,0.98)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/news" style={{ color: 'var(--gray-400)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            ← News
          </Link>
          <div style={{ flex: 1 }} />
          <Link href="/" style={{ color: 'var(--gray-400)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            🗺️ Mappa
          </Link>
        </div>
      </div>

      {/* Cover */}
      {article.cover_url && (
        <div className="news-cover-wrap" style={{ width: '100%', maxHeight: 420, overflow: 'hidden', position: 'relative' }}>
          <img
            className="news-cover-img"
            src={article.cover_url}
            alt={article.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <div className="news-cover-gradient" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, var(--black) 100%)' }} />
        </div>
      )}

      {/* Content */}
      <div className="news-content-wrap" style={{ maxWidth: 680, margin: '0 auto', padding: article.cover_url ? '0 20px 60px' : '32px 20px 60px' }}>

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

        {/* Extra photos */}
        {article.news_photos && article.news_photos.length > 0 && (
          <div style={{ margin: '28px 0 24px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: article.news_photos.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 12,
            }}>
              {article.news_photos.map(photo => (
                <div key={photo.id}>
                  <img
                    className="news-extra-photo"
                    src={photo.url}
                    alt={photo.caption ?? ''}
                    style={{ width: '100%', maxHeight: 520, objectFit: 'cover', borderRadius: 8, display: 'block' }}
                    loading="lazy"
                  />
                  {photo.caption && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gray-500)', marginTop: 6, textAlign: 'center' }}>
                      {photo.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        <NewsComments newsId={article.id} newsSlug={article.slug} />

        {/* Footer nav */}
        <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--gray-700)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/news" style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--orange)', textDecoration: 'none' }}>
            ← Tutte le news
          </Link>
          <Link href="/" style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--gray-400)', textDecoration: 'none', border: '1px solid var(--gray-700)', padding: '8px 16px', borderRadius: 4 }}>
            🗺️ Vai alla mappa
          </Link>
        </div>
      </div>
    </div>
  );
}
