import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { sendAdminNotification } from '@/lib/email';
import { subscribeToNewsletter } from '@/lib/mailerlite';

const SpotSchema = z.object({
  name:         z.string().min(2).max(100),
  type:         z.enum(['street','park','diy','rail','ledge','trail','plaza','gap','bowl','pumptrack']),
  lat:          z.number().min(-90).max(90),
  lon:          z.number().min(-180).max(180),
  city:         z.string().max(60).optional(),
  description:  z.string().max(500).optional(),
  guardians:    z.string().max(200).optional(),
  difficulty:   z.string().max(30).optional(),
  photo_urls:   z.array(z.string().url()).min(1).max(5),
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

  // 4. Handle photos — either pre-uploaded URLs or FormData files
  if (parsed.photo_urls && parsed.photo_urls.length > 0) {
    // FAST PATH: photos already uploaded, just create records
    await supabase.from('spot_photos').insert(
      parsed.photo_urls.map((url, position) => ({ spot_id: spot.id, url, position, credit_name: profile.username }))
    );
  } else if (formData) {
    // LEGACY PATH: read buffers + upload in background
    const photoBuffers: { buffer: Buffer; mimeType: string; ext: string; index: number }[] = [];
    for (let i = 0; i < 5; i++) {
      const file = formData.get(`photo_${i}`);
      if (!file || !(file instanceof Blob)) continue;
      if (file.size > MAX_PHOTO_SIZE) continue;
      const mimeType = file.type.toLowerCase();
      const ext = ALLOWED_MIME[mimeType];
      if (!ext) continue;
      const buffer = Buffer.from(await file.arrayBuffer());
      if (!isValidImageMagicBytes(buffer, mimeType)) continue;
      photoBuffers.push({ buffer, mimeType, ext, index: i });
    }

    // Upload in background after responding
    if (photoBuffers.length > 0) {
      const bgUpload = async () => {
        const results = await Promise.all(
          photoBuffers.map(async ({ buffer, mimeType, ext, index }) => {
            const path = `${spot.id}/${index}.${ext}`;
            const { error } = await supabase.storage.from('spot-photos').upload(path, buffer, { contentType: mimeType, upsert: true });
            if (error) return null;
            return supabase.storage.from('spot-photos').getPublicUrl(path).data.publicUrl;
          })
        );
        const urls = results.filter((u): u is string => u !== null);
        if (urls.length > 0) {
          await supabase.from('spot_photos').insert(
            urls.map((url, position) => ({ spot_id: spot.id, url, position, credit_name: profile.username }))
          );
        }
      };
      bgUpload().catch(err => console.error('[submit-spot] bg upload error:', err));
    }
  }

  // 5. Newsletter + admin notification (fire-and-forget)
  if (user.email) {
    subscribeToNewsletter(user.email, profile.username, { source: 'submit-spot' })
      .then((r) => { if (!r.ok) console.warn('[submit-spot] newsletter skip:', r.error); })
      .catch(() => {});
  }
  const contributor = { id: user.id, name: profile.username, email: user.email ?? '', instagram_handle: null };
  sendAdminNotification(spot, contributor as any).catch(() => {});

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
