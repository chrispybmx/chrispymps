/** Percorso nel bucket spot-photos ricavato dall'URL pubblico; null se non valido o sospetto. */
export function spotPhotoStoragePath(publicUrl: string): string | null {
  try {
    const storagePath = new URL(publicUrl).pathname.split('/spot-photos/')[1];
    if (!storagePath || storagePath.includes('..') || storagePath.startsWith('/')) return null;
    return storagePath;
  } catch {
    return null;
  }
}
