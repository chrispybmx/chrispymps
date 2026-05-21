import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { detectMime, MIME_EXT } from '@/lib/mime';
import { UUID_RE } from '@/lib/validation';

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_PHOTOS_PER_SPOT_PER_USER = 3;
const MAX_PHOTOS_PER_WEEK = 10;

/**
 * POST /api/spot-photos
 * Authenticated user uploads photos to an existing approved spot.
 * Photos go to pending moderation.
 */
export async function POST(req: NextRequest) {
  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ ok: false, error: 'Request non valida' }, { status: 400 }); }

  const spotId = formData.get('spot_id') as string | null;
  const token = formData.get('access_token') as string | null;

  if (!spotId || !UUID_RE.test(spotId)) {
    return NextResponse.json({ ok: false, error: 'spot_id non valido' }, { status: 400 });
  }
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 });
  }

  const supabase = supabaseAdmin();

  // 1. Verify auth
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: 'Token non valido. Riaccedi.' }, { status: 401 });
  }

  // 2. Verify spot exists and is approved
  const { data: spot } = await supabase
    .from('spots')
    .select('id, name')
    .eq('id', spotId)
    .eq('status', 'approved')
    .single();

  if (!spot) {
    return NextResponse.json({ ok: false, error: 'Spot non trovato o non approvato.' }, { status: 404 });
  }

  // 3. Anti-spam: max photos per spot per user
  const { count: userPhotosOnSpot } = await supabase
    .from('spot_photos')
    .select('id', { count: 'exact', head: true })
    .eq('spot_id', spotId)
    .eq('uploaded_by', user.id);

  if ((userPhotosOnSpot ?? 0) >= MAX_PHOTOS_PER_SPOT_PER_USER) {
    return NextResponse.json({
      ok: false,
      error: `Hai già caricato ${MAX_PHOTOS_PER_SPOT_PER_USER} foto su questo spot. Massimo raggiunto.`,
    }, { status: 429 });
  }

  // 4. Anti-spam: max photos per week
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: weeklyPhotos } = await supabase
    .from('spot_photos')
    .select('id', { count: 'exact', head: true })
    .eq('uploaded_by', user.id)
    .gte('created_at', weekAgo);

  if ((weeklyPhotos ?? 0) >= MAX_PHOTOS_PER_WEEK) {
    return NextResponse.json({
      ok: false,
      error: `Limite settimanale di ${MAX_PHOTOS_PER_WEEK} foto raggiunto. Riprova tra qualche giorno.`,
    }, { status: 429 });
  }

  // 5. Extract photo files
  const photos: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('photo_') && value instanceof File) {
      photos.push(value);
    }
  }

  if (photos.length === 0) {
    return NextResponse.json({ ok: false, error: 'Nessuna foto caricata.' }, { status: 400 });
  }

  if (photos.length > 3) {
    return NextResponse.json({ ok: false, error: 'Massimo 3 foto per volta.' }, { status: 400 });
  }

  // 6. Validate + upload each photo
  // Get current max position for this spot
  const { data: existingPhotos } = await supabase
    .from('spot_photos')
    .select('position')
    .eq('spot_id', spotId)
    .order('position', { ascending: false })
    .limit(1);

  let nextPos = (existingPhotos?.[0]?.position ?? -1) + 1;

  // Create contribution record
  const { data: contribution, error: contribErr } = await supabase
    .from('spot_contributions')
    .insert({
      user_id: user.id,
      spot_id: spotId,
      contribution_type: 'photo',
      status: 'pending',
      metadata: { photo_count: photos.length },
    })
    .select('id')
    .single();

  if (contribErr || !contribution) {
    return NextResponse.json({ ok: false, error: 'Errore creazione contributo.' }, { status: 500 });
  }

  // Upload all photos in PARALLEL
  const uploadResults = await Promise.all(
    photos.map(async (file, i) => {
      if (file.size > MAX_PHOTO_SIZE) return null;
      const buf = await file.arrayBuffer();
      const mime = detectMime(buf);
      if (!mime || !MIME_EXT[mime]) return null;

      const ext = MIME_EXT[mime];
      const filename = `${spotId}/user_${user.id}_${Date.now()}_${i}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('spot-photos')
        .upload(filename, buf, { contentType: mime, upsert: false });

      if (uploadErr) { console.error('[spot-photos] upload error:', uploadErr); return null; }

      const url = supabase.storage.from('spot-photos').getPublicUrl(filename).data.publicUrl;

      const { error: insertErr } = await supabase.from('spot_photos').insert({
        spot_id: spotId, url, position: nextPos + i,
        uploaded_by: user.id, moderation_status: 'pending',
        contribution_id: contribution.id,
      });

      return insertErr ? null : url;
    })
  );

  const uploadedUrls = uploadResults.filter((u): u is string => u !== null);

  if (uploadedUrls.length === 0) {
    return NextResponse.json({ ok: false, error: 'Errore durante il caricamento. Riprova.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    uploaded: uploadedUrls.length,
    message: `${uploadedUrls.length} foto caricata/e! In attesa di approvazione.`,
  });
}
