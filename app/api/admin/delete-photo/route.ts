import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdminAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { UUID_RE } from '@/lib/validation';
import { spotPhotoStoragePath } from '@/lib/storage-path';

export async function POST(req: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const { photo_id } = await req.json().catch(() => ({}));
  if (!photo_id || !UUID_RE.test(String(photo_id))) return NextResponse.json({ ok: false, error: 'photo_id mancante' }, { status: 400 });

  const supabase = supabaseAdmin();

  // L'URL si legge dal DB, non dal client: si cancella solo il file di quella foto.
  const { data: photo, error: readErr } = await supabase
    .from('spot_photos').select('url, spots(slug)').eq('id', photo_id).maybeSingle();
  if (readErr) return NextResponse.json({ ok: false, error: 'Lettura foto non riuscita' }, { status: 500 });
  if (!photo) return NextResponse.json({ ok: false, error: 'Foto non trovata' }, { status: 404 });

  /* Se il file non si cancella la riga resta: altrimenti il file pubblico
     resterebbe raggiungibile senza piu' nessun modo di trovarlo e toglierlo. */
  const storagePath = spotPhotoStoragePath(photo.url);
  if (storagePath) {
    const { error: storageErr } = await supabase.storage.from('spot-photos').remove([storagePath]);
    if (storageErr) {
      console.error('[delete-photo] storage:', storageErr.message);
      return NextResponse.json({ ok: false, error: 'File non eliminato, riprova' }, { status: 502 });
    }
  }

  const { error } = await supabase.from('spot_photos').delete().eq('id', photo_id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const slug = (photo.spots as { slug?: string } | null)?.slug;
  if (slug) revalidatePath(`/map/spot/${slug}`);
  return NextResponse.json({ ok: true });
}
