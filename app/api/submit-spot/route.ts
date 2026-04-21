import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { sendAdminNotification, sendContributorConfirmation } from '@/lib/email';
import { subscribeToMappe } from '@/lib/mailerlite';

const SpotSchema = z.object({
  name:                 z.string().min(2).max(100),
  type:                 z.enum(['street','park','diy','rail','ledge','trail','plaza','gap','bowl']),
  lat:                  z.number().min(-90).max(90),
  lon:                  z.number().min(-180).max(180),
  city:                 z.string().max(60).optional(),
  description:          z.string().max(500).optional(),
  surface:              z.string().max(50).optional(),
  wax_needed:           z.boolean().default(false),
  guardians:            z.string().max(200).optional(),
  difficulty:           z.string().optional(),
  contributor_name:     z.string().min(2).max(80),
  contributor_email:    z.string().email(),
  instagram_handle:     z.string().max(40).optional(),
  subscribe_newsletter: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Request non valida' }, { status: 400 });
  }

  // Parse payload JSON
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

  // 1. Upsert contributor (crea se non esiste, aggiorna contatori)
  const { data: contributor, error: contribErr } = await supabase
    .from('contributors')
    .upsert(
      {
        email:             parsed.contributor_email,
        name:              parsed.contributor_name,
        instagram_handle:  parsed.instagram_handle ?? null,
        total_submissions: 1,
      },
      {
        onConflict:        'email',
        ignoreDuplicates:  false,
      }
    )
    .select()
    .single();

  if (contribErr || !contributor) {
    // Se esiste già, caricalo
    const { data: existing } = await supabase
      .from('contributors')
      .select()
      .eq('email', parsed.contributor_email)
      .single();

    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Errore contributor' }, { status: 500 });
    }

    // Incrementa contatore
    await supabase.rpc('increment_submissions', { contributor_id: existing.id });
    Object.assign(existing, { total_submissions: existing.total_submissions + 1 });
  }

  const finalContributor = contributor;

  // 2. Crea spot in stato pending
  const { data: spot, error: spotErr } = await supabase
    .from('spots')
    .insert({
      name:          parsed.name,
      type:          parsed.type,
      lat:           parsed.lat,
      lon:           parsed.lon,
      city:          parsed.city ?? null,
      description:   parsed.description ?? null,
      surface:       parsed.surface ?? null,
      wax_needed:    parsed.wax_needed,
      guardians:     parsed.guardians ?? null,
      difficulty:    parsed.difficulty ?? null,
      status:        'pending',
      condition:     'alive',
      submitted_by:  finalContributor?.id ?? null,
    })
    .select()
    .single();

  if (spotErr || !spot) {
    return NextResponse.json({ ok: false, error: 'Errore creazione spot: ' + spotErr?.message }, { status: 500 });
  }

  // 3. Upload foto (max 5)
  const photoUrls: string[] = [];
  for (let i = 0; i < 5; i++) {
    const file = formData.get(`photo_${i}`);
    if (!file || !(file instanceof Blob)) continue;

    const ext     = file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    const path    = `${spot.id}/${i}.${ext}`;
    const buffer  = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await supabase.storage
      .from('spot-photos')
      .upload(path, buffer, { contentType: file.type, upsert: true });

    if (uploadErr) {
      console.error('[submit-spot] Upload foto errore:', uploadErr.message);
      continue;
    }

    const { data: urlData } = supabase.storage.from('spot-photos').getPublicUrl(path);
    photoUrls.push(urlData.publicUrl);
  }

  // 4. Salva record foto nel DB
  if (photoUrls.length > 0) {
    await supabase.from('spot_photos').insert(
      photoUrls.map((url, position) => ({
        spot_id:     spot.id,
        url,
        position,
        uploaded_by: finalContributor?.id ?? null,
        credit_name: parsed.contributor_name,
      }))
    );
  }

  // 5. Email admin + conferma contributor (fire-and-forget, non blocca la risposta)
  Promise.all([
    finalContributor
      ? sendAdminNotification(spot, finalContributor).catch(console.error)
      : Promise.resolve(),
    finalContributor
      ? sendContributorConfirmation(finalContributor, spot).catch(console.error)
      : Promise.resolve(),
    parsed.subscribe_newsletter && finalContributor
      ? subscribeToMappe(finalContributor.email, finalContributor.name).catch(console.error)
      : Promise.resolve(),
  ]);

  return NextResponse.json({ ok: true, data: { id: spot.id, slug: spot.slug } }, { status: 201 });
}
