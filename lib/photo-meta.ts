import type { PhotoMeta } from './photo-check';

/* Metadati letti dal file ORIGINALE prima della compressione (che li cancella).
   Legati al file compresso tramite WeakMap: nessuno stato da passare fra
   componenti, e si liberano da soli quando la foto viene tolta.
   Ogni errore o lentezza viene ignorato: la verifica non deve mai rallentare
   o bloccare l'aggiunta di una foto. */
const metaByFile = new WeakMap<Blob, PhotoMeta>();
const READ_TIMEOUT_MS = 1500;

export async function readPhotoMeta(file: Blob): Promise<PhotoMeta> {
  try {
    const exifr = (await import('exifr')).default;
    const read = exifr.parse(await file.arrayBuffer(), {
      gps: true, tiff: true, exif: true,
      pick: ['latitude', 'longitude', 'DateTimeOriginal', 'Make', 'Model'],
    });
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), READ_TIMEOUT_MS));
    const tags = await Promise.race([read, timeout]);
    if (!tags) return {};
    const taken = tags.DateTimeOriginal instanceof Date ? tags.DateTimeOriginal.toISOString() : undefined;
    const camera = [tags.Make, tags.Model].filter((v) => typeof v === 'string' && v.trim()).join(' ');
    return {
      lat: typeof tags.latitude === 'number' ? tags.latitude : undefined,
      lon: typeof tags.longitude === 'number' ? tags.longitude : undefined,
      takenAt: taken,
      camera: camera || undefined,
    };
  } catch {
    return {};
  }
}

export function rememberPhotoMeta(file: Blob, meta: PhotoMeta): void {
  metaByFile.set(file, meta);
}

export function photoMetaFor(file: Blob): PhotoMeta {
  return metaByFile.get(file) ?? {};
}
