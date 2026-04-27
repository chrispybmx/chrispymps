import type { MetadataRoute } from 'next';
import { APP_CONFIG } from '@/lib/constants';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      /* Regole generali — tutti i crawler */
      {
        userAgent: '*',
        allow:    '/',
        disallow: ['/admin/', '/api/', '/_next/'],
      },
      /* AI crawlers — accesso esplicito per essere citati nelle risposte AI.
         Questi bot alimentano ChatGPT, Perplexity, Claude, Gemini, Copilot ecc. */
      { userAgent: 'GPTBot',            allow: '/' },  // OpenAI / ChatGPT
      { userAgent: 'ChatGPT-User',      allow: '/' },  // ChatGPT browsing
      { userAgent: 'OAI-SearchBot',     allow: '/' },  // OpenAI Search
      { userAgent: 'PerplexityBot',     allow: '/' },  // Perplexity AI
      { userAgent: 'Claude-Web',        allow: '/' },  // Anthropic Claude
      { userAgent: 'ClaudeBot',         allow: '/' },  // Anthropic Claude
      { userAgent: 'Google-Extended',   allow: '/' },  // Google Gemini / Bard
      { userAgent: 'Googlebot',         allow: '/' },  // Google Search
      { userAgent: 'cohere-ai',         allow: '/' },  // Cohere
      { userAgent: 'anthropic-ai',      allow: '/' },  // Anthropic
      { userAgent: 'Meta-ExternalAgent',allow: '/' },  // Meta AI
      { userAgent: 'Applebot',          allow: '/' },  // Apple Siri / Spotlight
      { userAgent: 'Bingbot',           allow: '/' },  // Microsoft Bing / Copilot
      { userAgent: 'DuckDuckBot',       allow: '/' },  // DuckDuckGo
      { userAgent: 'YouBot',            allow: '/' },  // You.com AI
      { userAgent: 'ia_archiver',       allow: '/' },  // Internet Archive
    ],
    sitemap: `${APP_CONFIG.url}/sitemap.xml`,
    host:    APP_CONFIG.url,
  };
}
