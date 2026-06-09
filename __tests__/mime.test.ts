import { describe, it, expect } from 'vitest';
import { detectMime, MIME_EXT } from '@/lib/mime';

/** Costruisce un ArrayBuffer da una lista di byte (pad a 16 byte). */
function buf(bytes: number[]): ArrayBuffer {
  const arr = new Uint8Array(16);
  arr.set(bytes);
  return arr.buffer;
}

describe('detectMime — riconosce i magic bytes', () => {
  it('JPEG (FF D8 FF)', () => {
    expect(detectMime(buf([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
  });

  it('PNG (89 50 4E 47)', () => {
    expect(detectMime(buf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe('image/png');
  });

  it('WebP (RIFF....WEBP)', () => {
    // 0-3: RIFF, 4-7: size, 8-11: WEBP
    expect(detectMime(buf([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]))).toBe('image/webp');
  });

  it('HEIC (ftyp heic)', () => {
    // 4-7: ftyp, 8-11: heic
    expect(detectMime(buf([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
    ]))).toBe('image/heic');
  });
});

describe('detectMime — rifiuta input non-immagine', () => {
  it('ritorna null su byte casuali / vuoti', () => {
    expect(detectMime(buf([0x00, 0x01, 0x02, 0x03]))).toBeNull();
    expect(detectMime(buf([]))).toBeNull();
    // PDF (%PDF) non è un formato immagine accettato
    expect(detectMime(buf([0x25, 0x50, 0x44, 0x46]))).toBeNull();
  });

  it('RIFF senza WEBP non passa come webp', () => {
    // RIFF ma con AVI invece di WEBP a offset 8
    expect(detectMime(buf([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20,
    ]))).toBeNull();
  });
});

describe('MIME_EXT — mappa estensioni', () => {
  it('mappa ogni MIME alla sua estensione', () => {
    expect(MIME_EXT['image/jpeg']).toBe('jpg');
    expect(MIME_EXT['image/png']).toBe('png');
    expect(MIME_EXT['image/webp']).toBe('webp');
    expect(MIME_EXT['image/heic']).toBe('heic');
  });
});
