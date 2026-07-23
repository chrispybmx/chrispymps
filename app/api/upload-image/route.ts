import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { detectMime, MIME_EXT } from '@/lib/mime';
import { optimizeImage } from '@/lib/image';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * POST /api/upload-image
 * Authenticated user uploads a single image (event flyer, news cover, etc.)
 * Returns the public URL.
 */
export async function POST(req: NextRequest) {
  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ ok: false, error: 'Request non valida' }, { status: 400 }); }

  const token = formData.get('access_token') as string | null;
  const purpose = formData.get('purpose') as string | null; // 'event' | 'news' | 'general'
  const file = formData.get('file') as File | null;

  if (!token) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 });
  if (!file) return NextResponse.json({ ok: false, error: 'Nessun file' }, { status: 400 });

  const sb = supabaseAdmin();

  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ ok: false, error: 'Token non valido' }, { status: 401 });

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ ok: false, error: 'File troppo grande (max 5MB)' }, { status: 400 });
  }

  const buf = await file.arrayBuffer();
  const mime = detectMime(buf);
  if (!mime || !MIME_EXT[mime]) {
    return NextResponse.json({ ok: false, error: 'Formato non supportato. Usa JPEG, PNG o WebP.' }, { status: 400 });
  }

  // Ottimizza (resize+JPEG) e strip EXIF/GPS. Flyer event/news hanno testo:
  // risoluzione e qualità più alte per non sfocarlo.
  const isFlyer = purpose === 'event' || purpose === 'news';
  const { buffer: optimized, contentType, ext } = await optimizeImage(
    Buffer.from(buf),
    isFlyer ? { maxDim: 2000, quality: 88 } : {},
  );

  const folder = purpose === 'event' ? 'events' : purpose === 'news' ? 'news' : 'uploads';
  const filename = `${folder}/${user.id}_${Date.now()}.${ext}`;

  const { error: uploadErr } = await sb.storage
    .from('spot-photos') // reuse existing bucket
    .upload(filename, optimized, { contentType, upsert: false });

  if (uploadErr) {
    console.error('[upload-image] error:', uploadErr);
    return NextResponse.json({ ok: false, error: 'Errore upload' }, { status: 500 });
  }

  const { data: publicUrl } = sb.storage.from('spot-photos').getPublicUrl(filename);

  return NextResponse.json({ ok: true, url: publicUrl.publicUrl });
}
