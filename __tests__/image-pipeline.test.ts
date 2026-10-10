import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { optimizeImage } from '@/lib/image';

describe('actual photo optimization', () => {
  it('rotates photos, limits their dimensions and removes EXIF', async () => {
    const input = await sharp({ create: { width: 40, height: 20, channels: 3, background: '#008855' } })
      .jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const result = await optimizeImage(input, { maxDim: 20 });
    const meta = await sharp(result.buffer).metadata();
    expect(result.contentType).toBe('image/jpeg');
    expect(meta.width).toBe(10);
    expect(meta.height).toBe(20);
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
  });

  it('rejects oversized decoded images before processing their pixels', async () => {
    const input = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8000" height="8000"><rect width="8000" height="8000" fill="red"/></svg>');
    await expect(optimizeImage(input)).rejects.toThrow(/pixel limit/i);
  });

  it('keeps transparent images transparent and does not enlarge them', async () => {
    const input = await sharp({ create: { width: 8, height: 12, channels: 4, background: '#00885580' } }).png().toBuffer();
    const result = await optimizeImage(input);
    const meta = await sharp(result.buffer).metadata();
    expect(result.contentType).toBe('image/webp');
    expect(meta.hasAlpha).toBe(true);
    expect(meta.width).toBe(8);
    expect(meta.height).toBe(12);
  });
});
