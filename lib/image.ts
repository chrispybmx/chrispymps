import sharp from 'sharp';

export interface OptimizeResult {
  buffer: Buffer;
  contentType: 'image/jpeg';
  ext: 'jpg';
}

/**
 * Ottimizza un'immagine per il web:
 *  - auto-orient dai dati EXIF, poi scarta i metadati (privacy: niente GPS)
 *  - resize entro maxDim sul lato lungo (mai ingrandire)
 *  - JPEG mozjpeg alla qualità data
 *
 * Ritorna SEMPRE JPEG: le foto degli spot/cover/flyer sono immagini naturali,
 * dove il JPEG q85 è indistinguibile dall'originale su schermo ma pesa ~85% in
 * meno. Questo taglia storage ed egress (il piano Supabase FREE ha 5GB/mese di
 * banda: foto PNG da 2MB la esaurivano). Prima qui si faceva solo .rotate(),
 * quindi le foto finivano nello storage a piena risoluzione.
 */
export async function optimizeImage(
  input: Buffer,
  opts: { maxDim?: number; quality?: number } = {},
): Promise<OptimizeResult> {
  const { maxDim = 1600, quality = 85 } = opts;
  const buffer = await sharp(input)
    .rotate() // applica l'orientamento EXIF, poi i metadati vengono scartati
    .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
  return { buffer, contentType: 'image/jpeg', ext: 'jpg' };
}
