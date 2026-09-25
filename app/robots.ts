import type { MetadataRoute } from 'next';
import { APP_CONFIG } from '@/lib/constants';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      /* Regole generali — tutti i crawler */
      {
        userAgent: '*',
        allow:    '/',
        disallow: ['/admin/', '/api/', '/messaggi'],
      },
      /* AI crawlers — accesso esplicito per essere citati nelle risposte AI.
         Questi bot alimentano ChatGPT, Perplexity, Claude, Gemini, Copilot ecc. */
      { userAgent: 'GPTBot',            allow: '/', disallow: ['/admin/', '/api/', '/messaggi'] },  // OpenAI / ChatGPT
      { userAgent: 'ChatGPT-User',      allow: '/', disallow: ['/admin/', '/api/', '/messaggi'] },  // ChatGPT browsing
      { userAgent: 'OAI-SearchBot',     allow: '/', disallow: ['/admin/', '/api/', '/messaggi'] },  // OpenAI Search
      { userAgent: 'PerplexityBot',     allow: '/', disallow: ['/admin/', '/api/', '/messaggi'] },  // Perplexity AI
      { userAgent: 'Claude-Web',        allow: '/', disallow: ['/admin/', '/api/', '/messaggi'] },  // Anthropic Claude
      { userAgent: 'ClaudeBot',         allow: '/', disallow: ['/admin/', '/api/', '/messaggi'] },  // Anthropic Claude
      { userAgent: 'Google-Extended',   allow: '/', disallow: ['/admin/', '/api/', '/messaggi'] },  // Google Gemini / Bard
      { userAgent: 'Googlebot',         allow: '/', disallow: ['/admin/', '/api/', '/messaggi'] },  // Google Search
      { userAgent: 'cohere-ai',         allow: '/', disallow: ['/admin/', '/api/', '/messaggi'] },  // Cohere
      { userAgent: 'anthropic-ai',      allow: '/', disallow: ['/admin/', '/api/', '/messaggi'] },  // Anthropic
      { userAgent: 'Meta-ExternalAgent',allow: '/', disallow: ['/admin/', '/api/', '/messaggi'] },  // Meta AI
      { userAgent: 'Applebot',          allow: '/', disallow: ['/admin/', '/api/', '/messaggi'] },  // Apple Siri / Spotlight
      { userAgent: 'Bingbot',           allow: '/', disallow: ['/admin/', '/api/', '/messaggi'] },  // Microsoft Bing / Copilot
      { userAgent: 'DuckDuckBot',       allow: '/', disallow: ['/admin/', '/api/', '/messaggi'] },  // DuckDuckGo
      { userAgent: 'YouBot',            allow: '/', disallow: ['/admin/', '/api/', '/messaggi'] },  // You.com AI
      { userAgent: 'ia_archiver',       allow: '/', disallow: ['/admin/', '/api/', '/messaggi'] },  // Internet Archive
    ],
    sitemap: `${APP_CONFIG.url}/sitemap.xml`,
    host:    APP_CONFIG.url,
  };
}
