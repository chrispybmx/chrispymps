import { describe, expect, it } from 'vitest';
import { youtubeEmbedUrl } from '@/lib/youtube';

const EMBED = 'https://www.youtube-nocookie.com/embed/abc123XYZ_-?rel=0';

describe('youtubeEmbedUrl', () => {
  it.each([
    'https://www.youtube.com/watch?v=abc123XYZ_-',
    'https://youtube.com/watch?v=abc123XYZ_-&t=30s',
    'https://www.youtube.com/watch?feature=share&v=abc123XYZ_-',
    'https://youtu.be/abc123XYZ_-?si=xyz',
    'https://www.youtube.com/shorts/abc123XYZ_-',
    'https://www.youtube.com/embed/abc123XYZ_-',
    'https://m.youtube.com/watch?v=abc123XYZ_-',
  ])('builds a clean embed url from %s', (url) => {
    expect(youtubeEmbedUrl(url)).toBe(EMBED);
  });

  it('returns null for non-youtube or empty urls', () => {
    expect(youtubeEmbedUrl('https://vimeo.com/123')).toBeNull();
    expect(youtubeEmbedUrl('https://www.youtube.com/@chrispy_bmx')).toBeNull();
    expect(youtubeEmbedUrl(null)).toBeNull();
  });
});
