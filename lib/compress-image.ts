/**
 * Comprime un'immagine client-side via Canvas API.
 * Da 9MB (foto iPhone) si scende a ~400-700KB.
 *
 * @param file     File originale
 * @param maxSide  Lato massimo in pixel (default 2048)
 * @param quality  Qualità JPEG 0–1 (default 0.85)
 */
export async function compressImage(
  file: File,
  maxSide = 2048,
  quality = 0.85,
): Promise<File> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      let w = img.naturalWidth;
      let h = img.naturalHeight;

      /* Ridimensiona solo se necessario */
      if (w > maxSide || h > maxSide) {
        if (w >= h) { h = Math.round(h * maxSide / w); w = maxSide; }
        else        { w = Math.round(w * maxSide / h); h = maxSide; }
      }

      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }

      /* Sfondo bianco per PNG con trasparenza (salvato come JPEG) */
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          /* Rinomina con .jpg perché l'output è sempre JPEG */
          const name = file.name.replace(/\.[^.]+$/, '.jpg');
          resolve(new File([blob], name, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality,
      );
    };

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
