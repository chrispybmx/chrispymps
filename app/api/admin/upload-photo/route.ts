import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Tipi MIME accettati e corrispondente estensione sicura
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg':  'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
};

// Limite dimensione: 8MB per foto
const MAX_FILE_SIZE = 8 * 1024 * 1024;

// Validazione UUID v4
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Request non valida' }, { status: 400 });
  }

  const spotId = formData.get('spot_id');
  if (!spotId || typeof spotId !== 'string' || !UUID_RE.test(spotId)) {
    return NextResponse.json({ ok: false, error: 'spot_id non valido' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // Conta foto esistenti per determinare la posizione
  const { data: existing } = await supabase
    .from('spot_photos')
    .select('position')
    .eq('spot_id', spotId)
    .order('position', { ascending: false })
    .limit(1);

  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;

  const uploadedUrls: string[] = [];
  let position = nextPosition;

  for (let i = 0; i < 10; i++) {
    const file = formData.get(`photo_${i}`);
    if (!file || !(file instanceof Blob)) break;

    // Valida dimensione
    if (file.size > MAX_FILE_SIZE) {
      console.warn(`[upload-photo] File ${i} troppo grande: ${file.size} bytes`);
      continue;
    }

    // Valida MIME type (dalla dichiarazione del client)
    const mimeType = file.type.toLowerCase();
    const ext = ALLOWED_MIME[mimeType];
    if (!ext) {
      console.warn(`[upload-photo] Tipo file non permesso: ${mimeType}`);
      continue;
    }

    // Leggi i magic bytes per verificare che il file sia davvero un'immagine
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!isValidImageMagicBytes(buffer, mimeType)) {
      console.warn(`[upload-photo] Magic bytes non corrispondono al tipo ${mimeType}`);
      continue;
    }

    const path = `${spotId}/${Date.now()}_${i}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('spot-photos')
      .upload(path, buffer, { contentType: mimeType, upsert: false });

    if (uploadErr) {
      console.error('[upload-photo] upload error:', uploadErr.message);
      continue;
    }

    const { data: urlData } = supabase.storage.from('spot-photos').getPublicUrl(path);

    await supabase.from('spot_photos').insert({
      spot_id:  spotId,
      url:      urlData.publicUrl,
      position: position++,
    });

    uploadedUrls.push(urlData.publicUrl);
  }

  if (uploadedUrls.length === 0) {
    return NextResponse.json({ ok: false, error: 'Nessuna foto caricata' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, urls: uploadedUrls });
}

/** Verifica i magic bytes del file per JPEG, PNG, WebP, GIF */
function isValidImageMagicBytes(buf: Buffer, mimeType: string): boolean {
  if (buf.length < 4) return false;
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg':
      // JPEG: FF D8 FF
      return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
    case 'image/png':
      // PNG: 89 50 4E 47
      return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    case 'image/webp':
      // WebP: RIFF....WEBP
      return buf.length >= 12
        && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
        && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
    case 'image/gif':
      // GIF: GIF87a o GIF89a
      return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
    default:
      return false;
  }
}
