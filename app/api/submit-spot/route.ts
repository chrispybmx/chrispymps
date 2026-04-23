import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { sendAdminNotification } from '@/lib/email';
import { subscribeToNewsletter } from '@/lib/mailerlite';

const SpotSchema = z.object({
  name:         z.string().min(2).max(100),
  type:         z.enum(['street','park','diy','rail','ledge','trail','plaza','gap','bowl']),
  lat:          z.number().min(-90).max(90),
  lon:          z.number().min(-180).max(180),
  city:                 z.string().max(60).optional(),
  description:          z.string().max(500).optional(),
  guardians:            z.string().max(200).optional(),
  subscribe_newsletter: z.boolean().optional(),
  access_token:         z.string().min(1).max(2048),
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
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Request non valida' }, { status: 400 });
  }

  const rawData = formData.get('data');
  if (!rawData || typeof rawData !== 'string') {
    return NextResponse.json({ ok: false, error: 'Dati mancanti' }, { status: 400 });
  }

  let parsed: z.infer<typeof SpotSchema>;
  try {
    parsed = SpotSchema.parse(JSON.parse(rawData));
  } catch {
    // Non esponiamo i dettagli Zod al client
    return NextResponse.json({ ok: false, error: 'Dati non validi. Controlla tutti i campi.' }, { status: 422 });
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

  // 4. Upload foto (max 5, con validazione)
  const photoUrls: string[] = [];
  for (let i = 0; i < 5; i++) {
    const file = formData.get(`photo_${i}`);
    if (!file || !(file instanceof Blob)) continue;

    // Valida dimensione
    if (file.size > MAX_PHOTO_SIZE) continue;

    // Valida MIME
    const mimeType = file.type.toLowerCase();
    const ext = ALLOWED_MIME[mimeType];
    if (!ext) continue;

    const path   = `${spot.id}/${i}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await supabase.storage
      .from('spot-photos')
      .upload(path, buffer, { contentType: mimeType, upsert: true });

    if (uploadErr) {
      console.error('[submit-spot] foto upload error:', uploadErr.message);
      continue;
    }

    const { data: urlData } = supabase.storage.from('spot-photos').getPublicUrl(path);
    photoUrls.push(urlData.publicUrl);
  }

  if (photoUrls.length > 0) {
    const { error: photosErr } = await supabase.from('spot_photos').insert(
      photoUrls.map((url, position) => ({
        spot_id:     spot.id,
        url,
        position,
        credit_name: profile.username,
      }))
    );
    if (photosErr) console.error('[submit-spot] spot_photos insert error:', photosErr.message);
  }

  // 5. Newsletter MailerLite (fire-and-forget, solo se opt-in)
  if (parsed.subscribe_newsletter && user.email) {
    subscribeToNewsletter(user.email, profile.username).catch(() => {});
  }

  // 6. Notifica admin (fire-and-forget)
  const contributor = { id: user.id, name: profile.username, email: user.email ?? '', instagram_handle: null };
  sendAdminNotification(spot, contributor as any).catch(() => {});

  return NextResponse.json({ ok: true, data: { id: spot.id, slug: spot.slug } }, { status: 201 });
}
