import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { readPhotoMeta, rememberPhotoMeta, photoMetaFor } from '@/lib/photo-meta';

describe('readPhotoMeta', () => {
  it('file rovinato: nessun errore, nessun dato', async () => {
    await expect(readPhotoMeta(new Blob([new Uint8Array([1, 2, 3, 4])]))).resolves.toEqual({});
  });

  it('foto senza metadati (come dopo uno screenshot)', async () => {
    const jpg = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#888' } }).jpeg().toBuffer();
    const meta = await readPhotoMeta(new Blob([new Uint8Array(jpg)]));
    expect(meta.lat).toBeUndefined();
    expect(meta.camera).toBeUndefined();
  });

  it('foto con marca fotocamera', async () => {
    const jpg = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#888' } })
      .jpeg().withExif({ IFD0: { Make: 'Apple', Model: 'iPhone 15' } }).toBuffer();
    expect((await readPhotoMeta(new Blob([new Uint8Array(jpg)]))).camera).toBe('Apple iPhone 15');
  });

  it('i metadati seguono il file compresso', () => {
    const f = new Blob(['x']);
    rememberPhotoMeta(f, { camera: 'X' });
    expect(photoMetaFor(f)).toEqual({ camera: 'X' });
    expect(photoMetaFor(new Blob(['y']))).toEqual({});
  });
});
