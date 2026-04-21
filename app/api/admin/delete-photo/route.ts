import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const { photo_id, url } = await req.json();
  if (!photo_id) return NextResponse.json({ ok: false, error: 'photo_id mancante' }, { status: 400 });

  const supabase = supabaseAdmin();

  // Elimina dal storage
  if (url) {
    try {
      const urlObj = new URL(url);
      const parts  = urlObj.pathname.split('/spot-photos/');
      if (parts[1]) {
        await supabase.storage.from('spot-photos').remove([parts[1]]);
      }
    } catch {}
  }

  // Elimina dal DB
  const { error } = await supabase.from('spot_photos').delete().eq('id', photo_id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
