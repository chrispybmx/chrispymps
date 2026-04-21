import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const { spot_id } = await req.json();
  if (!spot_id) return NextResponse.json({ ok: false, error: 'spot_id mancante' }, { status: 400 });

  const supabase = supabaseAdmin();

  // 1. Recupera le foto per eliminarle dallo storage
  const { data: photos } = await supabase
    .from('spot_photos')
    .select('url')
    .eq('spot_id', spot_id);

  // 2. Elimina file dallo storage Supabase (se presenti)
  if (photos && photos.length > 0) {
    const paths = photos.map(p => {
      // url: https://xxx.supabase.co/storage/v1/object/public/spot-photos/path/to/file
      const url = new URL(p.url);
      const parts = url.pathname.split('/spot-photos/');
      return parts[1];
    }).filter(Boolean);

    if (paths.length > 0) {
      await supabase.storage.from('spot-photos').remove(paths);
    }
  }

  // 3. Elimina lo spot (cascade elimina foto e status_updates via FK)
  const { error } = await supabase.from('spots').delete().eq('id', spot_id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
