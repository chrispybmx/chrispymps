import sharp from 'sharp';

export interface OptimizeResult {
  buffer: Buffer;
  contentType: 'image/jpeg' | 'image/webp';
  ext: 'jpg' | 'webp';
}

/**
 * Ottimizza un'immagine per il web:
 *  - auto-orient dai dati EXIF, poi scarta i metadati (privacy: niente GPS)
 *  - resize entro maxDim sul lato lungo (mai ingrandire)
 *  - encoding: JPEG per foto opache, WebP se c'è un canale alpha
 *
 * Perché due formati: le foto naturali in JPEG q85 sono indistinguibili
 * dall'originale su schermo e pesano ~85% in meno (il piano Supabase FREE ha
 * 5GB/mese di banda: le foto a piena risoluzione la esaurivano). Ma il JPEG NON
 * supporta la trasparenza: un flyer o un logo PNG con sfondo trasparente
 * diventerebbe nero. Per quelli si usa WebP, che mantiene l'alpha e comprime
 * comunque molto meglio del PNG.
 */
export async function optimizeImage(
  input: Buffer,
  opts: { maxDim?: number; quality?: number } = {},
): Promise<OptimizeResult> {
  const { maxDim = 1600, quality = 85 } = opts;

  // hasAlpha: decide il formato di uscita. Se i metadati non sono leggibili si
  // assume opaco (JPEG), come per qualunque foto.
  let hasAlpha = false;
  try {
    hasAlpha = (await sharp(input).metadata()).hasAlpha === true;
  } catch { /* formato illeggibile: ci penserà la pipeline sotto */ }

  const pipeline = sharp(input)
    .rotate() // applica l'orientamento EXIF, poi i metadati vengono scartati
    .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true });

  if (hasAlpha) {
    const buffer = await pipeline.webp({ quality }).toBuffer();
    return { buffer, contentType: 'image/webp', ext: 'webp' };
  }

  const buffer = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
  return { buffer, contentType: 'image/jpeg', ext: 'jpg' };
}
