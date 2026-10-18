import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdminAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { UUID_RE } from '@/lib/validation';
import { citySlug } from '@/lib/slugify';
import { spotPhotoStoragePath } from '@/lib/storage-path';

export async function POST(req: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const { spot_id } = await req.json().catch(() => ({}));
  if (!spot_id || !UUID_RE.test(String(spot_id))) {
    return NextResponse.json({ ok: false, error: 'spot_id non valido' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // Slug e città servono a togliere dalla cache le pagine che mostrano lo spot.
  const { data: spot, error: spotErr } = await supabase
    .from('spots').select('slug, city').eq('id', spot_id).maybeSingle();
  if (spotErr) return NextResponse.json({ ok: false, error: 'Lettura spot non riuscita' }, { status: 500 });
  if (!spot) return NextResponse.json({ ok: false, error: 'Spot non trovato' }, { status: 404 });

  // 1. Recupera le foto per eliminarle dallo storage
  const { data: photos, error: photosErr } = await supabase
    .from('spot_photos')
    .select('url')
    .eq('spot_id', spot_id);
  if (photosErr) return NextResponse.json({ ok: false, error: 'Lettura foto non riuscita' }, { status: 500 });

  /* 2. File dallo storage. Se fallisce lo spot resta: cancellandolo si
     perderebbero gli URL e i file pubblici resterebbero orfani per sempre. */
  const paths = (photos ?? []).map(p => spotPhotoStoragePath(p.url)).filter((p): p is string => p !== null);
  if (paths.length > 0) {
    const { error: storageErr } = await supabase.storage.from('spot-photos').remove(paths);
    if (storageErr) {
      console.error('[delete-spot] storage:', storageErr.message);
      return NextResponse.json({ ok: false, error: 'Foto non eliminate dallo storage, riprova' }, { status: 502 });
    }
  }

  // 3. Elimina lo spot (cascade elimina foto e status_updates via FK)
  const { error } = await supabase.from('spots').delete().eq('id', spot_id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // 4. Niente pagina fantasma: spot, città, mappa e sitemap si rigenerano.
  if (spot.slug) revalidatePath(`/map/spot/${spot.slug}`);
  if (spot.city) revalidatePath(`/map/${citySlug(spot.city)}`);
  revalidatePath('/');
  revalidatePath('/sitemap.xml');

  return NextResponse.json({ ok: true });
}
