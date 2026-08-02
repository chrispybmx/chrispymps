import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { sendAdminNotification } from '@/lib/email';
import { optimizeImage } from '@/lib/image';

/**
 * Le foto pre-caricate devono vivere nel NOSTRO storage: senza questo controllo
 * z.string().url() accetta qualunque dominio, e un client modificato potrebbe
 * creare spot con immagini hotlinkate da siti terzi (o con contenuti arbitrari
 * serviti dalla mappa). Fail-closed: se l'env manca, nessun URL passa.
 */
const STORAGE_PREFIX = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`
  : null;

const isOwnStorageUrl = (u: string) => STORAGE_PREFIX !== null && u.startsWith(STORAGE_PREFIX);

/** Path dentro il bucket a partire dall'URL pubblico (per la pulizia in rollback) */
function storagePath(url: string, bucket = 'spot-photos'): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

const SpotSchema = z.object({
  name:         z.string().min(2).max(100),
  type:         z.enum(['street','park','diy','rail','ledge','trail','plaza','gap','bowl','pumptrack']),
  lat:          z.number().min(-90).max(90),
  lon:          z.number().min(-180).max(180),
  city:         z.string().max(60).optional(),
  country:      z.string().max(60).optional(),
  country_code: z.string().length(2).regex(/^[A-Za-z]{2}$/).optional(),
  description:  z.string().max(500).optional(),
  guardians:    z.string().max(200).optional(),
  difficulty:   z.string().max(30).optional(),
  photo_urls:   z.array(z.string().url().refine(isOwnStorageUrl, 'URL foto non ammesso')).min(1).max(5).optional(),
  access_token: z.string().min(1).max(2048),
});

// Tipi MIME accettati
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg':  'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
};

// Max 5MB per foto
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? '';
  let parsed: z.infer<typeof SpotSchema>;
  let formData: FormData | null = null;

  if (contentType.includes('application/json')) {
    // Fast path: pre-uploaded photos, JSON body
    try {
      parsed = SpotSchema.parse(await req.json());
    } catch {
      return NextResponse.json({ ok: false, error: 'Dati non validi. Controlla tutti i campi.' }, { status: 422 });
    }
  } else {
    // Legacy path: FormData with photo files
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ ok: false, error: 'Request non valida' }, { status: 400 });
    }
    const rawData = formData.get('data');
    if (!rawData || typeof rawData !== 'string') {
      return NextResponse.json({ ok: false, error: 'Dati mancanti' }, { status: 400 });
    }
    try {
      parsed = SpotSchema.parse(JSON.parse(rawData));
    } catch {
      return NextResponse.json({ ok: false, error: 'Dati non validi. Controlla tutti i campi.' }, { status: 422 });
    }
  }

  // Verifica che ci sia almeno una foto (pre-uploaded URLs o FormData files)
  const hasUrls = parsed.photo_urls && parsed.photo_urls.length > 0;
  const hasFiles = formData ? Array.from({ length: 5 }, (_, i) => formData!.get(`photo_${i}`)).some(f => f instanceof Blob) : false;
  if (!hasUrls && !hasFiles) {
    return NextResponse.json({ ok: false, error: 'Almeno una foto è richiesta.' }, { status: 422 });
  }

  const supabase = supabaseAdmin();

  // 1. Verifica token → ottieni utente
  const { data: { user }, error: authErr } = await supabase.auth.getUser(parsed.access_token);
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato. Accedi prima di inviare uno spot.' }, { status: 401 });
  }

  // 2. Ottieni username dal profilo
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ ok: false, error: 'Profilo non trovato. Riprova.' }, { status: 400 });
  }

  // 3. Crea spot (errori DB non esposti al client)
  const { data: spot, error: spotErr } = await supabase
    .from('spots')
    .insert({
      name:                   parsed.name,
      type:                   parsed.type,
      lat:                    parsed.lat,
      lon:                    parsed.lon,
      city:                   parsed.city ?? null,
      country:                parsed.country ?? null,
      country_code:           parsed.country_code ? parsed.country_code.toUpperCase() : null,
      description:            parsed.description ?? null,
      guardians:              parsed.guardians ?? null,
      difficulty:             parsed.difficulty ?? null,
      status:                 'pending',
      condition:              'alive',
      submitted_by_user_id:   user.id,
      submitted_by_username:  profile.username,
    })
    .select()
    .single();

  if (spotErr || !spot) {
    console.error('[submit-spot] DB error:', spotErr?.message);
    return NextResponse.json({ ok: false, error: 'Errore interno. Riprova più tardi.' }, { status: 500 });
  }

  // 4. Handle photos — SINCRONO e controllato prima di rispondere.
  //    Prima il legacy path usava bgUpload() fire-and-forget: su serverless il
  //    container si congela dopo il return, quindi l'upload non completava e lo
  //    spot restava senza foto (bug: spot fantasma senza immagini). Inoltre gli
  //    insert non erano controllati. Ora tutto e awaited e verificato.
  let photosInserted = 0;
  const uploadedUrls: string[] = []; // per la pulizia se poi il DB fallisce

  if (parsed.photo_urls && parsed.photo_urls.length > 0) {
    // FAST PATH: foto gia caricate (pre-upload), crea solo i record
    uploadedUrls.push(...parsed.photo_urls);
    const { error: photoErr } = await supabase.from('spot_photos').insert(
      parsed.photo_urls.map((url, position) => ({ spot_id: spot.id, url, position, credit_name: profile.username }))
    );
    if (photoErr) console.error('[submit-spot] fast-path photo insert:', photoErr.message);
    else photosInserted = parsed.photo_urls.length;
  } else if (formData) {
    // FALLBACK: file nel FormData -> ottimizza, carica e inserisci (tutto awaited)
    const photoBuffers: { buffer: Buffer; index: number }[] = [];
    for (let i = 0; i < 5; i++) {
      const file = formData.get(`photo_${i}`);
      if (!file || !(file instanceof Blob)) continue;
      if (file.size > MAX_PHOTO_SIZE) continue;
      const mimeType = file.type.toLowerCase();
      if (!ALLOWED_MIME[mimeType]) continue;
      const buffer = Buffer.from(await file.arrayBuffer());
      if (!isValidImageMagicBytes(buffer, mimeType)) continue;
      photoBuffers.push({ buffer, index: i });
    }

    const results = await Promise.all(
      photoBuffers.map(async ({ buffer, index }) => {
        try {
          const { buffer: optimized, contentType, ext } = await optimizeImage(buffer);
          const path = `${spot.id}/${index}.${ext}`;
          const { error } = await supabase.storage.from('spot-photos').upload(path, optimized, { contentType, upsert: true });
          if (error) { console.error('[submit-spot] upload:', error.message); return null; }
          return supabase.storage.from('spot-photos').getPublicUrl(path).data.publicUrl;
        } catch (e) { console.error('[submit-spot] optimize/upload:', e); return null; }
      })
    );
    const urls = results.filter((u): u is string => u !== null);
    uploadedUrls.push(...urls);
    if (urls.length > 0) {
      const { error: photoErr } = await supabase.from('spot_photos').insert(
        urls.map((url, position) => ({ spot_id: spot.id, url, position, credit_name: profile.username }))
      );
      if (photoErr) console.error('[submit-spot] legacy photo insert:', photoErr.message);
      else photosInserted = urls.length;
    }
  }

  // Uno spot senza foto non deve esistere: se il caricamento e fallito del tutto,
  // rimuovi lo spot appena creato cosi l'utente puo riprovare (niente spot fantasma).
  // Ripulisce anche i file gia finiti nello storage, altrimenti resterebbero
  // orfani nel bucket senza nessuna riga che li referenzia.
  if (photosInserted === 0) {
    const paths = uploadedUrls.map(u => storagePath(u)).filter((p): p is string => p !== null);
    if (paths.length > 0) await supabase.storage.from('spot-photos').remove(paths);
    await supabase.from('spots').delete().eq('id', spot.id);
    return NextResponse.json({ ok: false, error: 'Le foto non sono state caricate. Riprova.' }, { status: 500 });
  }

  // 5. Notifica admin — AWAITED, non fire-and-forget: su serverless il container
  //    si congela dopo il return e la promise non completa, quindi la mail non
  //    partiva e lo spot restava in coda senza che nessuno lo sapesse.
  //    Un errore email non deve far fallire una submit andata a buon fine.
  const contributor = { id: user.id, name: profile.username, email: user.email ?? '', instagram_handle: null };
  try {
    await sendAdminNotification(spot, contributor as any);
  } catch (e) {
    console.error('[submit-spot] admin notification:', e);
  }

  return NextResponse.json({ ok: true, data: { id: spot.id, slug: spot.slug } }, { status: 201 });
}

/** Verifica magic bytes per JPEG, PNG, WebP */
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
    default:
      return false;
  }
}
