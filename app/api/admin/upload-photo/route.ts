import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

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
  if (!spotId || typeof spotId !== 'string') {
    return NextResponse.json({ ok: false, error: 'spot_id mancante' }, { status: 400 });
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

  // Processa tutti i file (photo_0, photo_1, ...)
  for (let i = 0; i < 10; i++) {
    const file = formData.get(`photo_${i}`);
    if (!file || !(file instanceof Blob)) break;

    const ext    = file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    const path   = `${spotId}/${Date.now()}_${i}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await supabase.storage
      .from('spot-photos')
      .upload(path, buffer, { contentType: file.type, upsert: false });

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
