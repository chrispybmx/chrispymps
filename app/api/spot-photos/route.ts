import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { detectMime, MIME_EXT } from '@/lib/mime';
import { UUID_RE } from '@/lib/validation';
import { optimizeImage } from '@/lib/image';

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

  // 3. Extract photo files (prima dei limiti: contano anche quelle in arrivo)
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

  // 4. Anti-spam: max photos per spot per user
  const { count: userPhotosOnSpot, error: spotCountErr } = await supabase
    .from('spot_photos')
    .select('id', { count: 'exact', head: true })
    .eq('spot_id', spotId)
    .eq('uploaded_by', user.id);

  if (spotCountErr) return NextResponse.json({ ok: false, error: 'Verifica limiti non riuscita. Riprova.' }, { status: 503 });
  if ((userPhotosOnSpot ?? 0) + photos.length > MAX_PHOTOS_PER_SPOT_PER_USER) {
    const restanti = Math.max(0, MAX_PHOTOS_PER_SPOT_PER_USER - (userPhotosOnSpot ?? 0));
    return NextResponse.json({
      ok: false,
      error: restanti === 0
        ? `Hai già caricato ${MAX_PHOTOS_PER_SPOT_PER_USER} foto su questo spot. Massimo raggiunto.`
        : `Su questo spot puoi aggiungere ancora ${restanti} foto.`,
    }, { status: 429 });
  }

  // 5. Anti-spam: max photos per week
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: weeklyPhotos, error: weekCountErr } = await supabase
    .from('spot_photos')
    .select('id', { count: 'exact', head: true })
    .eq('uploaded_by', user.id)
    .gte('created_at', weekAgo);

  if (weekCountErr) return NextResponse.json({ ok: false, error: 'Verifica limiti non riuscita. Riprova.' }, { status: 503 });
  if ((weeklyPhotos ?? 0) + photos.length > MAX_PHOTOS_PER_WEEK) {
    const restanti = Math.max(0, MAX_PHOTOS_PER_WEEK - (weeklyPhotos ?? 0));
    return NextResponse.json({
      ok: false,
      error: restanti === 0
        ? `Limite settimanale di ${MAX_PHOTOS_PER_WEEK} foto raggiunto. Riprova tra qualche giorno.`
        : `Questa settimana puoi caricare ancora ${restanti} foto.`,
    }, { status: 429 });
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

  // Upload all photos in PARALLEL.
  // Si tiene traccia del filename anche quando la riga DB fallisce: serve a
  // ripulire lo storage invece di lasciare file orfani impossibili da collegare.
  const uploadResults = await Promise.all(
    photos.map(async (file, i): Promise<{ url: string | null; filename: string | null }> => {
      if (file.size > MAX_PHOTO_SIZE) return { url: null, filename: null };
      const buf = await file.arrayBuffer();
      const mime = detectMime(buf);
      if (!mime || !MIME_EXT[mime]) return { url: null, filename: null };

      // Ottimizza (resize+JPEG) e strip EXIF/GPS prima dell'upload.
      // sharp lancia su HEIC non decodificabili o file troncati: si scarta
      // quella foto invece di far cadere tutta la richiesta con un 500.
      let optimizedImage: Awaited<ReturnType<typeof optimizeImage>>;
      try { optimizedImage = await optimizeImage(Buffer.from(buf)); }
      catch (err) { console.error('[spot-photos] optimize error:', err instanceof Error ? err.message : err); return { url: null, filename: null }; }
      const { buffer: optimized, contentType, ext } = optimizedImage;

      const filename = `${spotId}/user_${user.id}_${Date.now()}_${i}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('spot-photos')
        .upload(filename, optimized, { contentType, upsert: false });

      if (uploadErr) { console.error('[spot-photos] upload error:', uploadErr); return { url: null, filename: null }; }

      const url = supabase.storage.from('spot-photos').getPublicUrl(filename).data.publicUrl;

      const { error: insertErr } = await supabase.from('spot_photos').insert({
        spot_id: spotId, url, position: nextPos + i,
        uploaded_by: user.id, moderation_status: 'pending',
        contribution_id: contribution.id,
      });

      // Loggare SEMPRE: un insert fallito silenziosamente ha tenuto nascosta per
      // mesi una violazione di FK che rompeva del tutto l'upload foto.
      if (insertErr) {
        console.error('[spot-photos] insert error:', insertErr.code, insertErr.message, insertErr.details);
        return { url: null, filename };
      }

      return { url, filename };
    })
  );

  const uploadedUrls = uploadResults.map(r => r.url).filter((u): u is string => u !== null);

  if (uploadedUrls.length === 0) {
    // Niente è finito a DB: rimuovi contributo e file caricati, così non restano
    // voci fantasma in coda di moderazione né blob scollegati nel bucket.
    const orphans = uploadResults.map(r => r.filename).filter((f): f is string => f !== null);
    if (orphans.length > 0) {
      await supabase.storage.from('spot-photos').remove(orphans);
    }
    await supabase.from('spot_contributions').delete().eq('id', contribution.id);

    return NextResponse.json({ ok: false, error: 'Errore durante il caricamento. Riprova.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    uploaded: uploadedUrls.length,
    message: `${uploadedUrls.length} foto caricata/e! In attesa di approvazione.`,
  });
}
