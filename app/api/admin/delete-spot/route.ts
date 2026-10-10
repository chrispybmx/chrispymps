import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { UUID_RE } from '@/lib/validation';

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const { spot_id } = await req.json().catch(() => ({}));
  if (!spot_id || !UUID_RE.test(String(spot_id))) {
    return NextResponse.json({ ok: false, error: 'spot_id non valido' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // 1. Recupera le foto per eliminarle dallo storage
  const { data: photos, error: photosError } = await supabase
    .from('spot_photos')
    .select('url')
    .eq('spot_id', spot_id);

  if (photosError) return NextResponse.json({ ok: false, error: 'Impossibile leggere le foto dello spot.' }, { status: 500 });

  // Do not remove files while a database constraint can still reject deletion.
  const { error } = await supabase.from('spots').delete().eq('id', spot_id);
  if (error) return NextResponse.json({ ok: false, error: 'Impossibile eliminare lo spot.' }, { status: 500 });

  // 2. Elimina file dallo storage Supabase (se presenti)
  if (photos && photos.length > 0) {
    const paths = photos.map(p => {
      try {
        // url: https://xxx.supabase.co/storage/v1/object/public/spot-photos/path/to/file
        const url = new URL(p.url);
        const parts = url.pathname.split('/spot-photos/');
        const storagePath = parts[1];
        // Blocca path traversal e path vuoti
        if (!storagePath || storagePath.includes('..') || storagePath.startsWith('/')) return null;
        return storagePath;
      } catch {
        return null;
      }
    }).filter(Boolean) as string[];

    if (paths.length > 0) {
      try {
        const { error: storageError } = await supabase.storage.from('spot-photos').remove(paths);
        if (storageError) throw new Error('STORAGE_CLEANUP_FAILED');
      } catch {
        return NextResponse.json({ ok: true, warning: 'Spot eliminato. Pulizia dei file fotografici da completare.', cleanupPending: true });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
