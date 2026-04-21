import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { sendAdminNotification } from '@/lib/email';

const SpotSchema = z.object({
  name:         z.string().min(2).max(100),
  type:         z.enum(['street','park','diy','rail','ledge','trail','plaza','gap','bowl']),
  lat:          z.number().min(-90).max(90),
  lon:          z.number().min(-180).max(180),
  city:         z.string().max(60).optional(),
  description:  z.string().max(500).optional(),
  guardians:    z.string().max(200).optional(),
  access_token: z.string().min(1),
});

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
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'Dati non validi: ' + String(e) }, { status: 422 });
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

  // 3. Crea spot
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
    return NextResponse.json({ ok: false, error: 'Errore creazione spot: ' + spotErr?.message }, { status: 500 });
  }

  // 4. Upload foto (max 5)
  const photoUrls: string[] = [];
  for (let i = 0; i < 5; i++) {
    const file = formData.get(`photo_${i}`);
    if (!file || !(file instanceof Blob)) continue;
    const ext    = file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    const path   = `${spot.id}/${i}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadErr } = await supabase.storage.from('spot-photos').upload(path, buffer, { contentType: file.type, upsert: true });
    if (uploadErr) { console.error('[submit-spot] foto upload error:', uploadErr.message); continue; }
    const { data: urlData } = supabase.storage.from('spot-photos').getPublicUrl(path);
    photoUrls.push(urlData.publicUrl);
  }

  if (photoUrls.length > 0) {
    await supabase.from('spot_photos').insert(
      photoUrls.map((url, position) => ({
        spot_id:     spot.id,
        url,
        position,
        credit_name: profile.username,
      }))
    );
  }

  // 5. Notifica admin (fire-and-forget)
  const fakeContributor = { id: user.id, name: profile.username, email: user.email ?? '', instagram_handle: null };
  sendAdminNotification(spot, fakeContributor as any).catch(console.error);

  return NextResponse.json({ ok: true, data: { id: spot.id, slug: spot.slug } }, { status: 201 });
}
