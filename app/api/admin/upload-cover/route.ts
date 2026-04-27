import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg':  'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
};

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB

function isValidImageMagicBytes(buf: Buffer, mimeType: string): boolean {
  if (buf.length < 4) return false;
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg':
      return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
    case 'image/png':
      return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    case 'image/webp':
      return buf.length >= 12
        && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
        && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
    case 'image/gif':
      return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
    default:
      return false;
  }
}

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

  const file = formData.get('file');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: 'Nessun file ricevuto' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ ok: false, error: 'File troppo grande (max 8MB)' }, { status: 400 });
  }

  const mimeType = file.type.toLowerCase();
  const ext = ALLOWED_MIME[mimeType];
  if (!ext) {
    return NextResponse.json({ ok: false, error: 'Formato non supportato (JPG, PNG, WebP, GIF)' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!isValidImageMagicBytes(buffer, mimeType)) {
    return NextResponse.json({ ok: false, error: 'File non valido' }, { status: 400 });
  }

  const path = `covers/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const supabase = supabaseAdmin();

  const { error: uploadErr } = await supabase.storage
    .from('spot-photos')
    .upload(path, buffer, { contentType: mimeType, upsert: false });

  if (uploadErr) {
    console.error('[upload-cover]', uploadErr.message);
    return NextResponse.json({ ok: false, error: uploadErr.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from('spot-photos').getPublicUrl(path);
  return NextResponse.json({ ok: true, url: urlData.publicUrl });
}
